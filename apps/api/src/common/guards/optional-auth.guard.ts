import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Allows unauthenticated access but attaches user if JWT is valid.
 * Game endpoints use this — anonymous users get auto-created via X-User-Id header,
 * authenticated users use JWT payload.
 */
@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    // Don't throw on missing/invalid JWT — just return null
    return user || null;
  }
}
