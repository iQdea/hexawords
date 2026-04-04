import type { LetterGenerator } from './interfaces';

/**
 * Frequency weights based on Russian word corpus analysis.
 * Higher weight = more common letter = appears more often on the board.
 */
export const RUSSIAN_LETTER_WEIGHTS: Record<string, number> = {
  'о': 1200, 'е': 1100, 'а': 1050, 'и': 1000, 'н': 850,
  'т': 800,  'с': 750,  'р': 700,  'в': 650,  'л': 600,
  'к': 550,  'м': 500,  'д': 450,  'п': 430,  'у': 400,
  'я': 350,  'ы': 330,  'ь': 300,  'г': 280,  'з': 260,
  'б': 240,  'ч': 220,  'й': 200,  'х': 180,  'ж': 160,
  'ш': 140,  'ю': 120,  'ц': 100,  'щ': 80,   'э': 60,
  'ф': 40,   'ё': 30,   'ъ': 10,
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
