import type { CellState, GameConfig, WordResult, WordPathStep } from '@hexawords/types';
import { areAdjacent, gridForSize, generateFieldLayout, edgeHexSlots } from '@hexawords/hex-math';
import type { WordValidator, LetterGenerator } from './interfaces';
import { calculateWordScore } from './scoring';
import { generateBalancedHex, shouldRespawnVowel, RUSSIAN_VOWELS, WeightedLetterGenerator, TARGET_VOWELS_PER_HEX } from './letters';

export interface GameState {
  /** Cells grouped by hexagon key "q,r" → array of CellState. */
  hexagons: Map<string, CellState[]>;
  score: number;
  wordCount: number;
  wordsFound: Set<string>;
  status: 'active' | 'finished';
}

export interface WordSubmission {
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

/** Find cell by slot number (safe for edge hexes with non-contiguous slots) */
function getCell(cells: CellState[], slot: number): CellState | undefined {
  return cells.find(c => c.slot === slot);
}

export class GameEngine {
  constructor(
    private wordValidator: WordValidator,
    private letterGenerator: LetterGenerator,
  ) {}

  createInitialState(config: GameConfig): GameState {
    const edgeCount = config.edgeHexCount ?? 0;
    const hexagons = new Map<string, CellState[]>();

    if (edgeCount > 0) {
      // Mixed layout: full + edge hexagons
      const layout = generateFieldLayout(config.hexCount, edgeCount);

      for (const hex of layout) {
        if (hex.type === 'full') {
          const balanced = generateBalancedHex(config.cellsPerHex);
          const cells: CellState[] = balanced.map((letter, slot) => ({
            hexQ: hex.coord.q, hexR: hex.coord.r, slot,
            char: letter.char, points: letter.points,
            isActive: true, lockType: null, variant: null,
          }));
          hexagons.set(hexKey(hex.coord.q, hex.coord.r), cells);
        } else {
          // Variant A (below) = slots 6,1,2 (lower half of hex)
          // Variant B (above) = slots 5,4,3 (upper half of hex)
          // facing 5 = edge is below core → variant A
          // facing 2 = edge is above core → variant B
          const isBelow = hex.facing === 5 || hex.facing === 0 || hex.facing === 4;
          const slots = isBelow ? [6, 1, 2] : [5, 4, 3];
          const vowelTarget = Math.max(1, Math.round(slots.length * TARGET_VOWELS_PER_HEX / 7));
          const balanced = generateBalancedHex(slots.length, vowelTarget);
          const cells: CellState[] = balanced.map((letter, i) => ({
            hexQ: hex.coord.q, hexR: hex.coord.r, slot: slots[i],
            char: letter.char, points: letter.points,
            isActive: true, lockType: null, variant: null,
          }));
          hexagons.set(hexKey(hex.coord.q, hex.coord.r), cells);
        }
      }
    } else {
      // Standard layout: only full hexagons
      const hexCoords = gridForSize(config.hexCount);
      for (const coord of hexCoords) {
        const balanced = generateBalancedHex(config.cellsPerHex);
        const cells: CellState[] = balanced.map((letter, slot) => ({
          hexQ: coord.q, hexR: coord.r, slot,
          char: letter.char, points: letter.points,
          isActive: true, lockType: null, variant: null,
        }));
        hexagons.set(hexKey(coord.q, coord.r), cells);
      }
    }

    return {
      hexagons,
      score: 0,
      wordCount: 0,
      wordsFound: new Set(),
      status: 'active',
    };
  }

  async submitWord(state: GameState, submission: WordSubmission, minWordLength = 2): Promise<SubmitResult> {
    const { path } = submission;

    if (path.length < minWordLength) {
      return this.invalid(state, path, 'too_short');
    }

    const usedCells = new Set<string>();
    for (const step of path) {
      const cellKey = `${step.hexQ},${step.hexR},${step.slot}`;
      if (usedCells.has(cellKey)) {
        return this.invalid(state, path, 'same_hexagon');
      }
      usedCells.add(cellKey);
    }

    for (let i = 1; i < path.length; i++) {
      const prev = { q: path[i - 1].hexQ, r: path[i - 1].hexR };
      const curr = { q: path[i].hexQ, r: path[i].hexR };
      if (prev.q === curr.q && prev.r === curr.r) {
        return this.invalid(state, path, 'same_hexagon');
      }
      if (!areAdjacent(prev, curr)) {
        return this.invalid(state, path, 'not_adjacent');
      }
    }

    const word = this.extractWord(state, path);

    const isValid = await this.wordValidator.isValid(word);
    if (!isValid) {
      return this.invalid(state, path, 'not_in_dictionary');
    }

    const isRepeat = state.wordsFound.has(word);
    const wordFreq = await this.wordValidator.getFreq(word);

    const cellPoints = path.map(step => {
      const hex = state.hexagons.get(hexKey(step.hexQ, step.hexR));
      return hex ? (getCell(hex, step.slot)?.points ?? 0) : 0;
    });
    let points = calculateWordScore(cellPoints, state.wordCount, word.length, wordFreq);
    if (isRepeat) {
      points = Math.max(1, Math.round(points * 0.25));
    }

    const consumedCells = [...path];
    const newCells: CellState[] = [];

    const gen = this.letterGenerator instanceof WeightedLetterGenerator
      ? this.letterGenerator
      : new WeightedLetterGenerator();

    for (const step of path) {
      const key = hexKey(step.hexQ, step.hexR);
      const hex = state.hexagons.get(key);
      if (!hex) continue;

      const vowelCount = hex.filter(
        c => c.slot !== step.slot && c.isActive && RUSSIAN_VOWELS.has(c.char)
      ).length;
      const activeCount = hex.filter(
        c => c.slot !== step.slot && c.isActive
      ).length;

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
        lockType: null,
        variant: null,
      };

      // Update cell in hex by slot (not by array index)
      const idx = hex.findIndex(c => c.slot === step.slot);
      if (idx >= 0) hex[idx] = newCell;
      newCells.push(newCell);
    }

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
        return hex ? (getCell(hex, step.slot)?.char ?? '') : '';
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
