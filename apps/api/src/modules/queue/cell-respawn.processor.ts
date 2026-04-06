import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Pool } from 'pg';
import { PG_POOL, GameStatus } from '../../database';
import type { CellRow } from '../../database';
import { SocketService } from '../socket/socket.service';
import { WeightedLetterGenerator, shouldRespawnVowel, RUSSIAN_VOWELS } from '@hexawords/game-engine';
import type { CellRespawnJobData } from './cell-respawn.service';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

@Processor('cell-respawn')
export class CellRespawnProcessor extends WorkerHost {
  private readonly logger = new Logger(CellRespawnProcessor.name);
  private gen = new WeightedLetterGenerator();

  constructor(
    @Inject(PG_POOL) private pool: Pool,
    private socketService: SocketService,
  ) {
    super();
  }

  async process(job: Job<CellRespawnJobData>) {
    const { gameId, userId, cells } = job.data;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [game] } = await client.query<{ id: string; status: string; color_mode: boolean }>(
        'SELECT id, status, color_mode FROM games WHERE id = $1', [gameId],
      );
      if (!game) {
        await client.query('ROLLBACK');
        return;
      }

      const updatedCells = [];
      for (const coord of cells) {
        const { rows: hexCells } = await client.query<{ char: string; slot: number }>(
          'SELECT char, slot FROM cells WHERE game_id = $1 AND hex_q = $2 AND hex_r = $3 AND is_active = true',
          [gameId, coord.q, coord.r],
        );

        const vowelCount = hexCells.filter(c => c.slot !== coord.slot && RUSSIAN_VOWELS.has(c.char)).length;
        const activeCount = hexCells.filter(c => c.slot !== coord.slot).length;

        const needVowel = shouldRespawnVowel(vowelCount, activeCount);
        const { char, points } = needVowel ? this.gen.generateVowel() : this.gen.generateConsonant();

        const variant = game.color_mode ? (Math.random() < 0.7 ? 'light' : 'dark') : null;
        const { rows: [cell] } = await client.query<CellRow>(
          `UPDATE cells SET char = $1, points = $2, is_active = true, variant = $3
           WHERE game_id = $4 AND hex_q = $5 AND hex_r = $6 AND slot = $7
           RETURNING id, hex_q, hex_r, slot, char, points, variant`,
          [char, points, variant, gameId, coord.q, coord.r, coord.slot],
        );

        if (cell) {
          updatedCells.push({
            id: cell.id,
            hexQ: cell.hex_q,
            hexR: cell.hex_r,
            slot: cell.slot,
            char: cell.char,
            points: cell.points,
            isActive: true,
            variant: cell.variant,
          });
        }
      }

      await client.query('COMMIT');

      // Send cells one by one with delay for animation
      this.logger.log(`Respawning ${updatedCells.length} cells for user ${userId} game ${gameId}`);
      for (const cell of updatedCells) {
        this.socketService.sendToUser(userId, 'cell:respawned', { gameId, cells: [cell] });
        if (cell !== updatedCells[updatedCells.length - 1]) {
          await sleep(150);
        }
      }
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(`Cell respawn failed for game ${gameId}`, err);
      throw err;
    } finally {
      client.release();
    }
  }
}
