import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL, GameMode, GameStatus, AuthProvider } from '../../database';
import type { GameRow, CellRow } from '../../database';
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
  CAMPAIGN_LEVELS,
} from '@hexawords/types';
import type { WordPathStep } from '@hexawords/types';

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

    if (mode === GameModeEnum.CAMPAIGN) {
      const campaignLevel = CAMPAIGN_LEVELS.find(l => l.level === level);
      if (!campaignLevel) throw new BadRequestException(`Invalid campaign level: ${level}`);
      hexCount = campaignLevel.hexCount;
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
      return this.formatGameResponse(game, cells, words);
    }

    // Generate new game
    const engine = this.createEngine();
    const state = engine.createInitialState({ mode, hexCount, cellsPerHex: CELLS_PER_HEX });
    const hexCoords = gridForSize(hexCount);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [game] } = await client.query<GameRow>(
        `INSERT INTO games (user_id, mode, complexity, level, hex_count, cells_per_hex)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [userId, modeUpper, complexity ? complexity.toString().toUpperCase() : null, level ?? null, hexCount, CELLS_PER_HEX],
      );

      // Build cell values
      const cellValues: (string | number)[] = [];
      const placeholders: string[] = [];
      let idx = 1;
      for (const coord of hexCoords) {
        const hexCells = state.hexagons.get(`${coord.q},${coord.r}`);
        if (!hexCells) continue;
        for (const cell of hexCells) {
          placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5})`);
          cellValues.push(game.id, coord.q, coord.r, cell.slot, cell.char, cell.points);
          idx += 6;
        }
      }

      await client.query(
        `INSERT INTO cells (game_id, hex_q, hex_r, slot, char, points) VALUES ${placeholders.join(', ')}`,
        cellValues,
      );

      const { rows: cells } = await client.query<CellRow>('SELECT * FROM cells WHERE game_id = $1', [game.id]);

      await client.query('COMMIT');
      return this.formatGameResponse(game, cells);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async submitWord(userId: string, gameId: string, path: WordPathStep[]) {
    const client = await this.pool.connect();
    let txResult: { valid: boolean; word: string; reason?: string; points?: number; consumedCells?: Array<{ hexQ: number; hexR: number; slot: number }>; totalScore?: number; campaignComplete?: boolean };
    try {
      await client.query('BEGIN');

      const { rows: [game] } = await client.query<GameRow>(
        'SELECT * FROM games WHERE id = $1 AND user_id = $2 AND status = $3',
        [gameId, userId, GameStatus.ACTIVE],
      );
      if (!game) throw new NotFoundException('Active game not found');

      const { rows: dbCells } = await client.query<CellRow>('SELECT * FROM cells WHERE game_id = $1', [gameId]);

      // Build engine state
      const hexagons = new Map<string, { id?: string; hexQ: number; hexR: number; slot: number; char: string; points: number; isActive: boolean }[]>();
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

      const result = await engine.submitWord(engineState, { path });

      if (!result.valid) {
        await client.query('ROLLBACK');
        txResult = { valid: false, word: result.word, reason: result.reason };
        return txResult;
      }

      // Deactivate consumed cells
      for (const step of result.consumedCells) {
        await client.query(
          'UPDATE cells SET is_active = false WHERE game_id = $1 AND hex_q = $2 AND hex_r = $3 AND slot = $4',
          [gameId, step.hexQ, step.hexR, step.slot],
        );
      }

      // Record the word
      await client.query(
        'INSERT INTO game_words (game_id, word, points, cell_path) VALUES ($1, $2, $3, $4)',
        [gameId, result.word, result.points, JSON.stringify(path)],
      );

      // Update game score
      await client.query(
        'UPDATE games SET score = score + $1, word_count = word_count + 1 WHERE id = $2',
        [result.points, gameId],
      );

      // Record in user history
      await client.query(
        'INSERT INTO user_word_history (user_id, word, points, mode) VALUES ($1, $2, $3, $4)',
        [userId, result.word, result.points, game.mode],
      );

      // Increment word discovery frequency
      await this.dictionary.incrementFreq(result.word);

      // Check campaign completion
      let campaignComplete = false;
      if (game.mode === GameMode.CAMPAIGN && game.level) {
        const lvl = CAMPAIGN_LEVELS.find(l => l.level === game.level);
        if (lvl && engine.checkCampaignCompletion(engineState, lvl.targetScore)) {
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
        score: game.score + result.points,
        wordCount: game.word_count + 1,
        word: result.word,
        wordPoints: result.points,
      });

      if (campaignComplete) {
        this.socketService.sendToUser(userId, 'game:finished', {
          gameId,
          finalScore: game.score + result.points,
          wordsFound: game.word_count + 1,
        });
      }

      await client.query('COMMIT');

      txResult = {
        valid: true,
        word: result.word,
        points: result.points,
        consumedCells: result.consumedCells,
        totalScore: game.score + result.points,
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

      for (const [, cells] of newState.hexagons) {
        for (const cell of cells) {
          await client.query(
            'UPDATE cells SET char = $1, points = $2, is_active = true WHERE game_id = $3 AND hex_q = $4 AND hex_r = $5 AND slot = $6',
            [cell.char, cell.points, gameId, cell.hexQ, cell.hexR, cell.slot],
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
    return this.formatGameResponse({ ...game, score: 0, word_count: 0 }, updatedCells);
  }

  async getGame(userId: string, gameId: string) {
    const { rows: [game] } = await this.pool.query<GameRow>(
      'SELECT * FROM games WHERE id = $1 AND user_id = $2', [gameId, userId],
    );
    if (!game) throw new NotFoundException('Game not found');

    const { rows: cells } = await this.pool.query<CellRow>('SELECT * FROM cells WHERE game_id = $1', [game.id]);
    const { rows: words } = await this.pool.query<{ word: string; points: number }>('SELECT word, points FROM game_words WHERE game_id = $1 ORDER BY points DESC, created_at ASC', [game.id]);
    return this.formatGameResponse(game, cells, words);
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

  private formatGameResponse(game: GameRow, cells: CellRow[], words: Array<{ word: string; points: number }> = []) {
    const hexMap = new Map<string, { id?: string; hexQ: number; hexR: number; slot: number; char: string; points: number; isActive: boolean }[]>();
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
      });
    }

    const hexagons = [...hexMap.entries()].map(([key, hCells]) => {
      const [q, r] = key.split(',').map(Number);
      return { q, r, cells: hCells.sort((a: { slot: number }, b: { slot: number }) => a.slot - b.slot) };
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
      hexagons,
      words,
    };
  }
}
