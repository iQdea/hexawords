<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useGameStore } from '@/stores/game';
import { useApi } from '@/composables/useApi';
import GameBoard from '@/components/game/GameBoard.vue';

interface CampaignLevel {
  level: number;
  hex_count: number;
  min_word_length: number;
  target_score: number;
}

const router = useRouter();
const route = useRoute();
const game = useGameStore();
const api = useApi();
const loading = ref(false);
const campaignLevels = ref<CampaignLevel[]>([]);
const completedLevels = ref(new Set<number>());
const maxUnlocked = computed(() => {
  if (completedLevels.value.size === 0) return 1;
  let max = 0;
  for (const l of completedLevels.value) {
    if (l > max) max = l;
  }
  return max + 1;
});

const totalLevels = computed(() => campaignLevels.value.length);
const hasPrev = computed(() => game.level !== null && game.level > 1);
const hasNext = computed(() => {
  if (game.level === null || game.level >= totalLevels.value) return false;
  // If current level just finished, next is unlocked
  if (game.status === 'finished') return true;
  const next = game.level + 1;
  return next <= maxUnlocked.value || completedLevels.value.has(next);
});

async function loadProgress() {
  try {
    const levels = await api.get<CampaignLevel[]>('/games/campaign/levels');
    const progress = await api.get<{ completedLevels: Array<{ level: number; score: number }> }>('/games/campaign/progress');
    campaignLevels.value = levels;
    completedLevels.value = new Set(progress.completedLevels.map(l => l.level));
  } catch {
    // Not authenticated or no progress
  }
}

onMounted(async () => {
  await loadProgress();

  // Restore game from URL query
  const levelParam = Number(route.query.level);
  if (levelParam > 0 && !game.gameId) {
    if (levelParam <= maxUnlocked.value || completedLevels.value.has(levelParam)) {
      await startLevel(levelParam);
    } else {
      router.replace({ query: {} });
    }
  }
});

onUnmounted(() => game.resetGame());

async function startLevel(level: number) {
  loading.value = true;
  try {
    await game.startGame('campaign', undefined, level);
    router.replace({ query: { level: String(level) } });
  } finally {
    loading.value = false;
  }
}

function goToLevelList() {
  game.resetGame();
  router.replace({ query: {} });
  loadProgress();
}

async function goToLevel(level: number) {
  if (level < 1 || level > totalLevels.value) return;
  // If current level just finished, allow next
  const justUnlocked = game.status === 'finished' && game.level !== null && level === game.level + 1;
  if (!justUnlocked && level > maxUnlocked.value && !completedLevels.value.has(level)) return;
  loading.value = true;
  try {
    await game.startGame('campaign', undefined, level);
    router.replace({ query: { level: String(level) } });
  } finally {
    loading.value = false;
  }
}

function gridLabel(size: number): string {
  if (size <= 4) return 'XS';
  if (size <= 7) return 'S';
  if (size <= 13) return 'M';
  return 'L';
}

function formatScore(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}
</script>

<template>
  <div class="campaign">
    <template v-if="!game.gameId">
      <div class="picker">
      <button class="btn-back" @click="router.push('/')">&#8592; На главную</button>
      <h2>Кампания</h2>
      <p class="subtitle">{{ campaignLevels.length }} уровней с нарастающей сложностью</p>

      <div class="level-grid">
        <button
          v-for="lvl in campaignLevels"
          :key="lvl.level"
          class="level-btn"
          :class="{
            completed: completedLevels.has(lvl.level),
            locked: lvl.level > maxUnlocked,
          }"
          :disabled="loading || lvl.level > maxUnlocked"
          @click="startLevel(lvl.level)"
        >
          <span v-if="lvl.level > maxUnlocked" class="level-lock">&#x1F512;</span>
          <span v-else-if="completedLevels.has(lvl.level)" class="level-check">&#x2713;</span>
          <span class="level-num">{{ lvl.level }}</span>
          <span class="level-meta">{{ gridLabel(lvl.hex_count) }} / {{ formatScore(lvl.target_score) }}</span>
        </button>
      </div>
      </div>
    </template>

    <template v-else>
      <GameBoard @next-level="hasNext && goToLevel(game.level! + 1)" @to-level-list="goToLevelList()">
        <template #nav>
          <div class="level-nav">
            <button v-if="hasPrev" class="nav-btn" @click="goToLevel(game.level! - 1)">&#8592; Ур. {{ game.level! - 1 }}</button>
            <button class="nav-btn" @click="goToLevelList()">Уровни</button>
            <button v-if="hasNext" class="nav-btn" @click="goToLevel(game.level! + 1)">Ур. {{ game.level! + 1 }} &#8594;</button>
          </div>
        </template>
      </GameBoard>
    </template>
  </div>
</template>

<style scoped>
.campaign {
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
  gap: 0.5rem;
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

.subtitle {
  color: rgba(255,255,255,0.8);
  margin-bottom: 1rem;
  font-size: 0.9rem;
  text-shadow: 0 1px 3px rgba(0,0,0,0.15);
}

.level-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 0.5rem;
  max-width: 520px;
  width: 100%;
}

.level-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: 0.5rem 0.2rem;
  border: 2px solid rgba(255,255,255,0.4);
  border-radius: 10px;
  background: rgba(255,255,255,0.75);
  backdrop-filter: blur(6px);
  cursor: pointer;
  transition: all 0.15s;
}

.level-btn:hover:not(:disabled) {
  border-color: #ff9800;
  background: #fff3e0;
  transform: translateY(-1px);
}

.level-btn.completed {
  border-color: #43a047;
  background: #e8f5e9;
}

.level-btn.locked {
  opacity: 0.45;
  cursor: not-allowed;
}

.level-btn:disabled {
  cursor: not-allowed;
}

.level-lock {
  font-size: 0.7rem;
}

.level-check {
  color: #43a047;
  font-size: 0.9rem;
  font-weight: bold;
}

.level-num {
  font-size: 1.2rem;
  font-weight: bold;
  line-height: 1;
}

.level-meta {
  font-size: 0.55rem;
  color: #999;
  text-transform: uppercase;
}

.level-nav {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.nav-btn {
  background: rgba(255,255,255,0.75);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 8px;
  padding: 0.3rem 0.8rem;
  cursor: pointer;
  font-size: 0.8rem;
  color: #555;
  backdrop-filter: blur(4px);
  transition: all 0.15s;
}

.nav-btn:hover {
  background: rgba(255,255,255,0.95);
  border-color: #1976d2;
  color: #1976d2;
}
</style>
