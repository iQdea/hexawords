<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <div class="home">
    <h1>Hexawords</h1>
    <p class="subtitle">Собирай слова из букв на гексагональном поле</p>

    <div class="modes">
      <button class="mode-btn" @click="router.push('/game/single')">
        <span class="mode-icon">&#x2B22;</span>
        <span class="mode-title">Одиночная игра</span>
        <span class="mode-desc">Выбери сложность и собирай слова</span>
      </button>

      <button class="mode-btn" @click="router.push('/game/campaign')">
        <span class="mode-icon">&#x2605;</span>
        <span class="mode-title">Кампания</span>
        <span class="mode-desc">31 уровень с нарастающей сложностью</span>
      </button>
    </div>

  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  min-height: 80vh;
  justify-content: center;
}

h1 {
  font-size: 3rem;
  margin-bottom: 0.5rem;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.subtitle {
  color: rgba(255,255,255,0.8);
  margin-bottom: 3rem;
  text-shadow: 0 1px 4px rgba(0,0,0,0.2);
}

.modes {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  border: 2px solid rgba(255,255,255,0.5);
  border-radius: 16px;
  background: rgba(255,255,255,0.8);
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: all 0.2s;
  width: 200px;
}

.mode-btn:hover {
  border-color: #1976d2;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.mode-icon {
  font-size: 2.5rem;
}

.mode-title {
  font-size: 1.2rem;
  font-weight: bold;
}

.mode-desc {
  font-size: 0.8rem;
  color: #888;
  text-align: center;
}

.leaderboard-link {
  margin-top: 2rem;
  background: none;
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  color: #666;
  transition: all 0.2s;
}

.leaderboard-link:hover {
  border-color: #1976d2;
  color: #1976d2;
}
</style>
