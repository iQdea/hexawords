import { describe, it, expect } from 'vitest';
import { calculateWordScore, calculateRarityBonus } from '../src/scoring';

describe('calculateWordScore', () => {
  it('3-letter word has lengthMultiplier=1', () => {
    const score = calculateWordScore([1, 1, 1], 0, 3, 0);
    expect(score).toBeGreaterThan(0);
  });

  it('longer words score more', () => {
    const short = calculateWordScore([2, 2, 2], 0, 3, 0);
    const long = calculateWordScore([2, 2, 2, 2, 2], 0, 5, 0);
    expect(long).toBeGreaterThan(short);
  });

  it('streak increases score', () => {
    const first = calculateWordScore([2, 2, 2], 0, 3, 0);
    const tenth = calculateWordScore([2, 2, 2], 10, 3, 0);
    expect(tenth).toBeGreaterThan(first);
  });

  it('higher cell points yield higher scores', () => {
    const low = calculateWordScore([1, 1, 1], 0, 3, 0);
    const high = calculateWordScore([5, 5, 5], 0, 3, 0);
    expect(high).toBeGreaterThan(low);
  });

  it('score is always at least 1', () => {
    const score = calculateWordScore([1, 1, 1], 0, 3, 99999);
    expect(score).toBeGreaterThanOrEqual(1);
  });

  it('rare words (freq=0) score more than common (freq=1000)', () => {
    const rare = calculateWordScore([2, 2, 2], 0, 3, 0);
    const common = calculateWordScore([2, 2, 2], 0, 3, 1000);
    expect(rare).toBeGreaterThan(common);
  });
});

describe('calculateRarityBonus', () => {
  it('freq 0 gives 3x bonus', () => {
    expect(calculateRarityBonus(0)).toBe(3);
  });

  it('high freq gives 1x (floor)', () => {
    expect(calculateRarityBonus(10000)).toBe(1);
  });

  it('decreases as freq increases', () => {
    const a = calculateRarityBonus(1);
    const b = calculateRarityBonus(10);
    const c = calculateRarityBonus(100);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });
});
