import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import type { Response } from 'express';

export interface TokenPayload {
  sub: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  /** Create anonymous user and return JWT tokens. */
  async createAnonymousUser() {
    const user = await this.prisma.user.create({
      data: {
        profile: { create: { nickname: 'Игрок' } },
        auth: { create: { provider: 'ANONYMOUS' } },
      },
    });

    return this.issueTokens(user.id, 'anonymous');
  }

  /** Register with email + password. */
  async signUp(email: string, password: string, nickname?: string) {
    const existing = await this.prisma.userAuth.findFirst({ where: { email } });
    if (existing) throw new BadRequestException('Email уже зарегистрирован');

    if (password.length < 6) throw new BadRequestException('Пароль должен быть не менее 6 символов');

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: {
        profile: { create: { nickname: nickname || 'Игрок' } },
        auth: { create: { email, passwordHash, provider: 'EMAIL_PASSWORD', isVerified: true } },
      },
    });

    return this.issueTokens(user.id, 'customer');
  }

  /** Sign in with email + password. */
  async signIn(email: string, password: string) {
    const auth = await this.prisma.userAuth.findFirst({
      where: { email, provider: 'EMAIL_PASSWORD' },
    });

    if (!auth || !auth.passwordHash) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const valid = await bcrypt.compare(password, auth.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    return this.issueTokens(auth.userId, 'customer');
  }

  /** Upgrade anonymous account to email+password. Preserves all game data. */
  async upgradeAnonymous(userId: string, email: string, password: string, nickname?: string) {
    const auth = await this.prisma.userAuth.findUnique({ where: { userId } });
    if (!auth) throw new BadRequestException('Пользователь не найден');
    if (auth.provider !== 'ANONYMOUS') throw new BadRequestException('Аккаунт уже привязан');

    const existing = await this.prisma.userAuth.findFirst({ where: { email } });
    if (existing) throw new BadRequestException('Email уже зарегистрирован');

    if (password.length < 6) throw new BadRequestException('Пароль должен быть не менее 6 символов');

    const passwordHash = await bcrypt.hash(password, 12);

    await this.prisma.$transaction([
      this.prisma.userAuth.update({
        where: { userId },
        data: { email, passwordHash, provider: 'EMAIL_PASSWORD', isVerified: true },
      }),
      ...(nickname
        ? [this.prisma.userProfile.update({ where: { userId }, data: { nickname } })]
        : []),
    ]);

    return this.issueTokens(userId, 'customer');
  }

  /** Refresh tokens. */
  async refreshTokens(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { auth: { select: { provider: true } } },
    });
    if (!user) throw new Error('User not found');

    const role = user.auth?.provider === 'EMAIL_PASSWORD' ? 'customer' : 'anonymous';
    return this.issueTokens(userId, role);
  }

  private async issueTokens(userId: string, role: string) {
    const payload: TokenPayload = { sub: userId, role };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, {
      expiresIn: this.config.get('JWT_REFRESH_EXPIRATION', '7d'),
    });

    await this.prisma.userAuth.update({
      where: { userId },
      data: { refreshToken },
    });

    return { userId, accessToken, refreshToken };
  }

  /** Set JWT cookies on response. */
  setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProduction = this.config.get('NODE_ENV') === 'production';

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  clearTokenCookies(res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
  }
}
