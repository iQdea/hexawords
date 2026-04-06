import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL, GameMode, GameStatus, AuthProvider } from '../../database';
import type { GameRow, CellRow, CampaignLevelRow } from '../../database';
import { DictionaryService } from '../dictionary/dictionary.service';
import { SocketService } from '../socket/socket.service';
import { CellRespawnService } from '../queue/cell-respawn.service';
import { GameEngine, WeightedLetterGenerator } from '@hexawords/game-engine';
import type { GameState } from '@hexawords/game-engine';
import { gridForSize } from '@hexawords/hex-math';
import {
  GameMode as GameModeEnum,
  GameComplexity as ComplexityEnum,
  COMPLEXITY_HEX_COUNT,
  CELLS_PER_HEX,
} from '@hexawords/types';
import type { WordPathStep } from '@hexawords/types';

/**
 * Pick a lock type with weighted probability, respecting slot constraints.
 * - gray (40%): any slot
 * - blue (20%): NOT center (slot 0) — requires center to unlock
 * - purple (25%): any slot
 * - orange (15%): NOT center (slot 0) — requires center + neighbor
 */
function pickLockType(slot: number): 'gray' | 'blue' | 'purple' | 'orange' {
  const isCenter = slot === 0;
  // Weighted options: [type, weight]
  const options: Array<['gray' | 'blue' | 'purple' | 'orange', number]> = [
    ['gray', 40],
    ['purple', 25],
  ];
  if (!isCenter) {
    options.push(['blue', 20], ['orange', 15]);
  }
  const total = options.reduce((s, [, w]) => s + w, 0);
  let rand = Math.random() * total;
  for (const [type, weight] of options) {
    rand -= weight;
    if (rand <= 0) return type;
  }
  return 'gray';
}

@Injectable()
export class GameService {
  private letterGenerator = new WeightedLetterGenerator();

  constructor(
    @Inject(PG_POOL) private pool: Pool,
    private dictionary: DictionaryService,
    private socketService: SocketService,
    private cellRespawnService: CellRespawnService,
  ) {}

  private async ensureUser(userId: string) {
    const { rows } = await this.pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (rows.length > 0) return;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO users (id) VALUES ($1)', [userId]);
      await client.query('INSERT INTO user_profiles (user_id, nickname) VALUES ($1, $2)', [userId, 'Игрок']);
      await client.query('INSERT INTO user_auth (user_id, provider) VALUES ($1, $2)', [userId, AuthProvider.ANONYMOUS]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  private async getCampaignLevel(level: number): Promise<CampaignLevelRow> {
    const { rows } = await this.pool.query<CampaignLevelRow>(
      'SELECT * FROM campaign_levels WHERE level = $1', [level],
    );
    if (rows.length === 0) throw new BadRequestException(`Invalid campaign level: ${level}`);
    return rows[0];
  }

  async getCampaignLevels(): Promise<CampaignLevelRow[]> {
    const { rows } = await this.pool.query<CampaignLevelRow>(
      'SELECT * FROM campaign_levels ORDER BY level ASC',
    );
    return rows;
  }

  private createEngine(): GameEngine {
    return new GameEngine(
      {
        isValid: (word: string) => this.dictionary.isValidWord(word),
        getFreq: (word: string) => this.dictionary.getFreq(word),
      },
      this.letterGenerator,
    );
  }

  async createGame(userId: string, mode: GameModeEnum, complexity?: ComplexityEnum, level?: number) {
    await this.ensureUser(userId);
    let hexCount: number;
    let minWordLength = 2;
    let colorMode = false;
    let lockedRatio = 0;
    let edgeHexCount = 0;

    if (mode === GameModeEnum.CAMPAIGN) {
      const campaignLevel = await this.getCampaignLevel(level!);
      hexCount = campaignLevel.hex_count;
      minWordLength = campaignLevel.min_word_length;
      colorMode = campaignLevel.color_mode;
      lockedRatio = campaignLevel.locked_ratio;
      edgeHexCount = campaignLevel.edge_hex_count;
    } else {
      if (!complexity) throw new BadRequestException('Complexity required for single mode');
      hexCount = COMPLEXITY_HEX_COUNT[complexity];
    }

    // Check for existing active game
    const modeUpper = mode.toUpperCase() as GameMode;
    let existingQuery: string;
    let existingParams: (string | number | null | undefined)[];

    if (mode === GameModeEnum.CAMPAIGN) {
      existingQuery = 'SELECT * FROM games WHERE user_id = $1 AND mode = $2 AND status IN ($3, $4) AND level = $5 ORDER BY CASE status WHEN $3 THEN 0 ELSE 1 END LIMIT 1';
      existingParams = [userId, modeUpper, GameStatus.ACTIVE, GameStatus.FINISHED, level];
    } else {
      existingQuery = 'SELECT * FROM games WHERE user_id = $1 AND mode = $2 AND status = $3 AND complexity = $4';
      existingParams = [userId, modeUpper, GameStatus.ACTIVE, complexity!.toUpperCase()];
    }

    const { rows: existingGames } = await this.pool.query<GameRow>(existingQuery, existingParams);

    if (existingGames.length > 0) {
      const game = existingGames[0];
      const { rows: cells } = await this.pool.query<CellRow>('SELECT * FROM cells WHERE game_id = $1', [game.id]);
      const { rows: words } = await this.pool.query<{ word: string; points: number }>('SELECT word, points FROM game_words WHERE game_id = $1 ORDER BY points DESC, created_at ASC', [game.id]);
      return await this.formatGameResponse(game, cells, words);
    }

    // Generate new game
    const engine = this.createEngine();
    const state = engine.createInitialState({ mode, hexCount, cellsPerHex: CELLS_PER_HEX, edgeHexCount });

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [game] } = await client.query<GameRow>(
        `INSERT INTO games (user_id, mode, complexity, level, hex_count, cells_per_hex, min_word_length, color_mode, edge_hex_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [userId, modeUpper, complexity ? complexity.toString().toUpperCase() : null, level ?? null, hexCount, CELLS_PER_HEX, minWordLength, colorMode, edgeHexCount],
      );

      // Build cell values from all hexagons (core + edge)
      const cellValues: (string | number | boolean | null)[] = [];
      const placeholders: string[] = [];
      let idx = 1;
      for (const [, hexCells] of state.hexagons) {
        for (const cell of hexCells) {
          const variant = colorMode ? (Math.random() < 0.7 ? 'light' : 'dark') : null;
          const lockType = lockedRatio > 0 && Math.random() < lockedRatio
            ? pickLockType(cell.slot)
            : null;
          placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7})`);
          cellValues.push(game.id, cell.hexQ, cell.hexR, cell.slot, cell.char, cell.points, variant, lockType);
          idx += 8;
        }
      }

      await client.query(
        `INSERT INTO cells (game_id, hex_q, hex_r, slot, char, points, variant, lock_type) VALUES ${placeholders.join(', ')}`,
        cellValues,
      );

      const { rows: cells } = await client.query<CellRow>('SELECT * FROM cells WHERE game_id = $1', [game.id]);

      await client.query('COMMIT');
      return await this.formatGameResponse(game, cells);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async submitWord(userId: string, gameId: string, path: WordPathStep[]) {
    const client = await this.pool.connect();
    let txResult: { valid: boolean; word: string; reason?: string; points?: number; colorBonus?: number; consumedCells?: Array<{ hexQ: number; hexR: number; slot: number }>; unlockedCells?: Array<{ hexQ: number; hexR: number; slot: number; variant: string | null }>; totalScore?: number; campaignComplete?: boolean };
    try {
      await client.query('BEGIN');

      const { rows: [game] } = await client.query<GameRow>(
        'SELECT * FROM games WHERE id = $1 AND user_id = $2 AND status = $3',
        [gameId, userId, GameStatus.ACTIVE],
      );
      if (!game) throw new NotFoundException('Active game not found');

      const { rows: dbCells } = await client.query<CellRow>('SELECT * FROM cells WHERE game_id = $1', [gameId]);

      // Build engine state
      const hexagons = new Map<string, { id?: string; hexQ: number; hexR: number; slot: number; char: string; points: number; isActive: boolean; lockType: 'gray' | 'blue' | 'purple' | 'orange' | null; variant: 'light' | 'dark' | null }[]>();
      for (const cell of dbCells) {
        const key = `${cell.hex_q},${cell.hex_r}`;
        if (!hexagons.has(key)) hexagons.set(key, []);
        hexagons.get(key)!.push({
          hexQ: cell.hex_q,
          hexR: cell.hex_r,
          slot: cell.slot,
          char: cell.char,
          points: cell.points,
          isActive: cell.is_active,
          lockType: cell.lock_type as 'gray' | 'blue' | 'purple' | 'orange' | null,
          variant: cell.variant as 'light' | 'dark' | null,
        });
      }
      for (const cells of hexagons.values()) {
        cells.sort((a: { slot: number }, b: { slot: number }) => a.slot - b.slot);
      }

      const engine = this.createEngine();
      const engineState: GameState = {
        hexagons,
        score: game.score,
        wordCount: game.word_count,
        wordsFound: new Set<string>(),
        status: 'active',
      };

      const { rows: foundWords } = await client.query<{ word: string }>(
        'SELECT word FROM game_words WHERE game_id = $1', [gameId],
      );
      for (const { word } of foundWords) {
        engineState.wordsFound.add(word);
      }

      const result = await engine.submitWord(engineState, { path }, game.min_word_length);

      if (!result.valid) {
        await client.query('ROLLBACK');
        txResult = { valid: false, word: result.word, reason: result.reason };
        return txResult;
      }

      // Color bonus: x2 if all cells in the word share the same variant
      let colorBonus = 1;
      if (game.color_mode && result.consumedCells.length > 0) {
        const variants = result.consumedCells.map(step => {
          const cell = dbCells.find(c => c.hex_q === step.hexQ && c.hex_r === step.hexR && c.slot === step.slot);
          return cell?.variant;
        });
        const first = variants[0];
        if (first && variants.every(v => v === first)) {
          colorBonus = 2;
        }
      }

      // Deactivate consumed cells
      for (const step of result.consumedCells) {
        await client.query(
          'UPDATE cells SET is_active = false WHERE game_id = $1 AND hex_q = $2 AND hex_r = $3 AND slot = $4',
          [gameId, step.hexQ, step.hexR, step.slot],
        );
      }

      // Apply color bonus
      const finalPoints = result.points * colorBonus;

      // Record the word
      await client.query(
        'INSERT INTO game_words (game_id, word, points, cell_path) VALUES ($1, $2, $3, $4)',
        [gameId, result.word, finalPoints, JSON.stringify(path)],
      );

      // Update game score
      await client.query(
        'UPDATE games SET score = score + $1, word_count = word_count + 1 WHERE id = $2',
        [finalPoints, gameId],
      );

      // Record in user history
      await client.query(
        'INSERT INTO user_word_history (user_id, word, points, mode) VALUES ($1, $2, $3, $4)',
        [userId, result.word, finalPoints, game.mode],
      );

      // Unlock cells based on lock type rules
      // gray: any cell in same hex used → unlock
      // blue: center (slot 0) used → unlock
      // purple: a neighboring ring slot (not center) used → unlock
      // orange: both center AND adjacent ring slot used → unlock
      const SLOT_NEIGHBORS: Record<number, number[]> = {
        0: [1, 2, 3, 4, 5, 6],
        1: [0, 2, 6], 2: [0, 1, 3], 3: [0, 2, 4],
        4: [0, 3, 5], 5: [0, 4, 6], 6: [0, 5, 1],
      };

      // Build per-hex usage info
      const hexUsage = new Map<string, { slots: Set<number>; hasCenter: boolean }>();
      for (const step of result.consumedCells) {
        const key = `${step.hexQ},${step.hexR}`;
        if (!hexUsage.has(key)) hexUsage.set(key, { slots: new Set(), hasCenter: false });
        const info = hexUsage.get(key)!;
        info.slots.add(step.slot);
        if (step.slot === 0) info.hasCenter = true;
      }

      const unlockedCells: Array<{ hex_q: number; hex_r: number; slot: number; char: string; points: number; variant: string | null }> = [];

      // Check each locked cell in used hexagons
      for (const [hexKey, usage] of hexUsage) {
        const [hq, hr] = hexKey.split(',').map(Number);
        const { rows: lockedCells } = await client.query<CellRow>(
          'SELECT * FROM cells WHERE game_id = $1 AND hex_q = $2 AND hex_r = $3 AND lock_type IS NOT NULL',
          [gameId, hq, hr],
        );

        for (const cell of lockedCells) {
          let shouldUnlock = false;
          const ringNeighbors = (SLOT_NEIGHBORS[cell.slot] ?? []).filter(s => s !== 0);

          switch (cell.lock_type) {
            case 'gray':
              // Any cell in hex used
              shouldUnlock = true;
              break;
            case 'blue':
              // Center used
              shouldUnlock = usage.hasCenter;
              break;
            case 'purple':
              // Any neighboring ring slot (not center) used
              shouldUnlock = ringNeighbors.some(s => usage.slots.has(s));
              break;
            case 'orange':
              // Both center AND adjacent ring slot used
              shouldUnlock = usage.hasCenter && ringNeighbors.some(s => usage.slots.has(s));
              break;
          }

          if (shouldUnlock) {
            await client.query('UPDATE cells SET lock_type = NULL WHERE id = $1', [cell.id]);
            unlockedCells.push(cell);
          }
        }
      }

      // Increment word discovery frequency
      await this.dictionary.incrementFreq(result.word);

      // Check campaign completion
      let campaignComplete = false;
      if (game.mode === GameMode.CAMPAIGN && game.level) {
        const lvl = await this.getCampaignLevel(game.level);
        if (game.score + finalPoints >= lvl.target_score) {
          await client.query(
            'UPDATE games SET status = $1, finished_at = $2 WHERE id = $3',
            [GameStatus.FINISHED, new Date(), gameId],
          );
          campaignComplete = true;
        }
      }

      await client.query('COMMIT');

      this.socketService.sendToUser(userId, 'score:update', {
        gameId,
        score: game.score + finalPoints,
        wordCount: game.word_count + 1,
        word: result.word,
        wordPoints: result.points,
      });

      if (campaignComplete) {
        this.socketService.sendToUser(userId, 'game:finished', {
          gameId,
          finalScore: game.score + finalPoints,
          wordsFound: game.word_count + 1,
        });
      }

      await client.query('COMMIT');

      txResult = {
        valid: true,
        word: result.word,
        points: finalPoints,
        colorBonus: colorBonus > 1 ? colorBonus : undefined,
        consumedCells: result.consumedCells,
        unlockedCells: unlockedCells.map(c => ({ hexQ: c.hex_q, hexR: c.hex_r, slot: c.slot, variant: c.variant })),
        totalScore: game.score + finalPoints,
        campaignComplete,
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    if (txResult.valid && txResult.consumedCells && txResult.consumedCells.length > 0) {
      await this.cellRespawnService.enqueueRespawn({
        gameId,
        userId,
        cells: txResult.consumedCells.map((c) => ({ q: c.hexQ, r: c.hexR, slot: c.slot })),
      });
    }

    return txResult;
  }

  async resetGame(userId: string, gameId: string) {
    const { rows: [game] } = await this.pool.query<GameRow>(
      'SELECT * FROM games WHERE id = $1 AND user_id = $2 AND status = $3',
      [gameId, userId, GameStatus.ACTIVE],
    );
    if (!game) throw new NotFoundException('Active game not found');

    const engine = this.createEngine();
    const newState = engine.createInitialState({
      mode: game.mode.toLowerCase() as GameModeEnum,
      hexCount: game.hex_count,
      cellsPerHex: game.cells_per_hex,
    });

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Determine locked_ratio from campaign level config
      let lockedRatio = 0;
      if (game.mode === GameMode.CAMPAIGN && game.level) {
        const lvl = await this.getCampaignLevel(game.level);
        lockedRatio = lvl.locked_ratio;
      }

      for (const [, cells] of newState.hexagons) {
        for (const cell of cells) {
          const variant = game.color_mode ? (Math.random() < 0.7 ? 'light' : 'dark') : null;
          const lockType = lockedRatio > 0 && Math.random() < lockedRatio
            ? pickLockType(cell.slot)
            : null;
          await client.query(
            'UPDATE cells SET char = $1, points = $2, is_active = true, lock_type = $3, variant = $4 WHERE game_id = $5 AND hex_q = $6 AND hex_r = $7 AND slot = $8',
            [cell.char, cell.points, lockType, variant, gameId, cell.hexQ, cell.hexR, cell.slot],
          );
        }
      }

      await client.query('UPDATE games SET score = 0, word_count = 0 WHERE id = $1', [gameId]);
      await client.query('DELETE FROM game_words WHERE game_id = $1', [gameId]);

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const { rows: updatedCells } = await this.pool.query<CellRow>('SELECT * FROM cells WHERE game_id = $1', [gameId]);
    return await this.formatGameResponse({ ...game, score: 0, word_count: 0 }, updatedCells);
  }

  async getGame(userId: string, gameId: string) {
    const { rows: [game] } = await this.pool.query<GameRow>(
      'SELECT * FROM games WHERE id = $1 AND user_id = $2', [gameId, userId],
    );
    if (!game) throw new NotFoundException('Game not found');

    const { rows: cells } = await this.pool.query<CellRow>('SELECT * FROM cells WHERE game_id = $1', [game.id]);
    const { rows: words } = await this.pool.query<{ word: string; points: number }>('SELECT word, points FROM game_words WHERE game_id = $1 ORDER BY points DESC, created_at ASC', [game.id]);
    return await this.formatGameResponse(game, cells, words);
  }

  async getCampaignProgress(userId: string) {
    const { rows: completed } = await this.pool.query<{ level: number; score: number }>(
      'SELECT level, score FROM games WHERE user_id = $1 AND mode = $2 AND status = $3 ORDER BY level ASC',
      [userId, GameMode.CAMPAIGN, GameStatus.FINISHED],
    );
    const { rows: [active] } = await this.pool.query<{ id: string; level: number; score: number }>(
      'SELECT id, level, score FROM games WHERE user_id = $1 AND mode = $2 AND status = $3',
      [userId, GameMode.CAMPAIGN, GameStatus.ACTIVE],
    );

    return {
      completedLevels: completed.map(g => ({ level: g.level, score: g.score })),
      activeGame: active ? { id: active.id, level: active.level, score: active.score } : null,
    };
  }

  private async formatGameResponse(game: GameRow, cells: CellRow[], words: Array<{ word: string; points: number }> = []) {
    let targetScore: number | null = null;
    if (game.mode === GameMode.CAMPAIGN && game.level) {
      const lvl = await this.getCampaignLevel(game.level);
      targetScore = lvl.target_score;
    }
    const hexMap = new Map<string, { id?: string; hexQ: number; hexR: number; slot: number; char: string; points: number; isActive: boolean; lockType: 'gray' | 'blue' | 'purple' | 'orange' | null; variant: string | null }[]>();
    for (const c of cells) {
      const key = `${c.hex_q},${c.hex_r}`;
      if (!hexMap.has(key)) hexMap.set(key, []);
      hexMap.get(key)!.push({
        id: c.id,
        hexQ: c.hex_q,
        hexR: c.hex_r,
        slot: c.slot,
        char: c.char,
        points: c.points,
        isActive: c.is_active,
        lockType: c.lock_type as 'gray' | 'blue' | 'purple' | 'orange' | null,
        variant: c.variant as 'light' | 'dark' | null,
      });
    }

    const hexagons = [...hexMap.entries()].map(([key, hCells]) => {
      const [q, r] = key.split(',').map(Number);
      const hexType = hCells.length === 7 ? 'full' : hCells.length === 4 ? 'edge4' : hCells.length === 3 ? 'edge3' : 'full';
      return { q, r, hexType, cells: hCells.sort((a: { slot: number }, b: { slot: number }) => a.slot - b.slot) };
    });

    return {
      id: game.id,
      mode: game.mode.toLowerCase(),
      complexity: game.complexity?.toLowerCase() ?? null,
      level: game.level,
      status: game.status.toLowerCase(),
      score: game.score,
      wordCount: game.word_count,
      hexCount: game.hex_count,
      cellsPerHex: game.cells_per_hex,
      minWordLength: game.min_word_length,
      colorMode: game.color_mode,
      targetScore,
      hexagons,
      words,
    };
  }
}
