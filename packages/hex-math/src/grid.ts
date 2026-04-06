import type { AxialCoord } from '@hexawords/types';
import { AXIAL_DIRECTIONS } from './adjacency';
import { cubeDistance } from './cube';

/**
 * Generates a single ring of hexes at the given radius from center.
 * Ring 0 = just the center. Ring 1 = 6 cells. Ring N = 6*N cells.
 */
export function generateHexRing(center: AxialCoord, radius: number): AxialCoord[] {
  if (radius === 0) return [{ ...center }];

  const results: AxialCoord[] = [];
  // Start at center + radius steps in direction 4 (southwest → top of ring)
  let coord: AxialCoord = {
    q: center.q + AXIAL_DIRECTIONS[4].q * radius,
    r: center.r + AXIAL_DIRECTIONS[4].r * radius,
  };

  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      results.push({ ...coord });
      coord = {
        q: coord.q + AXIAL_DIRECTIONS[side].q,
        r: coord.r + AXIAL_DIRECTIONS[side].r,
      };
    }
  }

  return results;
}

/**
 * Generates a filled hexagonal grid with the given radius.
 * radius=0 → 1 cell, radius=1 → 7 cells, radius=2 → 19 cells.
 */
export function generateHexGrid(radius: number): AxialCoord[] {
  const cells: AxialCoord[] = [];
  for (let ring = 0; ring <= radius; ring++) {
    cells.push(...generateHexRing({ q: 0, r: 0 }, ring));
  }
  return cells;
}

/**
 * Generates a compact grid of exactly `size` cells,
 * sorted by distance from center (closest first).
 */
export function generateCompactGrid(size: number): AxialCoord[] {
  // Generate enough rings to have at least `size` cells
  let radius = 0;
  let cells = generateHexGrid(radius);
  while (cells.length < size) {
    radius++;
    cells = generateHexGrid(radius);
  }

  const origin: AxialCoord = { q: 0, r: 0 };
  return cells
    .sort((a, b) => cubeDistance(a, origin) - cubeDistance(b, origin))
    .slice(0, size);
}

export interface EdgeHex {
  coord: AxialCoord;
  /** Direction index (0-5) pointing from edge hex toward the core grid */
  facing: number;
}

/**
 * Given core hex coords, find positions for edge hexagons on the boundary.
 * Prioritizes positions that border multiple core hexes (more connectivity).
 */
export function generateEdgeHexes(coreCoords: AxialCoord[], count: number): EdgeHex[] {
  if (count <= 0) return [];

  const coreSet = new Set(coreCoords.map(c => `${c.q},${c.r}`));
  const candidates: Array<{ coord: AxialCoord; facing: number; score: number }> = [];
  const seen = new Set<string>();

  for (const core of coreCoords) {
    for (let dir = 0; dir < 6; dir++) {
      const neighbor: AxialCoord = {
        q: core.q + AXIAL_DIRECTIONS[dir].q,
        r: core.r + AXIAL_DIRECTIONS[dir].r,
      };
      const key = `${neighbor.q},${neighbor.r}`;

      if (coreSet.has(key) || seen.has(key)) continue;
      seen.add(key);

      // facing = direction from edge hex back toward core = opposite of dir
      const facing = (dir + 3) % 6;

      // Score: how many core hexes border this position (more = better connectivity)
      let score = 0;
      for (let d = 0; d < 6; d++) {
        const adj = `${neighbor.q + AXIAL_DIRECTIONS[d].q},${neighbor.r + AXIAL_DIRECTIONS[d].r}`;
        if (coreSet.has(adj)) score++;
      }

      candidates.push({ coord: neighbor, facing, score });
    }
  }

  // Sort by score descending (prefer positions with more core neighbors)
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, count).map(({ coord, facing }) => ({ coord, facing }));
}

/**
 * Returns the active slot indices for an edge hex given its facing direction.
 * Slots 1-6 are ring positions at 60° intervals. The 3 slots facing the core grid
 * are the ones closest to the facing direction.
 *
 * @param facing Direction index (0-5) pointing toward core grid
 * @param includeCenter If true, include slot 0 (4-cell edge hex)
 */
export function edgeHexSlots(facing: number, includeCenter = true): number[] {
  // Ring slots 1-6 map to directions. Slot 1 = direction 0, slot 2 = direction 1, etc.
  // The 3 ring slots facing the core grid are centered around the facing direction.
  const centerRing = ((facing % 6) + 1); // ring slot aligned with facing
  const leftRing = ((facing - 1 + 6) % 6) + 1;
  const rightRing = ((facing + 1) % 6) + 1;

  const slots = [leftRing, centerRing, rightRing];
  if (includeCenter) slots.unshift(0);
  return slots;
}

/** Maps grid sizes used in the game to their grid radius. */
export function gridForSize(size: number): AxialCoord[] {
  switch (size) {
    case 1: return generateHexGrid(0);
    case 7: return generateHexGrid(1);
    case 19: return generateHexGrid(2);
    default: return generateCompactGrid(size);
  }
}

export interface FieldHex {
  coord: AxialCoord;
  type: 'full' | 'edge';
  /** For edge hexes: direction (0-5) pointing toward the center of the field */
  facing: number;
}

/**
 * Generate a field layout with `fullCount` full hexagons and `edgeCount` edge (half) hexagons.
 * Full hexagons form the core grid. Edge hexagons are placed on free outer edges,
 * spread as far apart as possible for visual balance.
 */
export function generateFieldLayout(fullCount: number, edgeCount: number): FieldHex[] {
  if (edgeCount <= 0) {
    return gridForSize(fullCount).map(coord => ({ coord, type: 'full' as const, facing: 0 }));
  }

  const coreCoords = gridForSize(fullCount);
  const result: FieldHex[] = coreCoords.map(coord => ({ coord, type: 'full' as const, facing: 0 }));

  // Find all candidate edge positions (neighbors of core that aren't in core)
  const coreSet = new Set(coreCoords.map(c => `${c.q},${c.r}`));
  const candidates: Array<{ coord: AxialCoord; facing: number; score: number }> = [];
  const seen = new Set<string>();

  for (const core of coreCoords) {
    for (let dir = 0; dir < 6; dir++) {
      const neighbor: AxialCoord = {
        q: core.q + AXIAL_DIRECTIONS[dir].q,
        r: core.r + AXIAL_DIRECTIONS[dir].r,
      };
      const key = `${neighbor.q},${neighbor.r}`;
      if (coreSet.has(key) || seen.has(key)) continue;
      seen.add(key);

      // facing = direction from edge hex back toward core
      const facing = (dir + 3) % 6;

      // Score: prefer positions that border fewer core hexes (more "outer")
      // and are farther from center (more spread out)
      const dist = cubeDistance(neighbor, { q: 0, r: 0 });
      let coreNeighborCount = 0;
      for (let d = 0; d < 6; d++) {
        const adj = `${neighbor.q + AXIAL_DIRECTIONS[d].q},${neighbor.r + AXIAL_DIRECTIONS[d].r}`;
        if (coreSet.has(adj)) coreNeighborCount++;
      }
      candidates.push({ coord: neighbor, facing, score: dist * 10 - coreNeighborCount });
    }
  }

  // For each candidate, compute a "outerness" score:
  // prefer positions that border only 1 core hex and are opposite to the core cluster center
  const origin: AxialCoord = { q: 0, r: 0 };
  const avgQ = coreCoords.reduce((s, c) => s + c.q, 0) / coreCoords.length;
  const avgR = coreCoords.reduce((s, c) => s + c.r, 0) / coreCoords.length;

  for (const cand of candidates) {
    // Distance from center of mass of core (higher = more "outer")
    const dx = cand.coord.q - avgQ;
    const dy = cand.coord.r - avgR;
    cand.score = Math.sqrt(dx * dx + dy * dy + dx * dy) * 10;
    // Prefer top/bottom positions (directions 2,5 = vertical axis)
    // facing 2 or 5 means the edge hex is above or below its parent
    if (cand.facing === 2 || cand.facing === 5) cand.score += 15;
    // Penalize positions bordering multiple core hexes
    let coreNeighbors = 0;
    for (let d = 0; d < 6; d++) {
      const adj = `${cand.coord.q + AXIAL_DIRECTIONS[d].q},${cand.coord.r + AXIAL_DIRECTIONS[d].r}`;
      if (coreSet.has(adj)) coreNeighbors++;
    }
    cand.score -= coreNeighbors * 5;
  }

  // Greedily pick edge hexes maximizing spread
  const picked: typeof candidates = [];
  const remaining = [...candidates];

  for (let i = 0; i < edgeCount && remaining.length > 0; i++) {
    if (i === 0) {
      remaining.sort((a, b) => b.score - a.score);
    } else {
      // Pick furthest from all already picked
      remaining.sort((a, b) => {
        const minDistA = Math.min(...picked.map(p => cubeDistance(a.coord, p.coord)));
        const minDistB = Math.min(...picked.map(p => cubeDistance(b.coord, p.coord)));
        return minDistB - minDistA;
      });
    }
    picked.push(remaining.shift()!);
  }

  for (const { coord, facing } of picked) {
    result.push({ coord, type: 'edge', facing });
  }

  return result;
}
