<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <div class="rules">
    <h1>Правила игры</h1>
    <p class="subtitle">Всё, что нужно знать, чтобы начать играть</p>

    <div class="card">
      <h2>&#x1F3AF; Цель игры</h2>
      <p>
        Собирай слова из русских букв, расположенных на гексагональном поле.
        Чем длиннее и реже слово — тем больше очков!
      </p>
    </div>

    <div class="card">
      <h2>&#x2B22; Как играть</h2>
      <ol>
        <li>На поле расположены <strong>хексагоны</strong>, в каждом по <strong>7 букв</strong>.</li>
        <li>Нажми на букву в любом хексагоне — это <strong>первая буква</strong> твоего слова.</li>
        <li>Следующую букву выбирай в <strong>соседнем</strong> хексагоне.</li>
        <li>Из каждого хексагона можно взять только <strong>одну букву</strong> за ход.</li>
        <li>Можно вернуться в ранее посещённый хексагон, если приходишь через <strong>другой</strong>.</li>
        <li>Минимальная длина слова — <strong>2 буквы</strong>.</li>
        <li>Нажми <strong>&#x2713;</strong> чтобы проверить и отправить слово.</li>
      </ol>
    </div>

    <div class="card">
      <h2>&#x2B50; Очки</h2>
      <ul>
        <li><strong>Длинные слова</strong> дают больше очков — чем больше букв, тем выше базовый балл.</li>
        <li><strong>Редкие слова</strong> (которые мало кто находит) дают бонус до <strong>3x</strong>.</li>
        <li><strong>Повторное слово</strong> принимается, но даёт только <strong>25%</strong> очков.</li>
        <li><strong>Серия слов</strong> подряд увеличивает множитель — не останавливайся!</li>
      </ul>
    </div>

    <div class="card">
      <h2>&#x1F3A8; Цвета букв</h2>
      <div class="color-legend">
        <div class="color-item">
          <span class="color-dot vowel"></span>
          <span><strong>Красные</strong> — гласные</span>
        </div>
        <div class="color-item">
          <span class="color-dot consonant"></span>
          <span><strong>Зелёные</strong> — согласные</span>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>&#x1F3AE; Режимы</h2>
      <div class="modes-list">
        <div class="mode-item">
          <span class="mode-icon">&#x2B22;</span>
          <div>
            <strong>Одиночная игра</strong>
            <p>Выбери сложность (количество хексагонов от 3 до 7) и набирай очки без ограничений.</p>
          </div>
        </div>
        <div class="mode-item">
          <span class="mode-icon">&#x2605;</span>
          <div>
            <strong>Кампания</strong>
            <p>31 уровень с нарастающей сложностью. На каждом уровне нужно набрать определённое количество очков.</p>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>&#x1F504; Перемешивание</h2>
      <p>
        Нажми кнопку <strong>&#x21BB;</strong> чтобы перемешать поле.
        Все буквы будут заменены на новые, а набранные очки и найденные слова <strong>обнулятся</strong>.
        Используй, если чувствуешь, что слов больше не осталось.
      </p>
    </div>

    <div class="card tip-card">
      <h2>&#x1F4A1; Совет</h2>
      <p>
        Начинай с коротких слов из 2-3 букв, чтобы набрать серию. Затем ищи длинные и редкие —
        они принесут максимум очков с учётом множителя серии!
      </p>
    </div>

    <button class="back-btn" @click="router.push('/')">
      &#x2190; На главную
    </button>
  </div>
</template>

<style scoped>
.rules {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1rem;
  max-width: 600px;
  margin: 0 auto;
  gap: 0.8rem;
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

h1 {
  font-size: 2.2rem;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  margin-bottom: 0;
}

.subtitle {
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  margin-bottom: 0.5rem;
  font-size: 1.05rem;
}

.card {
  width: 100%;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.6);
}

.card h2 {
  font-size: 1.25rem;
  margin: 0 0 0.75rem 0;
  color: #1a1a2e;
}

.card p {
  margin: 0;
  color: #333;
  line-height: 1.6;
}

.card ol,
.card ul {
  margin: 0;
  padding-left: 1.25rem;
  color: #333;
}

.card li {
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.card li:last-child {
  margin-bottom: 0;
}

.color-legend {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.color-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #333;
  font-size: 1rem;
}

.color-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
}

.color-dot.vowel {
  background: #e53935;
  box-shadow: 0 2px 6px rgba(229, 57, 53, 0.4);
}

.color-dot.consonant {
  background: #43a047;
  box-shadow: 0 2px 6px rgba(67, 160, 71, 0.4);
}

.modes-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.mode-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.mode-item .mode-icon {
  font-size: 2rem;
  flex-shrink: 0;
  line-height: 1;
  margin-top: 0.1rem;
}

.mode-item div p {
  margin-top: 0.25rem;
  font-size: 0.9rem;
  color: #555;
}

.tip-card {
  background: rgba(255, 243, 224, 0.9);
  border-color: rgba(255, 183, 77, 0.4);
}

.back-btn {
  margin-top: 0.5rem;
  padding: 0.75rem 2rem;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 12px;
  font-size: 1rem;
  cursor: pointer;
  color: #333;
  transition: all 0.2s;
}

.back-btn:hover {
  border-color: #1976d2;
  color: #1976d2;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

@media (max-width: 640px) {
  .rules {
    padding: 1.5rem 0.75rem;
  }

  h1 {
    font-size: 1.75rem;
  }

  .card {
    padding: 1.25rem;
    border-radius: 12px;
  }
}
</style>
