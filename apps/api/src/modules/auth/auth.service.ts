import { Inject, Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_POOL, AuthProvider } from '../../database';
import type { UserAuthRow } from '../../database';
import * as bcrypt from 'bcrypt';
import type { Response } from 'express';

export interface TokenPayload {
  sub: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PG_POOL) private pool: Pool,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async createAnonymousUser() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [user] } = await client.query<{ id: string }>('INSERT INTO users DEFAULT VALUES RETURNING id');
      await client.query('INSERT INTO user_profiles (user_id, nickname) VALUES ($1, $2)', [user.id, 'Игрок']);
      await client.query('INSERT INTO user_auth (user_id, provider) VALUES ($1, $2)', [user.id, AuthProvider.ANONYMOUS]);
      await client.query('COMMIT');
      return this.issueTokens(user.id, 'anonymous');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async signUp(email: string, password: string, nickname?: string) {
    const { rows } = await this.pool.query<{ id: string }>('SELECT id FROM user_auth WHERE email = $1', [email]);
    if (rows.length > 0) throw new BadRequestException('Email уже зарегистрирован');

    if (password.length < 6) throw new BadRequestException('Пароль должен быть не менее 6 символов');

    const passwordHash = await bcrypt.hash(password, 12);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [user] } = await client.query<{ id: string }>('INSERT INTO users DEFAULT VALUES RETURNING id');
      await client.query('INSERT INTO user_profiles (user_id, nickname) VALUES ($1, $2)', [user.id, nickname || 'Игрок']);
      await client.query(
        'INSERT INTO user_auth (user_id, email, password_hash, provider, is_verified) VALUES ($1, $2, $3, $4, $5)',
        [user.id, email, passwordHash, AuthProvider.EMAIL_PASSWORD, true],
      );
      await client.query('COMMIT');
      return this.issueTokens(user.id, 'customer');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async signIn(email: string, password: string) {
    const { rows } = await this.pool.query<UserAuthRow>(
      'SELECT * FROM user_auth WHERE email = $1 AND provider = $2',
      [email, AuthProvider.EMAIL_PASSWORD],
    );
    const auth = rows[0];

    if (!auth || !auth.password_hash) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const valid = await bcrypt.compare(password, auth.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    return this.issueTokens(auth.user_id, 'customer');
  }

  async upgradeAnonymous(userId: string, email: string, password: string, nickname?: string) {
    const { rows } = await this.pool.query<{ provider: AuthProvider }>(
      'SELECT provider FROM user_auth WHERE user_id = $1', [userId],
    );
    if (rows.length === 0) throw new BadRequestException('Пользователь не найден');
    if (rows[0].provider !== AuthProvider.ANONYMOUS) throw new BadRequestException('Аккаунт уже привязан');

    const { rows: existing } = await this.pool.query('SELECT id FROM user_auth WHERE email = $1', [email]);
    if (existing.length > 0) throw new BadRequestException('Email уже зарегистрирован');

    if (password.length < 6) throw new BadRequestException('Пароль должен быть не менее 6 символов');

    const passwordHash = await bcrypt.hash(password, 12);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE user_auth SET email = $1, password_hash = $2, provider = $3, is_verified = $4 WHERE user_id = $5',
        [email, passwordHash, AuthProvider.EMAIL_PASSWORD, true, userId],
      );
      if (nickname) {
        await client.query('UPDATE user_profiles SET nickname = $1 WHERE user_id = $2', [nickname, userId]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    return this.issueTokens(userId, 'customer');
  }

  async refreshTokens(userId: string) {
    const { rows } = await this.pool.query<{ id: string; provider: AuthProvider }>(
      'SELECT u.id, a.provider FROM users u INNER JOIN user_auth a ON a.user_id = u.id WHERE u.id = $1',
      [userId],
    );
    if (rows.length === 0) throw new Error('User not found');

    const role = rows[0].provider === AuthProvider.EMAIL_PASSWORD ? 'customer' : 'anonymous';
    return this.issueTokens(userId, role);
  }

  private async issueTokens(userId: string, role: string) {
    const payload: TokenPayload = { sub: userId, role };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, {
      expiresIn: this.config.get('JWT_REFRESH_EXPIRATION', '7d'),
    });

    await this.pool.query('UPDATE user_auth SET refresh_token = $1 WHERE user_id = $2', [refreshToken, userId]);

    return { userId, accessToken, refreshToken };
  }

  setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProduction = this.config.get('NODE_ENV') === 'production';
    res.cookie('access_token', accessToken, { httpOnly: true, secure: isProduction, sameSite: 'lax', maxAge: 15 * 60 * 1000, path: '/' });
    res.cookie('refresh_token', refreshToken, { httpOnly: true, secure: isProduction, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
  }

  clearTokenCookies(res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
  }
}
