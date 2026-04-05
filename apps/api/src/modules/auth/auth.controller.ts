import { Controller, Post, Get, Body, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/types';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('anonymous')
  async createAnonymous(@Res({ passthrough: true }) res: Response) {
    const { userId, accessToken, refreshToken } = await this.authService.createAnonymousUser();
    this.authService.setTokenCookies(res, accessToken, refreshToken);
    return { userId };
  }

  @Post('sign-up')
  async signUp(
    @Body() body: { email: string; password: string; nickname?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { userId, accessToken, refreshToken } = await this.authService.signUp(
      body.email,
      body.password,
      body.nickname,
    );
    this.authService.setTokenCookies(res, accessToken, refreshToken);
    return { userId };
  }

  @Post('sign-in')
  async signIn(
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { userId, accessToken, refreshToken } = await this.authService.signIn(
      body.email,
      body.password,
    );
    this.authService.setTokenCookies(res, accessToken, refreshToken);
    return { userId };
  }

  @Post('upgrade')
  @UseGuards(JwtAuthGuard)
  async upgrade(
    @Req() req: Request,
    @Body() body: { email: string; password: string; nickname?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = (req as AuthenticatedRequest).user.userId;
    const { accessToken, refreshToken } = await this.authService.upgradeAnonymous(
      userId,
      body.email,
      body.password,
      body.nickname,
    );
    this.authService.setTokenCookies(res, accessToken, refreshToken);
    return { userId };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    return (req as AuthenticatedRequest).user;
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.['refresh_token'];
    if (!refreshToken) return { error: 'No refresh token' };

    try {
      const decoded = JSON.parse(
        Buffer.from(refreshToken.split('.')[1], 'base64').toString(),
      );
      const tokens = await this.authService.refreshTokens(decoded.sub);
      this.authService.setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
      return { userId: decoded.sub };
    } catch {
      this.authService.clearTokenCookies(res);
      return { error: 'Invalid refresh token' };
    }
  }

  @Post('sign-out')
  signOut(@Res({ passthrough: true }) res: Response) {
    this.authService.clearTokenCookies(res);
    return { ok: true };
  }
}
