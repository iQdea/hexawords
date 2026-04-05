import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { TokenPayload } from './auth.service';

/** Extract JWT from the cookie or Authorization header. */
function extractJwt(req: Request): string | null {
  if (req.cookies?.['access_token']) {
    return req.cookies['access_token'];
  }
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return auth!.slice(7);
  }
  return null;
}

const JwtStrategyBase = PassportStrategy(Strategy);

@Injectable()
export class JwtStrategy extends JwtStrategyBase {
  constructor(config: ConfigService) {
    // biome-ignore lint/suspicious/noExplicitAny: PassportStrategy mixin types are unresolvable
    super({
      jwtFromRequest: extractJwt,
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', 'dev-secret-change-in-prod'),
    } as any);
  }

  validate(payload: TokenPayload) {
    if (!payload.sub) throw new UnauthorizedException();
    return { userId: payload.sub, role: payload.role };
  }
}
