import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  async getTopPlayers(limit = 20, period?: 'week' | 'month' | 'all') {
    const dateFilter = this.getDateFilter(period);

    const results = await this.prisma.game.groupBy({
      by: ['userId'],
      where: {
        status: 'FINISHED',
        ...(dateFilter ? { finishedAt: { gte: dateFilter } } : {}),
      },
      _sum: { score: true },
      _count: { id: true },
      orderBy: { _sum: { score: 'desc' } },
      take: limit,
    });

    // Fetch user profiles
    const userIds = results.map(r => r.userId);
    const profiles = await this.prisma.userProfile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, nickname: true, avatarUrl: true },
    });

    const profileMap = new Map(profiles.map(p => [p.userId, p]));

    return results.map((r, i) => {
      const profile = profileMap.get(r.userId);
      return {
        rank: i + 1,
        userId: r.userId,
        nickname: profile?.nickname ?? 'Игрок',
        avatarUrl: profile?.avatarUrl ?? null,
        totalPoints: r._sum.score ?? 0,
        gamesPlayed: r._count.id,
      };
    });
  }

  /** Also include active games in a simplified "best scores" leaderboard. */
  async getBestScores(limit = 20) {
    const games = await this.prisma.game.findMany({
      where: { score: { gt: 0 } },
      orderBy: { score: 'desc' },
      take: limit,
      include: {
        user: { include: { profile: true } },
      },
    });

    return games.map((g, i) => ({
      rank: i + 1,
      userId: g.userId,
      nickname: g.user.profile?.nickname ?? 'Игрок',
      score: g.score,
      wordCount: g.wordCount,
      mode: g.mode.toLowerCase(),
      complexity: g.complexity?.toLowerCase() ?? null,
    }));
  }

  private getDateFilter(period?: string): Date | null {
    if (!period || period === 'all') return null;
    const now = new Date();
    if (period === 'week') {
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    if (period === 'month') {
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    return null;
  }
}
