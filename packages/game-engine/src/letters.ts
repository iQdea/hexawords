import type { LetterGenerator } from './interfaces';

/**
 * Frequency weights derived from 82750-word Russian dictionary (781K chars).
 * Values = per-10000 frequency. Higher weight = more common in real words.
 */
export const RUSSIAN_LETTER_WEIGHTS: Record<string, number> = {
  'о': 993,  'а': 952,  'и': 861,  'е': 850,  'н': 698,
  'р': 636,  'т': 626,  'к': 492,  'с': 490,  'л': 440,
  'в': 349,  'п': 313,  'м': 264,  'д': 245,  'у': 204,
  'я': 131,  'ц': 123,  'ч': 119,  'г': 166,  'з': 172,
  'б': 159,  'ь': 210,  'ш': 71,   'х': 67,   'ы': 66,
  'ж': 62,   'й': 55,   'ф': 80,   'щ': 47,   'э': 31,
  'ю': 25,   'ё': 10,   'ъ': 3,
};

/** Russian vowels. */
export const RUSSIAN_VOWELS = new Set(['а', 'е', 'ё', 'и', 'о', 'у', 'ы', 'э', 'ю', 'я']);

/** Russian consonants (excluding ъ and ь — signs, not consonants, but treated as consonants for balance). */
export const RUSSIAN_CONSONANTS = new Set(
  Object.keys(RUSSIAN_LETTER_WEIGHTS).filter(c => !RUSSIAN_VOWELS.has(c))
);

/** Points per letter: rarer letters are worth more (1-6 scale). */
export function letterPoints(char: string): number {
  const sorted = Object.entries(RUSSIAN_LETTER_WEIGHTS)
    .sort(([, a], [, b]) => b - a);
  const index = sorted.findIndex(([c]) => c === char);
  if (index === -1) return 1;
  return Math.floor(index / 6) + 1;
}

/** Target vowel count per hexagon of 7 cells. */
export const TARGET_VOWELS_PER_HEX = 3;

/**
 * Picks a random letter from a subset, weighted by frequency.
 */
function weightedPick(subset: Set<string>): string {
  const entries = [...subset].map(c => ({ char: c, weight: RUSSIAN_LETTER_WEIGHTS[c] ?? 1 }));
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let rand = Math.random() * total;
  for (const e of entries) {
    rand -= e.weight;
    if (rand <= 0) return e.char;
  }
  return entries[entries.length - 1].char;
}

export class WeightedLetterGenerator implements LetterGenerator {
  generate(): { char: string; points: number } {
    // Default: 43% chance vowel (3/7), matching TARGET_VOWELS_PER_HEX
    return this.generateBiased(TARGET_VOWELS_PER_HEX / 7);
  }

  /** Generate a vowel. */
  generateVowel(): { char: string; points: number } {
    const char = weightedPick(RUSSIAN_VOWELS);
    return { char, points: letterPoints(char) };
  }

  /** Generate a consonant. */
  generateConsonant(): { char: string; points: number } {
    const char = weightedPick(RUSSIAN_CONSONANTS);
    return { char, points: letterPoints(char) };
  }

  /** Generate with a specific vowel probability. */
  generateBiased(vowelChance: number): { char: string; points: number } {
    if (Math.random() < vowelChance) {
      return this.generateVowel();
    }
    return this.generateConsonant();
  }
}

/**
 * Generates a balanced set of letters for one hexagon.
 * Guarantees exactly `vowelCount` vowels and `total - vowelCount` consonants.
 */
export function generateBalancedHex(
  total: number,
  vowelCount = TARGET_VOWELS_PER_HEX,
): Array<{ char: string; points: number }> {
  const gen = new WeightedLetterGenerator();
  const result: Array<{ char: string; points: number }> = [];

  for (let i = 0; i < vowelCount; i++) {
    result.push(gen.generateVowel());
  }
  for (let i = vowelCount; i < total; i++) {
    result.push(gen.generateConsonant());
  }

  // Shuffle so vowels aren't always in the same slots
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * Decides whether a respawned cell should be a vowel or consonant
 * based on the current balance in the hexagon.
 */
export function shouldRespawnVowel(
  currentVowelCount: number,
  currentTotal: number,
  targetRatio = TARGET_VOWELS_PER_HEX / 7,
): boolean {
  if (currentTotal === 0) return Math.random() < targetRatio;
  const currentRatio = currentVowelCount / currentTotal;
  // If below target, strongly prefer vowel; if above, prefer consonant
  if (currentRatio < targetRatio - 0.1) return true;
  if (currentRatio > targetRatio + 0.1) return false;
  return Math.random() < targetRatio;
}
