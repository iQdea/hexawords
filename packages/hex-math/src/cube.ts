import type { AxialCoord } from '@hexawords/types';

export interface CubeCoord {
  q: number;
  r: number;
  s: number;
}

export function axialToCube(a: AxialCoord): CubeCoord {
  return { q: a.q, r: a.r, s: -a.q - a.r };
}

export function cubeToAxial(c: CubeCoord): AxialCoord {
  return { q: c.q, r: c.r };
}

export function cubeDistance(a: AxialCoord, b: AxialCoord): number {
  const dq = Math.abs(a.q - b.q);
  const dr = Math.abs(a.r - b.r);
  const ds = Math.abs((-a.q - a.r) - (-b.q - b.r));
  return Math.max(dq, dr, ds);
}

export function coordKey(c: AxialCoord): string {
  return `${c.q},${c.r}`;
}
