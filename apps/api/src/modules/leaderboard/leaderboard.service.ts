import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database';

@Injectable()
export class LeaderboardService {
  constructor(@Inject(PG_POOL) private pool: Pool) {}

  async getBestScores(limit = 20) {
    const { rows } = await this.pool.query<{
      user_id: string; nickname: string | null; avatar_url: string | null;
      score: number; word_count: number; mode: string; complexity: string | null;
    }>(
      `SELECT g.user_id, p.nickname, p.avatar_url, g.score, g.word_count, g.mode, g.complexity
       FROM games g LEFT JOIN user_profiles p ON p.user_id = g.user_id
       WHERE g.score > 0 ORDER BY g.score DESC LIMIT $1`,
      [limit],
    );

    return rows.map((g, i) => ({
      rank: i + 1,
      userId: g.user_id,
      nickname: g.nickname ?? 'Игрок',
      score: g.score,
      wordCount: g.word_count,
      mode: g.mode.toLowerCase(),
      complexity: g.complexity?.toLowerCase() ?? null,
    }));
  }
}
