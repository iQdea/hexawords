import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
import { GameService } from './game.service';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import type { GameComplexity, GameMode, WordPathStep } from '@hexawords/types';
import type { Request } from 'express';

/** Extract userId from JWT payload or X-User-Id header. */
function getUserId(req: Request): string {
  const user = (req as any).user;
  if (user?.userId) return user.userId;
  return req.headers['x-user-id'] as string ?? '';
}

@Controller('games')
@UseGuards(OptionalAuthGuard)
export class GameController {
  constructor(private gameService: GameService) {}

  @Post('new')
  async createGame(
    @Req() req: Request,
    @Body() body: { mode: GameMode; complexity?: GameComplexity; level?: number },
  ) {
    const userId = getUserId(req);
    const result = await this.gameService.createGame(userId, body.mode, body.complexity, body.level);
    return { ...result, userId };
  }

  @Post(':id/submit-word')
  async submitWord(
    @Req() req: Request,
    @Param('id') gameId: string,
    @Body() body: { path: WordPathStep[] },
  ) {
    const userId = getUserId(req);
    return this.gameService.submitWord(userId, gameId, body.path);
  }

  @Post(':id/reset')
  async resetGame(@Req() req: Request, @Param('id') gameId: string) {
    const userId = getUserId(req);
    return this.gameService.resetGame(userId, gameId);
  }

  @Get('campaign/progress')
  async getCampaignProgress(@Req() req: Request) {
    const userId = getUserId(req);
    return this.gameService.getCampaignProgress(userId);
  }

  @Get(':id')
  async getGame(@Req() req: Request, @Param('id') gameId: string) {
    const userId = getUserId(req);
    return this.gameService.getGame(userId, gameId);
  }
}
