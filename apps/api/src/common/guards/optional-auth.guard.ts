import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

const JwtGuard = AuthGuard('jwt');

/**
 * Allows unauthenticated access but attaches user if JWT is valid.
 */
@Injectable()
export class OptionalAuthGuard extends JwtGuard {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(_err: Error | null, user: TUser): TUser | null {
    return user || null;
  }
}
