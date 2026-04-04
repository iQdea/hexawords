import { Controller, Get, Query } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private leaderboard: LeaderboardService) {}

  @Get()
  async getLeaderboard(
    @Query('limit') limit?: string,
    @Query('period') period?: 'week' | 'month' | 'all',
  ) {
    return this.leaderboard.getBestScores(
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
