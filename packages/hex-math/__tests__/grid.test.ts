import { describe, it, expect } from 'vitest';
import { generateHexRing, generateHexGrid, generateCompactGrid, gridForSize } from '../src/grid';
import { areAdjacent } from '../src/adjacency';
import { cubeDistance } from '../src/cube';

describe('generateHexRing', () => {
  it('ring 0 returns center only', () => {
    const ring = generateHexRing({ q: 0, r: 0 }, 0);
    expect(ring).toEqual([{ q: 0, r: 0 }]);
  });

  it('ring 1 returns 6 cells', () => {
    const ring = generateHexRing({ q: 0, r: 0 }, 1);
    expect(ring).toHaveLength(6);
  });

  it('ring 2 returns 12 cells', () => {
    const ring = generateHexRing({ q: 0, r: 0 }, 2);
    expect(ring).toHaveLength(12);
  });

  it('all ring-1 cells are at distance 1 from center', () => {
    const ring = generateHexRing({ q: 0, r: 0 }, 1);
    for (const cell of ring) {
      expect(cubeDistance({ q: 0, r: 0 }, cell)).toBe(1);
    }
  });

  it('all ring-1 cells are unique', () => {
    const ring = generateHexRing({ q: 0, r: 0 }, 1);
    const keys = ring.map(c => `${c.q},${c.r}`);
    expect(new Set(keys).size).toBe(6);
  });
});

describe('generateHexGrid', () => {
  it('radius 0 produces 1 cell', () => {
    expect(generateHexGrid(0)).toHaveLength(1);
  });

  it('radius 1 produces 7 cells', () => {
    expect(generateHexGrid(1)).toHaveLength(7);
  });

  it('radius 2 produces 19 cells', () => {
    expect(generateHexGrid(2)).toHaveLength(19);
  });

  it('all cells are unique', () => {
    const cells = generateHexGrid(2);
    const keys = cells.map(c => `${c.q},${c.r}`);
    expect(new Set(keys).size).toBe(19);
  });

  it('every cell has at least one neighbor in the grid (connectivity)', () => {
    const cells = generateHexGrid(2);
    for (const cell of cells) {
      const hasNeighbor = cells.some(
        other => other !== cell && areAdjacent(cell, other)
      );
      expect(hasNeighbor).toBe(true);
    }
  });
});

describe('generateCompactGrid', () => {
  it('generates exactly 4 cells', () => {
    expect(generateCompactGrid(4)).toHaveLength(4);
  });

  it('generates exactly 13 cells', () => {
    expect(generateCompactGrid(13)).toHaveLength(13);
  });

  it('cells are sorted by distance from center (closest first)', () => {
    const cells = generateCompactGrid(13);
    const origin = { q: 0, r: 0 };
    for (let i = 1; i < cells.length; i++) {
      expect(cubeDistance(cells[i], origin)).toBeGreaterThanOrEqual(
        cubeDistance(cells[i - 1], origin)
      );
    }
  });

  it('all compact-4 cells are connected', () => {
    const cells = generateCompactGrid(4);
    for (const cell of cells) {
      const hasNeighbor = cells.some(
        other => other !== cell && areAdjacent(cell, other)
      );
      expect(hasNeighbor).toBe(true);
    }
  });
});

describe('gridForSize', () => {
  it('size 7 returns full radius-1 grid', () => {
    expect(gridForSize(7)).toHaveLength(7);
  });

  it('size 19 returns full radius-2 grid', () => {
    expect(gridForSize(19)).toHaveLength(19);
  });

  it('size 4 returns compact grid', () => {
    expect(gridForSize(4)).toHaveLength(4);
  });

  it('size 13 returns compact grid', () => {
    expect(gridForSize(13)).toHaveLength(13);
  });
});
