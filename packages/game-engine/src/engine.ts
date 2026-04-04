import type { CellState, GameConfig, WordResult, WordPathStep } from '@hexawords/types';
import { areAdjacent, gridForSize } from '@hexawords/hex-math';
import type { WordValidator, LetterGenerator } from './interfaces';
import { calculateWordScore } from './scoring';
import { generateBalancedHex, shouldRespawnVowel, RUSSIAN_VOWELS, WeightedLetterGenerator } from './letters';

export interface GameState {
  /** Cells grouped by hexagon key "q,r" → array of CellState (one per slot). */
  hexagons: Map<string, CellState[]>;
  score: number;
  wordCount: number;
  wordsFound: Set<string>;
  status: 'active' | 'finished';
}

export interface WordSubmission {
  /** Ordered path: each step = which hexagon (hexQ,hexR) + which slot within it. */
  path: WordPathStep[];
}

export interface SubmitResult extends WordResult {
  consumedCells: WordPathStep[];
  newCells: CellState[];
  isRepeat?: boolean;
}

function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

export class GameEngine {
  constructor(
    private wordValidator: WordValidator,
    private letterGenerator: LetterGenerator,
  ) {}

  /** Creates the initial game state: N hexagons, each with cellsPerHex letters. */
  createInitialState(config: GameConfig): GameState {
    const hexCoords = gridForSize(config.hexCount);
    const hexagons = new Map<string, CellState[]>();

    for (const coord of hexCoords) {
      const balanced = generateBalancedHex(config.cellsPerHex);
      const cells: CellState[] = balanced.map((letter, slot) => ({
        hexQ: coord.q,
        hexR: coord.r,
        slot,
        char: letter.char,
        points: letter.points,
        isActive: true,
      }));
      hexagons.set(hexKey(coord.q, coord.r), cells);
    }

    return {
      hexagons,
      score: 0,
      wordCount: 0,
      wordsFound: new Set(),
      status: 'active',
    };
  }

  async submitWord(state: GameState, submission: WordSubmission): Promise<SubmitResult> {
    const { path } = submission;

    // 1. Minimum length
    if (path.length < 2) {
      return this.invalid(state, path, 'too_short');
    }

    // 2. No duplicate cells (same hex + same slot)
    const usedCells = new Set<string>();
    for (const step of path) {
      const cellKey = `${step.hexQ},${step.hexR},${step.slot}`;
      if (usedCells.has(cellKey)) {
        return this.invalid(state, path, 'same_hexagon');
      }
      usedCells.add(cellKey);
    }

    // 3. Consecutive steps must be in DIFFERENT adjacent hexagons
    //    (can revisit a hex after going through another one)
    for (let i = 1; i < path.length; i++) {
      const prev = { q: path[i - 1].hexQ, r: path[i - 1].hexR };
      const curr = { q: path[i].hexQ, r: path[i].hexR };
      // Can't stay in the same hexagon for consecutive picks
      if (prev.q === curr.q && prev.r === curr.r) {
        return this.invalid(state, path, 'same_hexagon');
      }
      if (!areAdjacent(prev, curr)) {
        return this.invalid(state, path, 'not_adjacent');
      }
    }

    // 4. Extract word
    const word = this.extractWord(state, path);

    // 5. Dictionary check
    const isValid = await this.wordValidator.isValid(word);
    if (!isValid) {
      return this.invalid(state, path, 'not_in_dictionary');
    }

    // 6. Check if already found in this game (repeat = reduced score)
    const isRepeat = state.wordsFound.has(word);

    // 7. Get word frequency for rarity bonus
    const wordFreq = await this.wordValidator.getFreq(word);

    // 8. Calculate score (repeats get 25% of normal)
    const cellPoints = path.map(step => {
      const hex = state.hexagons.get(hexKey(step.hexQ, step.hexR));
      return hex?.[step.slot]?.points ?? 0;
    });
    let points = calculateWordScore(cellPoints, state.wordCount, word.length, wordFreq);
    if (isRepeat) {
      points = Math.max(1, Math.round(points * 0.25));
    }

    // 8. Consume cells and generate replacements
    const consumedCells = [...path];
    const newCells: CellState[] = [];

    const gen = this.letterGenerator instanceof WeightedLetterGenerator
      ? this.letterGenerator
      : new WeightedLetterGenerator();

    for (const step of path) {
      const key = hexKey(step.hexQ, step.hexR);
      const hex = state.hexagons.get(key);
      if (!hex) continue;

      // Count current vowels in this hexagon (excluding the consumed cell)
      const vowelCount = hex.filter(
        (c, i) => i !== step.slot && c.isActive && RUSSIAN_VOWELS.has(c.char)
      ).length;
      const activeCount = hex.filter(
        (c, i) => i !== step.slot && c.isActive
      ).length;

      // Decide vowel or consonant based on current balance
      const needVowel = shouldRespawnVowel(vowelCount, activeCount);
      const { char, points: newPts } = needVowel
        ? gen.generateVowel()
        : gen.generateConsonant();

      const newCell: CellState = {
        hexQ: step.hexQ,
        hexR: step.hexR,
        slot: step.slot,
        char,
        points: newPts,
        isActive: true,
      };
      hex[step.slot] = newCell;
      newCells.push(newCell);
    }

    // 9. Update game state
    state.score += points;
    state.wordCount++;
    state.wordsFound.add(word);

    return {
      valid: true,
      word,
      points,
      consumedCells,
      newCells,
      isRepeat,
    };
  }

  checkCampaignCompletion(state: GameState, targetScore: number): boolean {
    return state.score >= targetScore;
  }

  private extractWord(state: GameState, path: WordPathStep[]): string {
    return path
      .map(step => {
        const hex = state.hexagons.get(hexKey(step.hexQ, step.hexR));
        return hex?.[step.slot]?.char ?? '';
      })
      .join('');
  }

  private invalid(state: GameState, path: WordPathStep[], reason: WordResult['reason']): SubmitResult {
    return {
      valid: false,
      word: this.extractWord(state, path),
      points: 0,
      reason,
      consumedCells: [],
      newCells: [],
    };
  }
}
