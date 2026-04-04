import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface CellRespawnJobData {
  gameId: string;
  userId: string;
  cells: Array<{ q: number; r: number; slot: number }>;
}

@Injectable()
export class CellRespawnService {
  constructor(@InjectQueue('cell-respawn') private queue: Queue) {}

  async enqueueRespawn(data: CellRespawnJobData, delayMs = 500) {
    await this.queue.add('respawn', data, { delay: delayMs });
  }
}
