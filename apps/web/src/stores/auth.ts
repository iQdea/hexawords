import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useApi } from '../composables/useApi';

export const useAuthStore = defineStore('auth', () => {
  const api = useApi();
  const userId = ref<string | null>(localStorage.getItem('hexawords-user-id'));
  const isAuthenticated = ref(false);
  const loading = ref(false);

  /** Auto-login: create anonymous user if no userId stored, or try refresh. */
  async function init() {
    if (loading.value) return;
    loading.value = true;

    try {
      // Try to get current user via existing cookie
      const me = await api.get<{ userId: string; role: string }>('/auth/me').catch(() => null);
      if (me?.userId) {
        userId.value = me.userId;
        localStorage.setItem('hexawords-user-id', me.userId);
        isAuthenticated.value = true;
        return;
      }

      // Try refresh
      const refreshed = await api.post<{ userId?: string; error?: string }>('/auth/refresh', {}).catch(() => null);
      if (refreshed?.userId) {
        userId.value = refreshed.userId;
        localStorage.setItem('hexawords-user-id', refreshed.userId);
        isAuthenticated.value = true;
        return;
      }

      // Create anonymous user
      const result = await api.post<{ userId: string }>('/auth/anonymous', {});
      userId.value = result.userId;
      localStorage.setItem('hexawords-user-id', result.userId);
      isAuthenticated.value = true;
    } catch (e) {
      console.error('Auth init failed:', e);
    } finally {
      loading.value = false;
    }
  }

  async function signOut() {
    await api.post('/auth/sign-out', {}).catch(() => {});
    userId.value = null;
    isAuthenticated.value = false;
    localStorage.removeItem('hexawords-user-id');
  }

  return {
    userId,
    isAuthenticated,
    loading,
    init,
    signOut,
  };
});
