/**
 * Calculate points for a submitted word.
 *
 * Score = sum(cellPoints) * lengthMultiplier * streakBonus * rarityBonus * BASE
 *
 * - BASE: 10x multiplier
 * - lengthMultiplier: longer words get bonus
 * - streakBonus: +5% per word found in this game
 * - rarityBonus: rare words (low freq) get up to 3x, common words (high freq) get 1x
 */

const LENGTH_MULTIPLIERS = [0, 0, 0.5, 1, 2, 4, 7, 12, 18, 25, 35];

export function calculateWordScore(
  cellPoints: number[],
  wordCount: number,
  wordLength: number,
  wordFreq = 0,
): number {
  const basePoints = cellPoints.reduce((sum, p) => sum + p, 0);
  const lengthMul = LENGTH_MULTIPLIERS[Math.min(wordLength, LENGTH_MULTIPLIERS.length - 1)] ?? 35;
  const streakBonus = 1 + wordCount * 0.05;
  const rarityBonus = calculateRarityBonus(wordFreq);
  const score = basePoints * lengthMul * streakBonus * rarityBonus * 10;
  return Math.max(1, Math.round(score));
}

/**
 * Rarity bonus based on how often the word has been found by all players.
 * freq 0 (never found / new from Wiktionary) → 3x
 * freq 1-5 → ~2.5x
 * freq 10 → ~2x
 * freq 50 → ~1.5x
 * freq 200+ → 1x (floor)
 */
export function calculateRarityBonus(freq: number): number {
  if (freq <= 0) return 3;
  return Math.max(1, 3 - Math.log10(freq) * 0.87);
}
