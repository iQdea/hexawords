import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { TokenPayload } from './auth.service';

/** Extract JWT from cookie or Authorization header. */
function extractJwt(req: Request): string | null {
  // Try cookie first
  if (req.cookies?.['access_token']) {
    return req.cookies['access_token'];
  }
  // Fall back to Authorization header
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: extractJwt,
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', 'dev-secret-change-in-prod'),
    });
  }

  validate(payload: TokenPayload) {
    if (!payload.sub) throw new UnauthorizedException();
    return { userId: payload.sub, role: payload.role };
  }
}
