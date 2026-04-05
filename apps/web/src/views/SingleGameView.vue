<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import { GameComplexity } from '@hexawords/types';
import GameBoard from '../components/game/GameBoard.vue';

const router = useRouter();
const game = useGameStore();
const loading = ref(false);
const errorMsg = ref('');

const complexities: Array<{ value: GameComplexity; label: string }> = [
  { value: GameComplexity.CRAZY, label: 'Безумие' },
  { value: GameComplexity.HARD, label: 'Сложно' },
  { value: GameComplexity.MIDDLE, label: 'Средне' },
  { value: GameComplexity.EASY, label: 'Легко' },
];

onUnmounted(() => game.resetGame());

async function start(c: GameComplexity) {
  loading.value = true;
  errorMsg.value = '';
  try {
    await game.startGame('single' as any, c);
  } catch (e: any) {
    errorMsg.value = e.message ?? 'Ошибка создания игры';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="single-game">
    <template v-if="!game.gameId">
      <div class="picker">
        <button class="btn-back" @click="router.push('/')">&#8592; На главную</button>
        <h2>Выбери сложность</h2>
        <div v-if="errorMsg" class="error">{{ errorMsg }}</div>
        <div class="complexity-grid">
          <button
            v-for="c in complexities"
            :key="c.value"
            class="complexity-btn"
            :disabled="loading"
            @click="start(c.value)"
          >
            <span class="c-label">{{ c.label }}</span>
          </button>
        </div>
      </div>
    </template>

    <template v-else>
      <GameBoard />
    </template>
  </div>
</template>

<style scoped>
.single-game {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 60px);
}

.picker {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.btn-back {
  background: rgba(255,255,255,0.7);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 8px;
  padding: 0.4rem 1rem;
  cursor: pointer;
  font-size: 0.85rem;
  color: #555;
  backdrop-filter: blur(4px);
  align-self: flex-start;
}
.btn-back:hover { background: rgba(255,255,255,0.9); }

h2 {
  color: #fff;
  text-shadow: 0 2px 6px rgba(0,0,0,0.2);
}

.error {
  color: #e53935;
  padding: 0.5rem 1rem;
  background: rgba(255,235,238,0.9);
  border-radius: 8px;
  font-size: 0.9rem;
}

.complexity-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  max-width: 420px;
}

.complexity-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 1.5rem;
  border: 2px solid rgba(255,255,255,0.4);
  border-radius: 14px;
  background: rgba(255,255,255,0.8);
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: all 0.2s;
}

.complexity-btn:hover {
  border-color: #66bb6a;
  background: rgba(255,255,255,0.95);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.complexity-btn:disabled {
  opacity: 0.5;
}

.c-label {
  font-size: 1.2rem;
  font-weight: bold;
}

.c-desc {
  font-size: 0.75rem;
  color: #888;
}
</style>
