import { describe, it, expect } from 'vitest';
import { axialToPixel, hexCorners, gridBounds } from '../src/layout';
import { generateHexGrid } from '../src/grid';

describe('axialToPixel', () => {
  it('origin maps to (0, 0)', () => {
    const p = axialToPixel({ q: 0, r: 0 }, 10);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('moving east (q+1) shifts x by 1.5*size', () => {
    const p = axialToPixel({ q: 1, r: 0 }, 10);
    expect(p.x).toBeCloseTo(15);
  });

  it('moving south (r+1) shifts y by sqrt(3)*size', () => {
    const p = axialToPixel({ q: 0, r: 1 }, 10);
    expect(p.y).toBeCloseTo(10 * Math.sqrt(3));
  });
});

describe('hexCorners', () => {
  it('returns 6 corners', () => {
    expect(hexCorners({ x: 0, y: 0 }, 10)).toHaveLength(6);
  });

  it('all corners are at distance = size from center', () => {
    const corners = hexCorners({ x: 5, y: 5 }, 10);
    for (const c of corners) {
      const dist = Math.sqrt((c.x - 5) ** 2 + (c.y - 5) ** 2);
      expect(dist).toBeCloseTo(10);
    }
  });
});

describe('gridBounds', () => {
  it('single cell at origin has symmetric bounds', () => {
    const bounds = gridBounds([{ q: 0, r: 0 }], 10);
    expect(bounds.minX).toBeCloseTo(-bounds.maxX);
    expect(bounds.minY).toBeCloseTo(-bounds.maxY);
  });

  it('radius-1 grid has wider bounds than single cell', () => {
    const single = gridBounds([{ q: 0, r: 0 }], 10);
    const grid = gridBounds(generateHexGrid(1), 10);
    expect(grid.maxX).toBeGreaterThan(single.maxX);
    expect(grid.maxY).toBeGreaterThan(single.maxY);
  });
});
