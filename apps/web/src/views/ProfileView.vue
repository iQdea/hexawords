<script setup lang="ts">
import {onMounted, ref} from 'vue';
import {useApi} from '@/composables/useApi';
import {useAuthStore} from '@/stores/auth';

const api = useApi();
const auth = useAuthStore();
const loading = ref(true);
const saving = ref(false);

const profile = ref({ nickname: '', createdAt: '' });
const stats = ref({ gamesPlayed: 0, totalScore: 0, totalWords: 0, bestGameScore: 0, campaignLevelsCompleted: 0 });
const words = ref<Array<{ word: string; points: number; mode: string; createdAt: string }>>([]);
const nickname = ref('');

onMounted(async () => {
  try {
    const p = await api.get<typeof profile.value>('/user/profile');
    const s = await api.get<typeof stats.value>('/user/stats');
    const w = await api.get<{ words: typeof words.value; total: number }>('/user/words?limit=30');
    profile.value = p;
    stats.value = s;
    words.value = w.words;
    nickname.value = p.nickname;
  } catch {
    // Not authenticated
  } finally {
    loading.value = false;
  }
});

async function saveNickname() {
  if (!nickname.value.trim() || saving.value) return;
  saving.value = true;
  try {
    profile.value = await api.patch<typeof profile.value>('/user/profile', {nickname: nickname.value.trim()});
  } finally {
    saving.value = false;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}
</script>

<template>
  <div class="profile-page">
    <div v-if="loading" class="loading">Загрузка...</div>

    <template v-else-if="!auth.isAuthenticated">
      <p class="empty">Войдите чтобы увидеть профиль</p>
    </template>

    <template v-else>
      <section class="card">
        <h2>Профиль</h2>
        <div class="nickname-row">
          <input
            v-model="nickname"
            class="nick-input"
            placeholder="Никнейм"
            maxlength="32"
            @keyup.enter="saveNickname"
          />
          <button class="btn-save" :disabled="saving || nickname === profile.nickname" @click="saveNickname">
            {{ saving ? '...' : 'Сохранить' }}
          </button>
        </div>
        <p class="joined">Играет с {{ formatDate(profile.createdAt) }}</p>
      </section>

      <section class="card">
        <h2>Статистика</h2>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-val">{{ stats.gamesPlayed }}</span>
            <span class="stat-lbl">Игр</span>
          </div>
          <div class="stat-item">
            <span class="stat-val">{{ stats.totalScore.toLocaleString() }}</span>
            <span class="stat-lbl">Очков</span>
          </div>
          <div class="stat-item">
            <span class="stat-val">{{ stats.totalWords }}</span>
            <span class="stat-lbl">Слов</span>
          </div>
          <div class="stat-item">
            <span class="stat-val">{{ stats.bestGameScore.toLocaleString() }}</span>
            <span class="stat-lbl">Лучшая игра</span>
          </div>
          <div class="stat-item">
            <span class="stat-val">{{ stats.campaignLevelsCompleted }}</span>
            <span class="stat-lbl">Кампания</span>
          </div>
        </div>
      </section>

      <section class="card" v-if="words.length > 0">
        <h2>Последние слова</h2>
        <div class="word-list">
          <div v-for="(w, i) in words" :key="i" class="word-item">
            <span class="w-word">{{ w.word }}</span>
            <span class="w-pts">+{{ w.points }}</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.profile-page {
  max-width: 500px;
  margin: 0 auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.loading, .empty {
  text-align: center;
  color: rgba(255,255,255,0.8);
  padding: 3rem 0;
}

.card {
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(10px);
  border-radius: 14px;
  padding: 1.25rem;
  border: 1px solid rgba(255,255,255,0.3);
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}

.card h2 {
  font-size: 1rem;
  margin-bottom: 0.75rem;
  color: #555;
}

.nickname-row {
  display: flex;
  gap: 0.5rem;
}

.nick-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  outline: none;
}

.nick-input:focus {
  border-color: #1976d2;
}

.btn-save {
  padding: 0.5rem 1rem;
  background: #1976d2;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-save:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.joined {
  font-size: 0.8rem;
  color: #aaa;
  margin-top: 0.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-val {
  font-size: 1.4rem;
  font-weight: bold;
}

.stat-lbl {
  font-size: 0.7rem;
  color: #888;
  text-transform: uppercase;
}

.word-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.word-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.6rem;
  background: #f5f5f5;
  border-radius: 6px;
  font-size: 0.85rem;
}

.w-word {
  font-weight: 500;
}

.w-pts {
  color: #43a047;
  font-size: 0.75rem;
}
</style>
