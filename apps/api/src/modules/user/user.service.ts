import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL, GameMode, GameStatus } from '../../database';

@Injectable()
export class UserService {
  constructor(@Inject(PG_POOL) private pool: Pool) {}

  async getProfile(userId: string) {
    const { rows } = await this.pool.query<{
      id: string;
      nickname: string | null;
      avatar_url: string | null;
      region: string;
      created_at: Date;
    }>(
      `SELECT u.id, p.nickname, p.avatar_url, u.region, u.created_at
       FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );
    if (rows.length === 0) throw new NotFoundException('User not found');
    const row = rows[0];

    return {
      id: row.id,
      nickname: row.nickname ?? 'Игрок',
      avatarUrl: row.avatar_url ?? null,
      region: row.region,
      createdAt: row.created_at.toISOString(),
    };
  }

  async updateProfile(userId: string, data: { nickname?: string }) {
    const { rows } = await this.pool.query('SELECT id FROM user_profiles WHERE user_id = $1', [userId]);

    if (rows.length > 0) {
      if (data.nickname) {
        await this.pool.query('UPDATE user_profiles SET nickname = $1 WHERE user_id = $2', [data.nickname, userId]);
      }
    } else {
      await this.pool.query(
        'INSERT INTO user_profiles (user_id, nickname) VALUES ($1, $2)',
        [userId, data.nickname ?? 'Игрок'],
      );
    }

    return this.getProfile(userId);
  }

  async getStats(userId: string) {
    const gamesPlayed = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM games WHERE user_id = $1', [userId],
    );
    const agg = await this.pool.query<{ total_score: string; total_words: string }>(
      'SELECT COALESCE(SUM(score), 0) as total_score, COALESCE(SUM(word_count), 0) as total_words FROM games WHERE user_id = $1',
      [userId],
    );
    const bestGame = await this.pool.query<{ score: number }>(
      'SELECT score FROM games WHERE user_id = $1 ORDER BY score DESC LIMIT 1', [userId],
    );
    const campaignCompleted = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM games WHERE user_id = $1 AND mode = $2 AND status = $3',
      [userId, GameMode.CAMPAIGN, GameStatus.FINISHED],
    );

    return {
      gamesPlayed: Number(gamesPlayed.rows[0].count),
      totalScore: Number(agg.rows[0].total_score),
      totalWords: Number(agg.rows[0].total_words),
      bestGameScore: bestGame.rows[0]?.score ?? 0,
      campaignLevelsCompleted: Number(campaignCompleted.rows[0].count),
    };
  }

  async getWordHistory(userId: string, limit = 50, offset = 0) {
    const words = await this.pool.query<{ word: string; points: number; mode: string; created_at: Date }>(
      'SELECT word, points, mode, created_at FROM user_word_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset],
    );
    const total = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM user_word_history WHERE user_id = $1',
      [userId],
    );

    return {
      words: words.rows.map(w => ({
        word: w.word,
        points: w.points,
        mode: w.mode.toLowerCase(),
        createdAt: w.created_at.toISOString(),
      })),
      total: Number(total.rows[0].count),
    };
  }
}
