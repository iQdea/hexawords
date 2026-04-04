import { describe, it, expect } from 'vitest';
import { axialToCube, cubeToAxial, cubeDistance, coordKey } from '../src/cube';

describe('cube coordinates', () => {
  it('converts axial to cube with q+r+s=0 invariant', () => {
    const cube = axialToCube({ q: 1, r: -1 });
    expect(cube.q + cube.r + cube.s).toBe(0);
    expect(cube).toEqual({ q: 1, r: -1, s: 0 });
  });

  it('roundtrips axial -> cube -> axial', () => {
    const original = { q: 3, r: -2 };
    const result = cubeToAxial(axialToCube(original));
    expect(result).toEqual(original);
  });

  it('distance from origin to neighbor is 1', () => {
    expect(cubeDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
    expect(cubeDistance({ q: 0, r: 0 }, { q: 0, r: 1 })).toBe(1);
    expect(cubeDistance({ q: 0, r: 0 }, { q: -1, r: 1 })).toBe(1);
  });

  it('distance from origin to ring-2 cell is 2', () => {
    expect(cubeDistance({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(2);
    expect(cubeDistance({ q: 0, r: 0 }, { q: 1, r: 1 })).toBe(2);
  });

  it('distance is symmetric', () => {
    const a = { q: 2, r: -1 };
    const b = { q: -1, r: 3 };
    expect(cubeDistance(a, b)).toBe(cubeDistance(b, a));
  });

  it('coordKey produces unique strings', () => {
    expect(coordKey({ q: 1, r: 2 })).toBe('1,2');
    expect(coordKey({ q: -1, r: 0 })).toBe('-1,0');
  });
});
