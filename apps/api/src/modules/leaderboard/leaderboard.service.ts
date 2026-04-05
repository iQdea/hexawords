import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL, GameStatus } from '../../database';

@Injectable()
export class LeaderboardService {
  constructor(@Inject(PG_POOL) private pool: Pool) {}

  async getTopPlayers(limit = 20, period?: 'week' | 'month' | 'all') {
    const dateFilter = this.getDateFilter(period);
    const params: (string | number | Date)[] = [GameStatus.FINISHED];
    let sql = `SELECT user_id, SUM(score) as total_points, COUNT(id) as games_played
               FROM games WHERE status = $1`;

    if (dateFilter) {
      params.push(dateFilter);
      sql += ` AND finished_at >= $${params.length}`;
    }

    params.push(limit);
    sql += ` GROUP BY user_id ORDER BY total_points DESC LIMIT $${params.length}`;

    const { rows: results } = await this.pool.query<{
      user_id: string; total_points: string; games_played: string;
    }>(sql, params);

    const userIds = results.map(r => r.user_id);
    let profiles: Array<{ user_id: string; nickname: string; avatar_url: string | null }> = [];
    if (userIds.length > 0) {
      const { rows } = await this.pool.query<{ user_id: string; nickname: string; avatar_url: string | null }>(
        `SELECT user_id, nickname, avatar_url FROM user_profiles WHERE user_id = ANY($1)`,
        [userIds],
      );
      profiles = rows;
    }
    const profileMap = new Map(profiles.map(p => [p.user_id, p]));

    return results.map((r, i) => {
      const profile = profileMap.get(r.user_id);
      return {
        rank: i + 1,
        userId: r.user_id,
        nickname: profile?.nickname ?? 'Игрок',
        avatarUrl: profile?.avatar_url ?? null,
        totalPoints: Number(r.total_points) || 0,
        gamesPlayed: Number(r.games_played) || 0,
      };
    });
  }

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

  private getDateFilter(period?: string): Date | null {
    if (!period || period === 'all') return null;
    const now = new Date();
    if (period === 'week') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (period === 'month') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return null;
  }
}
