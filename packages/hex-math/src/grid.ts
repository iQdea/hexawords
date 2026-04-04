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

/** Maps grid sizes used in the game to their grid radius. */
export function gridForSize(size: number): AxialCoord[] {
  switch (size) {
    case 1: return generateHexGrid(0);
    case 7: return generateHexGrid(1);
    case 19: return generateHexGrid(2);
    default: return generateCompactGrid(size);
  }
}
