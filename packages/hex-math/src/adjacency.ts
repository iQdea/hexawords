import type { AxialCoord } from '@hexawords/types';

/** The 6 neighbor direction offsets in axial coordinates (flat-top hexagons). */
export const AXIAL_DIRECTIONS: readonly AxialCoord[] = [
  { q: +1, r:  0 },
  { q: +1, r: -1 },
  { q:  0, r: -1 },
  { q: -1, r:  0 },
  { q: -1, r: +1 },
  { q:  0, r: +1 },
];

/** Returns the 6 neighbors of a hex cell. */
export function getNeighbors(coord: AxialCoord): AxialCoord[] {
  return AXIAL_DIRECTIONS.map(d => ({
    q: coord.q + d.q,
    r: coord.r + d.r,
  }));
}

/** O(1) adjacency check using cube-distance == 1. */
export function areAdjacent(a: AxialCoord, b: AxialCoord): boolean {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -(dq + dr);
  return Math.abs(dq) + Math.abs(dr) + Math.abs(ds) === 2;
}

/** Validates that a sequence of coords forms a connected path with no revisits. */
export function isValidPath(path: AxialCoord[]): boolean {
  if (path.length <= 1) return true;

  const seen = new Set<string>();
  seen.add(`${path[0].q},${path[0].r}`);

  for (let i = 1; i < path.length; i++) {
    if (!areAdjacent(path[i - 1], path[i])) return false;

    const key = `${path[i].q},${path[i].r}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }

  return true;
}
