<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi } from '../composables/useApi';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  nickname: string;
  score: number;
  wordCount: number;
  mode: string;
  complexity: string | null;
}

const api = useApi();
const entries = ref<LeaderboardEntry[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    entries.value = await api.get('/leaderboard?limit=20');
  } catch {
    // empty board
  } finally {
    loading.value = false;
  }
});

function modeLabel(mode: string, complexity: string | null): string {
  if (mode === 'campaign') return 'Кампания';
  const map: Record<string, string> = { easy: 'Легко', middle: 'Средне', hard: 'Сложно', crazy: 'Безумие' };
  return complexity ? map[complexity] ?? complexity : 'Одиночная';
}
</script>

<template>
  <div class="leaderboard">
    <h2>Лидерборд</h2>

    <div v-if="loading" class="loading">Загрузка...</div>

    <div v-else-if="entries.length === 0" class="empty">
      Пока нет результатов. Будь первым!
    </div>

    <table v-else class="board">
      <thead>
        <tr>
          <th>#</th>
          <th>Игрок</th>
          <th>Режим</th>
          <th>Слов</th>
          <th>Очки</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="e in entries" :key="e.rank">
          <td class="rank">{{ e.rank }}</td>
          <td class="nickname">{{ e.nickname }}</td>
          <td class="mode">{{ modeLabel(e.mode, e.complexity) }}</td>
          <td class="words">{{ e.wordCount }}</td>
          <td class="score">{{ e.score.toLocaleString() }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.leaderboard {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
}

h2 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #fff;
  text-shadow: 0 2px 6px rgba(0,0,0,0.2);
}

.loading, .empty {
  text-align: center;
  color: rgba(255,255,255,0.8);
  padding: 3rem 0;
}

.board {
  width: 100%;
  border-collapse: collapse;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(10px);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.board th {
  text-align: left;
  padding: 0.7rem 0.75rem;
  border-bottom: 2px solid rgba(0,0,0,0.06);
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #888;
  background: rgba(255,255,255,0.5);
}

.board td {
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid rgba(0,0,0,0.04);
}

.rank {
  font-weight: bold;
  color: #888;
  width: 2rem;
}

.nickname {
  font-weight: 500;
}

.mode {
  font-size: 0.85rem;
  color: #666;
}

.words {
  text-align: center;
}

.score {
  font-weight: bold;
  text-align: right;
  color: #1976d2;
}

tr:nth-child(1) .rank { color: #ffd700; }
tr:nth-child(2) .rank { color: #c0c0c0; }
tr:nth-child(3) .rank { color: #cd7f32; }
</style>
