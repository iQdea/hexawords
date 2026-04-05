import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { areAdjacent } from '@hexawords/hex-math';
import type { CellDTO, HexagonDTO, WordPathStep } from '@hexawords/types';
import { CAMPAIGN_LEVELS } from '@hexawords/types';
import { useApi } from '@/composables/useApi';

interface GameResponse {
  id: string;
  mode: string;
  complexity: string | null;
  level: number | null;
  status: string;
  score: number;
  wordCount: number;
  hexCount: number;
  cellsPerHex: number;
  hexagons: HexagonDTO[];
  words?: Array<{ word: string; points: number }>;
}

export const useGameStore = defineStore('game', () => {
  const api = useApi();

  const gameId = ref<string | null>(null);
  const mode = ref<string>('single');
  const level = ref<number | null>(null);
  const targetScore = ref<number | null>(null);
  const status = ref<string>('idle');
  const hexagons = ref<HexagonDTO[]>([]);
  const selectedPath = ref<WordPathStep[]>([]);
  const score = ref(0);
  const wordCount = ref(0);
  const lastWord = ref<string | null>(null);
  const lastWordPoints = ref(0);
  const error = ref<string | null>(null);
  const foundWords = ref<Array<{ word: string; points: number }>>([]);

  const currentWord = computed(() =>
    selectedPath.value
      .map(step => {
        const hex = hexagons.value.find(h => h.q === step.hexQ && h.r === step.hexR);
        return hex?.cells[step.slot]?.char ?? '';
      })
      .join('')
  );

  /** Set of "hexQ,hexR" for hexagons used in current path. */
  const usedHexKeys = computed(() =>
    new Set(selectedPath.value.map(s => `${s.hexQ},${s.hexR}`))
  );

  /** Set of "hexQ,hexR,slot" for selected cells. */
  const selectedCellKeys = computed(() =>
    new Set(selectedPath.value.map(s => `${s.hexQ},${s.hexR},${s.slot}`))
  );

  function loadGame(data: GameResponse) {
    gameId.value = data.id;
    mode.value = data.mode;
    level.value = data.level;
    status.value = data.status;
    score.value = data.score;
    wordCount.value = data.wordCount;
    hexagons.value = data.hexagons;
    selectedPath.value = [];
    error.value = null;
    foundWords.value = data.words ?? [];

    // Set campaign target
    if (data.mode === 'campaign' && data.level) {
      const lvl = CAMPAIGN_LEVELS.find(l => l.level === data.level);
      targetScore.value = lvl?.targetScore ?? null;
    } else {
      targetScore.value = null;
    }
  }

  async function startGame(gameMode: string, complexity?: string, level?: number) {
    const data = await api.post<GameResponse>('/games/new', {
      mode: gameMode,
      complexity,
      level,
    });
    loadGame(data);
  }

  function selectCell(hexQ: number, hexR: number, slot: number) {
    const cellKey = `${hexQ},${hexR},${slot}`;

    // If this exact cell is the last selected — deselect
    const last = selectedPath.value[selectedPath.value.length - 1];
    if (last && last.hexQ === hexQ && last.hexR === hexR && last.slot === slot) {
      selectedPath.value = selectedPath.value.slice(0, -1);
      return;
    }

    // If this exact cell (hex+slot) is already in path — ignore
    if (selectedCellKeys.value.has(cellKey)) return;

    // If there's a previous step:
    // - can't pick from the SAME hexagon consecutively
    // - must be ADJACENT hexagon
    if (selectedPath.value.length > 0) {
      const prev = selectedPath.value[selectedPath.value.length - 1]!;
      if (prev.hexQ === hexQ && prev.hexR === hexR) return;
      if (!areAdjacent({ q: prev.hexQ, r: prev.hexR }, { q: hexQ, r: hexR })) return;
    }

    // Check cell is active
    const hex = hexagons.value.find(h => h.q === hexQ && h.r === hexR);
    const cell = hex?.cells[slot];
    if (!cell || !cell.isActive) return;

    selectedPath.value = [...selectedPath.value, { hexQ, hexR, slot }];
  }

  function clearSelection() {
    selectedPath.value = [];
  }

  async function submitWord() {
    if (!gameId.value || selectedPath.value.length < 2) return;

    error.value = null;
    try {
      const result = await api.post<{ valid: boolean; word: string; points?: number; reason?: string; consumedCells?: Array<{ hexQ: number; hexR: number; slot: number }>; totalScore?: number; campaignComplete?: boolean }>(`/games/${gameId.value}/submit-word`, {
        path: selectedPath.value,
      });

      if (result.valid) {
        score.value = result.totalScore ?? 0;
        wordCount.value += 1;
        lastWord.value = result.word;
        lastWordPoints.value = result.points ?? 0;
        const newWord = { word: result.word, points: result.points ?? 0 };
        const idx = foundWords.value.findIndex(w => w.points < newWord.points);
        if (idx === -1) {
          foundWords.value = [...foundWords.value, newWord];
        } else {
          const copy = [...foundWords.value];
          copy.splice(idx, 0, newWord);
          foundWords.value = copy;
        }

        if (result.campaignComplete) {
          status.value = 'finished';
        }

        // Mark consumed cells as inactive
        if (result.consumedCells) {
          for (const step of result.consumedCells) {
            const hex = hexagons.value.find(h => h.q === step.hexQ && h.r === step.hexR);
            if (hex?.cells[step.slot]) {
              hex!.cells[step.slot]!.isActive = false;
            }
          }
        }
      } else {
        error.value = translateReason(result.reason);
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Ошибка';
    }

    selectedPath.value = [];
  }

  /** Called from WebSocket when cells are respawned. */
  function handleCellRespawn(cells: CellDTO[]) {
    for (const cell of cells) {
      const hex = hexagons.value.find(h => h.q === cell.hexQ && h.r === cell.hexR);
      if (hex?.cells[cell.slot]) {
        hex!.cells[cell.slot] = { ...cell, isActive: true };
      }
    }
  }

  function resetGame() {
    gameId.value = null;
    mode.value = 'single';
    level.value = null;
    targetScore.value = null;
    status.value = 'idle';
    hexagons.value = [];
    selectedPath.value = [];
    score.value = 0;
    wordCount.value = 0;
    lastWord.value = null;
    lastWordPoints.value = 0;
    error.value = null;
    foundWords.value = [];
  }

  return {
    gameId, mode, level, targetScore, status, hexagons, selectedPath,
    currentWord, usedHexKeys, selectedCellKeys,
    score, wordCount, lastWord, lastWordPoints, error, foundWords,
    startGame, selectCell, clearSelection, submitWord,
    handleCellRespawn, resetGame,
  };
});

const REASON_MAP: Record<string, string> = {
  not_in_dictionary: 'Слово не найдено в словаре',
  not_adjacent: 'Хексагоны должны быть соседними',
  too_short: 'Слово слишком короткое (мин. 2 буквы)',
  same_hexagon: 'Нельзя брать две буквы из одного хексагона',
};

function translateReason(reason?: string): string {
  return REASON_MAP[reason || ''] ?? reason ?? 'Неизвестная ошибка';
}
