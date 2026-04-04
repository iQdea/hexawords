import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { SocketService } from '../socket/socket.service';
import { WeightedLetterGenerator, shouldRespawnVowel, RUSSIAN_VOWELS } from '@hexawords/game-engine';
import type { CellRespawnJobData } from './cell-respawn.service';

@Processor('cell-respawn')
export class CellRespawnProcessor extends WorkerHost {
  private readonly logger = new Logger(CellRespawnProcessor.name);
  private gen = new WeightedLetterGenerator();

  constructor(
    private prisma: PrismaService,
    private socketService: SocketService,
  ) {
    super();
  }

  async process(job: Job<CellRespawnJobData>) {
    const { gameId, userId, cells } = job.data;

    try {
      const updatedCells = await this.prisma.$transaction(async (tx) => {
        const game = await tx.game.findUnique({ where: { id: gameId } });
        if (!game || game.status !== 'ACTIVE') return [];

        const result = [];
        for (const coord of cells) {
          // Get current hex cells to check vowel balance
          const hexCells = await tx.cell.findMany({
            where: { gameId, hexQ: coord.q, hexR: coord.r, isActive: true },
            select: { char: true, slot: true },
          });

          const vowelCount = hexCells.filter(
            c => c.slot !== coord.slot && RUSSIAN_VOWELS.has(c.char)
          ).length;
          const activeCount = hexCells.filter(c => c.slot !== coord.slot).length;

          const needVowel = shouldRespawnVowel(vowelCount, activeCount);
          const { char, points } = needVowel
            ? this.gen.generateVowel()
            : this.gen.generateConsonant();

          const cell = await tx.cell.update({
            where: {
              gameId_hexQ_hexR_slot: {
                gameId,
                hexQ: coord.q,
                hexR: coord.r,
                slot: coord.slot,
              },
            },
            data: { char, points, isActive: true },
          });

          result.push({
            id: cell.id,
            hexQ: cell.hexQ,
            hexR: cell.hexR,
            slot: cell.slot,
            char: cell.char,
            points: cell.points,
            isActive: true,
          });
        }
        return result;
      });

      if (updatedCells.length > 0) {
        this.socketService.sendToUser(userId, 'cell:respawned', {
          gameId,
          cells: updatedCells,
        });
      }
    } catch (err) {
      this.logger.error(`Cell respawn failed for game ${gameId}`, err);
      throw err;
    }
  }
}
