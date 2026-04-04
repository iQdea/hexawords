<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '../composables/useApi';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const api = useApi();
const auth = useAuthStore();

const mode = ref<'login' | 'register'>('login');
const email = ref('');
const password = ref('');
const nickname = ref('');
const error = ref('');
const loading = ref(false);

async function handleSubmit() {
  error.value = '';
  loading.value = true;

  try {
    if (mode.value === 'register') {
      // If already anonymous — upgrade account
      if (auth.isAuthenticated && auth.userId) {
        const result = await api.post<{ userId: string }>('/auth/upgrade', {
          email: email.value,
          password: password.value,
          nickname: nickname.value || undefined,
        });
        auth.userId = result.userId;
      } else {
        const result = await api.post<{ userId: string }>('/auth/sign-up', {
          email: email.value,
          password: password.value,
          nickname: nickname.value || undefined,
        });
        auth.userId = result.userId;
        localStorage.setItem('hexawords-user-id', result.userId);
      }
    } else {
      const result = await api.post<{ userId: string }>('/auth/sign-in', {
        email: email.value,
        password: password.value,
      });
      auth.userId = result.userId;
      localStorage.setItem('hexawords-user-id', result.userId);
    }

    auth.isAuthenticated = true;
    router.push('/');
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="card">
      <div class="tabs">
        <button :class="{ active: mode === 'login' }" @click="mode = 'login'">Вход</button>
        <button :class="{ active: mode === 'register' }" @click="mode = 'register'">Регистрация</button>
      </div>

      <form @submit.prevent="handleSubmit" class="form">
        <input
          v-if="mode === 'register'"
          v-model="nickname"
          type="text"
          placeholder="Никнейм"
          maxlength="32"
          class="input"
        />
        <input
          v-model="email"
          type="email"
          placeholder="Email"
          required
          class="input"
        />
        <input
          v-model="password"
          type="password"
          placeholder="Пароль"
          required
          minlength="6"
          class="input"
        />

        <div v-if="error" class="error">{{ error }}</div>

        <button type="submit" class="btn-submit" :disabled="loading">
          {{ loading ? '...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться' }}
        </button>
      </form>

      <p v-if="auth.isAuthenticated && mode === 'register'" class="hint">
        Ваш анонимный прогресс будет сохранён
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  justify-content: center;
  padding: 3rem 1rem;
}

.card {
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 2rem;
  width: 100%;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  max-width: 380px;
  border: 1px solid rgba(255,255,255,0.3);
}

.tabs {
  display: flex;
  gap: 0;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #e8e8e8;
}

.tabs button {
  flex: 1;
  padding: 0.6rem;
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  color: #888;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.15s;
}

.tabs button.active {
  color: #1976d2;
  border-bottom-color: #1976d2;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.input {
  padding: 0.65rem 0.9rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.15s;
}

.input:focus {
  border-color: #1976d2;
}

.btn-submit {
  padding: 0.75rem;
  background: #1976d2;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.15s;
}

.btn-submit:hover:not(:disabled) {
  background: #1565c0;
}

.btn-submit:disabled {
  opacity: 0.5;
}

.error {
  color: #e53935;
  font-size: 0.85rem;
  padding: 0.3rem 0;
}

.hint {
  text-align: center;
  font-size: 0.8rem;
  color: #888;
  margin-top: 1rem;
}
</style>
