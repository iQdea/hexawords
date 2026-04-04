import { describe, it, expect } from 'vitest';
import { areAdjacent, getNeighbors, isValidPath } from '../src/adjacency';

describe('areAdjacent', () => {
  it('origin and all 6 neighbors are adjacent', () => {
    const origin = { q: 0, r: 0 };
    const neighbors = [
      { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
      { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
    ];
    for (const n of neighbors) {
      expect(areAdjacent(origin, n)).toBe(true);
    }
  });

  it('cell is not adjacent to itself', () => {
    expect(areAdjacent({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(false);
  });

  it('ring-2 cells are not adjacent to origin', () => {
    expect(areAdjacent({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(false);
    expect(areAdjacent({ q: 0, r: 0 }, { q: 1, r: 1 })).toBe(false);
  });

  it('two ring-1 neighbors can be adjacent to each other', () => {
    expect(areAdjacent({ q: 1, r: 0 }, { q: 1, r: -1 })).toBe(true);
    expect(areAdjacent({ q: 0, r: 1 }, { q: -1, r: 1 })).toBe(true);
  });

  it('opposite ring-1 cells are not adjacent', () => {
    expect(areAdjacent({ q: 1, r: 0 }, { q: -1, r: 0 })).toBe(false);
  });

  it('is symmetric', () => {
    const a = { q: 2, r: -1 };
    const b = { q: 3, r: -1 };
    expect(areAdjacent(a, b)).toBe(areAdjacent(b, a));
  });
});

describe('getNeighbors', () => {
  it('returns exactly 6 neighbors', () => {
    expect(getNeighbors({ q: 0, r: 0 })).toHaveLength(6);
  });

  it('all returned coords are adjacent to the input', () => {
    const center = { q: 3, r: -2 };
    for (const n of getNeighbors(center)) {
      expect(areAdjacent(center, n)).toBe(true);
    }
  });

  it('neighbors are unique', () => {
    const neighbors = getNeighbors({ q: 0, r: 0 });
    const keys = neighbors.map(n => `${n.q},${n.r}`);
    expect(new Set(keys).size).toBe(6);
  });
});

describe('isValidPath', () => {
  it('empty path is valid', () => {
    expect(isValidPath([])).toBe(true);
  });

  it('single cell path is valid', () => {
    expect(isValidPath([{ q: 0, r: 0 }])).toBe(true);
  });

  it('valid two-cell path', () => {
    expect(isValidPath([{ q: 0, r: 0 }, { q: 1, r: 0 }])).toBe(true);
  });

  it('valid three-cell path around origin', () => {
    expect(isValidPath([
      { q: 1, r: 0 },
      { q: 0, r: 0 },
      { q: -1, r: 1 },
    ])).toBe(true);
  });

  it('rejects non-adjacent cells', () => {
    expect(isValidPath([
      { q: 0, r: 0 },
      { q: 2, r: 0 },
    ])).toBe(false);
  });

  it('rejects path with duplicate cell', () => {
    expect(isValidPath([
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 0, r: 0 },
    ])).toBe(false);
  });
});
