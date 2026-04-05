import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, type GameState } from '../src/engine';
import type { WordValidator, LetterGenerator } from '../src/interfaces';
import { GameMode, CELLS_PER_HEX } from '@hexawords/types';

class TestLetterGenerator implements LetterGenerator {
  private letters = ['к', 'о', 'т', 'д', 'о', 'м', 'а'];
  private index = 0;

  generate() {
    const char = this.letters[this.index % this.letters.length];
    this.index++;
    return { char, points: 1 };
  }
}

class TestWordValidator implements WordValidator {
  private words = new Set(['кот', 'дом', 'код', 'ток', 'мод', 'том', 'мот']);
  isValid(word: string): boolean {
    return this.words.has(word);
  }
  getFreq(): number {
    return 0;
  }
}

describe('GameEngine (two-level hex)', () => {
  let engine: GameEngine;
  let state: GameState;

  beforeEach(() => {
    engine = new GameEngine(new TestWordValidator(), new TestLetterGenerator());
    state = engine.createInitialState({
      mode: GameMode.SINGLE,
      hexCount: 4,
      cellsPerHex: CELLS_PER_HEX,
    });
  });

  describe('createInitialState', () => {
    it('creates 4 hexagons for hexCount=4', () => {
      expect(state.hexagons.size).toBe(4);
    });

    it('each hexagon has 7 cells', () => {
      for (const cells of state.hexagons.values()) {
        expect(cells).toHaveLength(7);
      }
    });

    it('all cells have Russian letters', () => {
      for (const cells of state.hexagons.values()) {
        for (const cell of cells) {
          expect(cell.char).toMatch(/^[а-яё]$/);
          expect(cell.isActive).toBe(true);
        }
      }
    });

    it('starts with score 0', () => {
      expect(state.score).toBe(0);
      expect(state.wordCount).toBe(0);
    });

    it('creates 7 hexagons for hexCount=7', () => {
      const big = engine.createInitialState({
        mode: GameMode.SINGLE,
        hexCount: 7,
        cellsPerHex: CELLS_PER_HEX,
      });
      expect(big.hexagons.size).toBe(7);
    });
  });

  describe('submitWord', () => {
    it('rejects single letter (too short)', async () => {
      const hexes = [...state.hexagons.keys()];
      const [h1] = hexes.map(k => k.split(',').map(Number));
      const result = await engine.submitWord(state, {
        path: [
          { hexQ: h1[0], hexR: h1[1], slot: 0 },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('too_short');
    });

    it('rejects consecutive picks from the same hexagon', async () => {
      const hexes = [...state.hexagons.keys()];
      const [q, r] = hexes[0].split(',').map(Number);
      const result = await engine.submitWord(state, {
        path: [
          { hexQ: q, hexR: r, slot: 0 },
          { hexQ: q, hexR: r, slot: 1 }, // same hex consecutively
          { hexQ: q, hexR: r, slot: 2 },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('same_hexagon');
    });

    it('accepts valid word across adjacent hexagons', async () => {
      // Set up cells to spell "кот" across 3 adjacent hexagons
      const hexKeys = [...state.hexagons.keys()];
      // Find 3 adjacent hexagons
      const path = findAdjacentHexPath(hexKeys, 3);
      if (!path) return; // skip if topology doesn't allow

      const letters = ['к', 'о', 'т'];
      for (let i = 0; i < 3; i++) {
        const hex = state.hexagons.get(path[i])!;
        hex[0] = { ...hex[0], char: letters[i], points: 2 };
      }

      const coords = path.map(k => k.split(',').map(Number));
      const result = await engine.submitWord(state, {
        path: coords.map(([q, r]) => ({ hexQ: q, hexR: r, slot: 0 })),
      });

      expect(result.valid).toBe(true);
      expect(result.word).toBe('кот');
      expect(result.points).toBeGreaterThan(0);
      expect(state.score).toBe(result.points);
      expect(state.wordCount).toBe(1);
    });

    it('rejects words not in dictionary', async () => {
      const hexKeys = [...state.hexagons.keys()];
      const path = findAdjacentHexPath(hexKeys, 3);
      if (!path) return;

      // Set up cells to spell "ъъъ"
      for (const key of path) {
        const hex = state.hexagons.get(key)!;
        hex[0] = { ...hex[0], char: 'ъ' };
      }

      const coords = path.map(k => k.split(',').map(Number));
      const result = await engine.submitWord(state, {
        path: coords.map(([q, r]) => ({ hexQ: q, hexR: r, slot: 0 })),
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('not_in_dictionary');
    });

    it('generates new cells after consuming a word', async () => {
      const hexKeys = [...state.hexagons.keys()];
      const path = findAdjacentHexPath(hexKeys, 3);
      if (!path) return;

      const letters = ['д', 'о', 'м'];
      for (let i = 0; i < 3; i++) {
        const hex = state.hexagons.get(path[i])!;
        hex[0] = { ...hex[0], char: letters[i], points: 1 };
      }

      const coords = path.map(k => k.split(',').map(Number));
      const result = await engine.submitWord(state, {
        path: coords.map(([q, r]) => ({ hexQ: q, hexR: r, slot: 0 })),
      });

      expect(result.valid).toBe(true);
      expect(result.newCells).toHaveLength(3);
      expect(result.consumedCells).toHaveLength(3);
    });
  });

  describe('checkCampaignCompletion', () => {
    it('returns false when below target', () => {
      state.score = 100;
      expect(engine.checkCampaignCompletion(state, 1000)).toBe(false);
    });

    it('returns true when at or above target', () => {
      state.score = 1000;
      expect(engine.checkCampaignCompletion(state, 1000)).toBe(true);
    });
  });
});

// Helper: finds N adjacent hexagons in a grid by key
import { areAdjacent } from '@hexawords/hex-math';

function findAdjacentHexPath(hexKeys: string[], length: number): string[] | null {
  for (const start of hexKeys) {
    const path = [start];
    if (dfs(hexKeys, path, length)) return path;
  }
  return null;
}

function dfs(hexKeys: string[], path: string[], target: number): boolean {
  if (path.length === target) return true;
  const [lastQ, lastR] = path[path.length - 1].split(',').map(Number);

  for (const key of hexKeys) {
    if (path.includes(key)) continue;
    const [q, r] = key.split(',').map(Number);
    if (!areAdjacent({ q: lastQ, r: lastR }, { q, r })) continue;
    path.push(key);
    if (dfs(hexKeys, path, target)) return true;
    path.pop();
  }
  return false;
}
