import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DictionaryService } from '../dictionary/dictionary.service';
import { SocketService } from '../socket/socket.service';
import { CellRespawnService } from '../queue/cell-respawn.service';
import { GameEngine, WeightedLetterGenerator } from '@hexawords/game-engine';
import { gridForSize } from '@hexawords/hex-math';
import {
  GameMode as GameModeEnum,
  GameComplexity as ComplexityEnum,
  COMPLEXITY_HEX_COUNT,
  CELLS_PER_HEX,
  CAMPAIGN_LEVELS,
} from '@hexawords/types';
import type { WordPathStep } from '@hexawords/types';
import { GameMode, GameComplexity, GameStatus } from '@prisma/client';

@Injectable()
export class GameService {
  private letterGenerator = new WeightedLetterGenerator();

  constructor(
    private prisma: PrismaService,
    private dictionary: DictionaryService,
    private socketService: SocketService,
    private cellRespawnService: CellRespawnService,
  ) {}

  private async ensureUser(userId: string) {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (existing) return existing;
    return this.prisma.user.create({
      data: {
        id: userId,
        profile: { create: { nickname: 'Игрок' } },
        auth: { create: { provider: 'ANONYMOUS' } },
      },
    });
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
    const existing = await this.prisma.game.findFirst({
      where: {
        userId,
        mode: mode.toUpperCase() as GameMode,
        status: GameStatus.ACTIVE,
        ...(mode === GameModeEnum.CAMPAIGN ? { level } : { complexity: complexity?.toUpperCase() as GameComplexity }),
      },
      include: { cells: true },
    });

    if (existing) {
      return this.formatGameResponse(existing, existing.cells);
    }

    // Generate new game
    const engine = this.createEngine();
    const state = engine.createInitialState({ mode, hexCount, cellsPerHex: CELLS_PER_HEX });
    const hexCoords = gridForSize(hexCount);

    const game = await this.prisma.$transaction(async (tx) => {
      const game = await tx.game.create({
        data: {
          userId,
          mode: mode.toUpperCase() as GameMode,
          complexity: complexity ? complexity.toUpperCase() as GameComplexity : null,
          level: level ?? null,
          hexCount,
          cellsPerHex: CELLS_PER_HEX,
        },
      });

      const cellData: Array<{ gameId: string; hexQ: number; hexR: number; slot: number; char: string; points: number }> = [];
      for (const coord of hexCoords) {
        const hexCells = state.hexagons.get(`${coord.q},${coord.r}`);
        if (!hexCells) continue;
        for (const cell of hexCells) {
          cellData.push({
            gameId: game.id,
            hexQ: coord.q,
            hexR: coord.r,
            slot: cell.slot,
            char: cell.char,
            points: cell.points,
          });
        }
      }

      await tx.cell.createMany({ data: cellData });
      const cells = await tx.cell.findMany({ where: { gameId: game.id } });
      return { ...game, cells };
    });

    return this.formatGameResponse(game, game.cells);
  }

  async submitWord(userId: string, gameId: string, path: WordPathStep[]) {
    const txResult = await this.prisma.$transaction(async (tx) => {
      const game = await tx.game.findFirst({
        where: { id: gameId, userId, status: GameStatus.ACTIVE },
        include: { cells: true },
      });

      if (!game) throw new NotFoundException('Active game not found');

      // Build engine state from DB
      const hexagons = new Map<string, any[]>();
      for (const cell of game.cells) {
        const key = `${cell.hexQ},${cell.hexR}`;
        if (!hexagons.has(key)) hexagons.set(key, []);
        hexagons.get(key)!.push({
          hexQ: cell.hexQ,
          hexR: cell.hexR,
          slot: cell.slot,
          char: cell.char,
          points: cell.points,
          isActive: cell.isActive,
        });
      }

      // Sort each hexagon's cells by slot
      for (const cells of hexagons.values()) {
        cells.sort((a: any, b: any) => a.slot - b.slot);
      }

      const engine = this.createEngine();
      const engineState = {
        hexagons,
        score: game.score,
        wordCount: game.wordCount,
        wordsFound: new Set<string>(),
        status: 'active' as const,
      };

      const foundWords = await tx.gameWord.findMany({
        where: { gameId },
        select: { word: true },
      });
      for (const { word } of foundWords) {
        engineState.wordsFound.add(word);
      }

      const result = await engine.submitWord(engineState, { path });

      if (!result.valid) {
        return { valid: false, word: result.word, reason: result.reason };
      }

      // Deactivate consumed cells
      for (const step of result.consumedCells) {
        await tx.cell.update({
          where: { gameId_hexQ_hexR_slot: { gameId, hexQ: step.hexQ, hexR: step.hexR, slot: step.slot } },
          data: { isActive: false },
        });
      }

      // Record the word
      await tx.gameWord.create({
        data: {
          gameId,
          word: result.word,
          points: result.points,
          cellPath: path as any,
        },
      });

      // Update game score
      await tx.game.update({
        where: { id: gameId },
        data: {
          score: { increment: result.points },
          wordCount: { increment: 1 },
        },
      });

      // Record in user history
      await tx.userWordHistory.create({
        data: { userId, word: result.word, points: result.points, mode: game.mode },
      });

      // Increment word discovery frequency (for rarity scoring)
      await this.dictionary.incrementFreq(result.word);

      // Check campaign completion
      let campaignComplete = false;
      if (game.mode === GameMode.CAMPAIGN && game.level) {
        const level = CAMPAIGN_LEVELS.find(l => l.level === game.level);
        if (level && engine.checkCampaignCompletion(engineState, level.targetScore)) {
          await tx.game.update({
            where: { id: gameId },
            data: { status: GameStatus.FINISHED, finishedAt: new Date() },
          });
          campaignComplete = true;
        }
      }

      this.socketService.sendToUser(userId, 'score:update', {
        gameId,
        score: game.score + result.points,
        wordCount: game.wordCount + 1,
        word: result.word,
        wordPoints: result.points,
      });

      if (campaignComplete) {
        this.socketService.sendToUser(userId, 'game:finished', {
          gameId,
          finalScore: game.score + result.points,
          wordsFound: game.wordCount + 1,
        });
      }

      return {
        valid: true,
        word: result.word,
        points: result.points,
        consumedCells: result.consumedCells,
        totalScore: game.score + result.points,
        campaignComplete,
      };
    });

    if (txResult.valid && txResult.consumedCells && txResult.consumedCells.length > 0) {
      await this.cellRespawnService.enqueueRespawn({
        gameId,
        userId,
        cells: txResult.consumedCells.map((c: any) => ({ q: c.hexQ, r: c.hexR, slot: c.slot })),
      });
    }

    return txResult;
  }

  async resetGame(userId: string, gameId: string) {
    const game = await this.prisma.game.findFirst({
      where: { id: gameId, userId, status: GameStatus.ACTIVE },
      include: { cells: true },
    });
    if (!game) throw new NotFoundException('Active game not found');

    const engine = this.createEngine();
    const newState = engine.createInitialState({
      mode: game.mode.toLowerCase() as any,
      hexCount: game.hexCount,
      cellsPerHex: game.cellsPerHex,
    });

    const newScore = 0;
    const newWordCount = 0;

    await this.prisma.$transaction(async (tx) => {
      // Replace all cells with fresh letters
      for (const [hexKey, cells] of newState.hexagons) {
        for (const cell of cells) {
          await tx.cell.update({
            where: {
              gameId_hexQ_hexR_slot: {
                gameId,
                hexQ: cell.hexQ,
                hexR: cell.hexR,
                slot: cell.slot,
              },
            },
            data: { char: cell.char, points: cell.points, isActive: true },
          });
        }
      }

      await tx.game.update({
        where: { id: gameId },
        data: { score: newScore, wordCount: newWordCount },
      });

      // Clear found words (so they can be found again on fresh board)
      await tx.gameWord.deleteMany({ where: { gameId } });
    });

    const updatedCells = await this.prisma.cell.findMany({ where: { gameId } });
    return this.formatGameResponse(
      { ...game, score: newScore, wordCount: newWordCount },
      updatedCells,
    );
  }

  async getGame(userId: string, gameId: string) {
    const game = await this.prisma.game.findFirst({
      where: { id: gameId, userId },
      include: { cells: true },
    });
    if (!game) throw new NotFoundException('Game not found');
    return this.formatGameResponse(game, game.cells);
  }

  async getCampaignProgress(userId: string) {
    const completed = await this.prisma.game.findMany({
      where: { userId, mode: 'CAMPAIGN', status: 'FINISHED' },
      select: { level: true, score: true },
      orderBy: { level: 'asc' },
    });
    const active = await this.prisma.game.findFirst({
      where: { userId, mode: 'CAMPAIGN', status: 'ACTIVE' },
      select: { id: true, level: true, score: true },
    });
    return {
      completedLevels: completed.map(g => ({ level: g.level!, score: g.score })),
      activeGame: active ? { id: active.id, level: active.level!, score: active.score } : null,
    };
  }

  private formatGameResponse(game: any, cells: any[]) {
    // Group cells by hexagon
    const hexMap = new Map<string, any[]>();
    for (const c of cells) {
      const key = `${c.hexQ},${c.hexR}`;
      if (!hexMap.has(key)) hexMap.set(key, []);
      hexMap.get(key)!.push({
        id: c.id,
        hexQ: c.hexQ,
        hexR: c.hexR,
        slot: c.slot,
        char: c.char,
        points: c.points,
        isActive: c.isActive,
      });
    }

    // Sort cells within each hexagon by slot
    const hexagons = [...hexMap.entries()].map(([key, hCells]) => {
      const [q, r] = key.split(',').map(Number);
      return {
        q,
        r,
        cells: hCells.sort((a: any, b: any) => a.slot - b.slot),
      };
    });

    return {
      id: game.id,
      mode: game.mode.toLowerCase(),
      complexity: game.complexity?.toLowerCase() ?? null,
      level: game.level,
      status: game.status.toLowerCase(),
      score: game.score,
      wordCount: game.wordCount,
      hexCount: game.hexCount,
      cellsPerHex: game.cellsPerHex,
      hexagons,
    };
  }
}
