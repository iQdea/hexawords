import { Controller, Post, Get, Body, Param, Req, Res, UseGuards, BadRequestException } from '@nestjs/common';
import { GameService } from './game.service';
import { AuthService } from '../auth/auth.service';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import type { GameComplexity, GameMode, WordPathStep } from '@hexawords/types';
import type { AuthenticatedRequest } from '../../common/types';
import type { Response } from 'express';

@Controller('games')
@UseGuards(OptionalAuthGuard)
export class GameController {
  constructor(
    private gameService: GameService,
    private authService: AuthService,
  ) {}

  /** Get userId from JWT or auto-create anonymous user. */
  private async resolveUserId(req: AuthenticatedRequest, res: Response): Promise<string> {
    if (req.user?.userId) return req.user.userId;
    const headerUserId = req.headers['x-user-id'] as string | undefined;
    if (headerUserId) return headerUserId;

    // No auth — auto-create anonymous user and set cookies
    const { userId, accessToken, refreshToken } = await this.authService.createAnonymousUser();
    this.authService.setTokenCookies(res, accessToken, refreshToken);
    return userId;
  }

  @Post('new')
  async createGame(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { mode: GameMode; complexity?: GameComplexity; level?: number },
  ) {
    const userId = await this.resolveUserId(req, res);
    const result = await this.gameService.createGame(userId, body.mode, body.complexity, body.level);
    return { ...result, userId };
  }

  @Post(':id/submit-word')
  async submitWord(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') gameId: string,
    @Body() body: { path: WordPathStep[] },
  ) {
    const userId = await this.resolveUserId(req, res);
    return this.gameService.submitWord(userId, gameId, body.path);
  }

  @Post(':id/reset')
  async resetGame(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') gameId: string,
  ) {
    const userId = await this.resolveUserId(req, res);
    return this.gameService.resetGame(userId, gameId);
  }

  @Get('campaign/levels')
  getCampaignLevels() {
    return this.gameService.getCampaignLevels();
  }

  @Get('campaign/progress')
  async getCampaignProgress(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = await this.resolveUserId(req, res);
    return this.gameService.getCampaignProgress(userId);
  }

  @Get(':id')
  async getGame(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') gameId: string,
  ) {
    const userId = await this.resolveUserId(req, res);
    return this.gameService.getGame(userId, gameId);
  }
}
