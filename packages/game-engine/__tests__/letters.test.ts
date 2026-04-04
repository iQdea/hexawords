import { describe, it, expect } from 'vitest';
import { RUSSIAN_LETTER_WEIGHTS, letterPoints, WeightedLetterGenerator, RUSSIAN_VOWELS } from '../src/letters';

describe('RUSSIAN_LETTER_WEIGHTS', () => {
  it('contains 33 Russian letters', () => {
    expect(Object.keys(RUSSIAN_LETTER_WEIGHTS)).toHaveLength(33);
  });

  it('all weights are positive', () => {
    for (const w of Object.values(RUSSIAN_LETTER_WEIGHTS)) {
      expect(w).toBeGreaterThan(0);
    }
  });
});

describe('letterPoints', () => {
  it('common letters (о, е, а) have low points (1)', () => {
    expect(letterPoints('о')).toBe(1);
    expect(letterPoints('е')).toBe(1);
    expect(letterPoints('а')).toBe(1);
  });

  it('rare letters (ф, ъ, ё) have high points', () => {
    expect(letterPoints('ф')).toBeGreaterThan(3);
    expect(letterPoints('ъ')).toBeGreaterThan(3);
  });

  it('returns 1 for unknown characters', () => {
    expect(letterPoints('x')).toBe(1);
  });
});

describe('WeightedLetterGenerator', () => {
  it('generates valid Russian letters', () => {
    const gen = new WeightedLetterGenerator();
    for (let i = 0; i < 100; i++) {
      const { char } = gen.generate();
      expect(RUSSIAN_LETTER_WEIGHTS).toHaveProperty(char);
    }
  });

  it('generates letters with positive points', () => {
    const gen = new WeightedLetterGenerator();
    for (let i = 0; i < 100; i++) {
      const { points } = gen.generate();
      expect(points).toBeGreaterThanOrEqual(1);
    }
  });

  it('common letters appear more frequently than rare ones', () => {
    const gen = new WeightedLetterGenerator();
    const counts: Record<string, number> = {};
    for (let i = 0; i < 10000; i++) {
      const { char } = gen.generate();
      counts[char] = (counts[char] ?? 0) + 1;
    }
    // "о" should appear much more than "ъ"
    expect(counts['о']!).toBeGreaterThan(counts['ъ']! * 10);
  });
});

describe('RUSSIAN_VOWELS', () => {
  it('contains 10 vowels', () => {
    expect(RUSSIAN_VOWELS.size).toBe(10);
  });

  it('includes standard vowels', () => {
    expect(RUSSIAN_VOWELS.has('а')).toBe(true);
    expect(RUSSIAN_VOWELS.has('о')).toBe(true);
    expect(RUSSIAN_VOWELS.has('ё')).toBe(true);
  });

  it('excludes consonants', () => {
    expect(RUSSIAN_VOWELS.has('б')).toBe(false);
    expect(RUSSIAN_VOWELS.has('к')).toBe(false);
  });
});
