import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      nickname: user.profile?.nickname ?? 'Игрок',
      avatarUrl: user.profile?.avatarUrl ?? null,
      region: user.region,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateProfile(userId: string, data: { nickname?: string }) {
    await this.prisma.userProfile.upsert({
      where: { userId },
      update: { nickname: data.nickname },
      create: { userId, nickname: data.nickname ?? 'Игрок' },
    });
    return this.getProfile(userId);
  }

  async getStats(userId: string) {
    const [gamesPlayed, totalScore, totalWords, bestGame, campaignCompleted] = await Promise.all([
      this.prisma.game.count({ where: { userId } }),
      this.prisma.game.aggregate({ where: { userId }, _sum: { score: true } }),
      this.prisma.game.aggregate({ where: { userId }, _sum: { wordCount: true } }),
      this.prisma.game.findFirst({
        where: { userId },
        orderBy: { score: 'desc' },
        select: { score: true, mode: true, complexity: true },
      }),
      this.prisma.game.count({
        where: { userId, mode: 'CAMPAIGN', status: 'FINISHED' },
      }),
    ]);

    return {
      gamesPlayed,
      totalScore: totalScore._sum.score ?? 0,
      totalWords: totalWords._sum.wordCount ?? 0,
      bestGameScore: bestGame?.score ?? 0,
      campaignLevelsCompleted: campaignCompleted,
    };
  }

  async getWordHistory(userId: string, limit = 50, offset = 0) {
    const [words, total] = await Promise.all([
      this.prisma.userWordHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: { word: true, points: true, mode: true, createdAt: true },
      }),
      this.prisma.userWordHistory.count({ where: { userId } }),
    ]);

    return {
      words: words.map(w => ({
        word: w.word,
        points: w.points,
        mode: w.mode.toLowerCase(),
        createdAt: w.createdAt.toISOString(),
      })),
      total,
    };
  }
}
