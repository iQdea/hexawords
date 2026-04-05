<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { useGameStore } from '@/stores/game';
import { useSocket } from '@/composables/useSocket';
import { useApi } from '@/composables/useApi';
import HexGrid from '@/components/hex/HexGrid.vue';

const game = useGameStore();
const socket = useSocket();
const api = useApi();
const submitting = ref(false);
const resetting = ref(false);
const showResetConfirm = ref(false);
async function handleReset() {
  if (!game.gameId) return;
  resetting.value = true;
  try {
    const data = await api.post<{ score: number; wordCount: number; hexagons: typeof game.hexagons }>(`/games/${game.gameId}/reset`, {});
    game.score = data.score;
    game.wordCount = data.wordCount;
    game.hexagons = data.hexagons;
    game.foundWords = [];
    game.lastWord = null;
    game.lastWordPoints = 0;
    game.error = null;
    game.clearSelection();
  } catch (e: unknown) {
    game.error = e instanceof Error ? e.message : 'Ошибка';
  } finally {
    resetting.value = false;
    showResetConfirm.value = false;
  }
}

watch(() => game.gameId, (id) => {
  if (id) {
    socket.connect();
    socket.joinGame(id);
  }
}, { immediate: true });

socket.onCellsRespawned((data) => {
  if (data.gameId !== game.gameId) return;
  game.handleCellRespawn(data.cells);
});

socket.onScoreUpdate((data) => {
  if (data.gameId !== game.gameId) return;
  // Score and wordCount already updated from submitWord response.
  // WebSocket only used for lastWord display when needed.
});

socket.onGameFinished((data) => {
  if (data.gameId !== game.gameId) return;
  game.status = 'finished';
});

onUnmounted(() => socket.disconnect());

async function handleSubmit() {
  submitting.value = true;
  try {
    await game.submitWord();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="game-board">
    <div class="word-bar">
      <div class="word-preview" :class="{ active: game.currentWord }">
        {{ game.currentWord ? game.currentWord.toUpperCase() : '\u00A0' }}
      </div>
      <transition name="fade">
        <div v-if="game.error" class="error">{{ game.error }}</div>
      </transition>
    </div>

    <div class="main-area">
      <!-- Left: controls -->
      <div class="controls-col">
        <button class="ctrl-btn" @click="game.resetGame()" title="Назад">&#8592;</button>
        <button
          class="ctrl-btn ctrl-submit"
          :disabled="game.selectedPath.length < 2 || submitting"
          @click="handleSubmit"
          title="Проверить"
        >&#10003;</button>
        <button
          class="ctrl-btn"
          :disabled="game.selectedPath.length === 0"
          @click="game.clearSelection()"
          title="Сбросить"
        >&#10005;</button>
        <button
          v-if="game.score > 0"
          class="ctrl-btn"
          @click="showResetConfirm = true"
          title="Перемешать"
        >&#x21bb;</button>
      </div>

      <!-- Center: hex grid -->
      <div class="field-col">
        <HexGrid
          :hexagons="game.hexagons"
          :selected-path="game.selectedPath"
          :used-hex-keys="game.usedHexKeys"
          :selected-cell-keys="game.selectedCellKeys"
          @cell-click="(hq, hr, s) => game.selectCell(hq, hr, s)"
        />
      </div>

      <!-- Right: scores + words -->
      <div class="side-panel">
        <div class="scores-row">
          <div class="score-block">
            <div class="score-value">{{ game.score }}</div>
            <div class="score-label">очков</div>
          </div>
          <div class="score-block">
            <div class="score-value">{{ game.wordCount }}</div>
            <div class="score-label">слов</div>
          </div>
        </div>
        <div v-if="game.targetScore" class="target-bar">
          <div class="target-label">Цель: {{ game.targetScore.toLocaleString() }}</div>
          <div class="target-track">
            <div class="target-fill" :style="{ width: Math.min(100, game.score / game.targetScore * 100) + '%' }"></div>
          </div>
        </div>
        <div class="divider" v-if="game.foundWords.length > 0"></div>
        <div v-for="(w, i) in game.foundWords.slice(0, 10)" :key="i" class="found-word" :class="{ repeat: w.repeat }">
          <span class="fw-word">{{ w.word }}</span>
          <span class="fw-pts">+{{ w.points }}</span>
        </div>
      </div>
    </div>

    <!-- Reset confirmation -->
    <transition name="fade">
      <div v-if="showResetConfirm" class="confirm-overlay" @click.self="showResetConfirm = false">
        <div class="confirm-dialog">
          <p class="confirm-title">Перемешать поле?</p>
          <p class="confirm-text">
            Все буквы будут заменены новыми.<br>
            Очки и счётчик слов обнулятся.
          </p>
          <div class="confirm-actions">
            <button class="btn submit" :disabled="resetting" @click="handleReset">
              {{ resetting ? '...' : 'Да, перемешать' }}
            </button>
            <button class="btn clear" @click="showResetConfirm = false">Отмена</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.game-board {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.word-bar {
  text-align: center;
  padding: 0.2rem 0;
  flex-shrink: 0;
}

.word-preview {
  font-size: 1.6rem;
  font-weight: bold;
  letter-spacing: 0.15em;
  color: rgba(255,255,255,0.3);
  transition: color 0.2s;
  text-shadow: 0 2px 4px rgba(0,0,0,0.15);
}
.word-preview.active { color: #fff; text-shadow: 0 2px 8px rgba(25,118,210,0.5); }

.error {
  color: #e53935; font-size: 0.8rem;
  padding: 0.2rem 0.8rem; background: rgba(255,235,238,0.9); border-radius: 6px;
  display: inline-block;
}

.main-area {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0 0.3rem;
}

/* Left: icon buttons stacked */
.controls-col {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex-shrink: 0;
  align-self: center;
}

.ctrl-btn {
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 10px;
  background: rgba(255,255,255,0.6);
  backdrop-filter: blur(4px);
  cursor: pointer;
  font-size: 1.1rem;
  color: #555;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.ctrl-btn:hover { background: rgba(255,255,255,0.85); }
.ctrl-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.ctrl-btn.ctrl-submit { background: rgba(25,118,210,0.8); color: #fff; }
.ctrl-btn.ctrl-submit:hover:not(:disabled) { background: rgba(25,118,210,0.95); }

/* Center: hex field */
.field-col {
}

/* Right: scores + words */
.side-panel {
  width: 130px;
  flex-shrink: 0;
  align-self: center;
  background: rgba(255,255,255,0.55);
  backdrop-filter: blur(8px);
  border-radius: 10px;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.scores-row {
  display: flex;
  gap: 0.6rem;
  justify-content: center;
}
.score-block { text-align: center; }
.score-value { font-size: 1.3rem; font-weight: bold; color: #1565c0; line-height: 1; }
.score-label { font-size: 0.6rem; color: #777; text-transform: uppercase; }

.target-bar { padding: 0.15rem 0; }
.target-label { font-size: 0.6rem; color: #666; text-align: center; margin-bottom: 0.15rem; }
.target-track { height: 5px; background: rgba(0,0,0,0.08); border-radius: 3px; overflow: hidden; }
.target-fill { height: 100%; background: #43a047; border-radius: 3px; transition: width 0.3s; }

.divider { height: 1px; background: rgba(0,0,0,0.06); margin: 0.1rem 0; }

.found-word {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.15rem 0.35rem; border-radius: 5px;
  background: rgba(255,255,255,0.35); font-size: 0.75rem;
}
.fw-word { font-weight: 500; }
.fw-pts { color: #43a047; font-size: 0.68rem; font-weight: 600; }
.found-word.repeat { opacity: 0.5; }
.found-word.repeat .fw-pts { color: #999; }

/* Confirm dialog */
.confirm-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 200; backdrop-filter: blur(4px);
}
.confirm-dialog {
  background: rgba(255,255,255,0.92); backdrop-filter: blur(12px);
  border-radius: 16px; padding: 1.5rem 2rem; max-width: 320px;
  text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}
.confirm-title { font-size: 1.1rem; font-weight: bold; margin-bottom: 0.5rem; }
.confirm-text { font-size: 0.85rem; color: #555; margin-bottom: 1rem; line-height: 1.4; }
.confirm-actions { display: flex; gap: 0.6rem; justify-content: center; }
.confirm-actions .btn { padding: 0.5rem 1.2rem; border: none; border-radius: 8px; font-size: 0.9rem; cursor: pointer; font-weight: 500; }
.confirm-actions .btn.submit { background: #1976d2; color: #fff; }
.confirm-actions .btn.clear { background: rgba(0,0,0,0.06); color: #555; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

</style>
