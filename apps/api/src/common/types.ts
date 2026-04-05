import type { Request } from 'express';

export interface JwtPayload {
  userId: string;
  role: string;
}

export type AuthenticatedRequest = Request & { user: JwtPayload };
