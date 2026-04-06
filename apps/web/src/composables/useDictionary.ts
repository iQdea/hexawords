import { ref } from 'vue';
import { useApi } from '@/composables/useApi';

const CACHE_KEY = 'hexawords-dictionary';
const wordSet = ref<Set<string> | null>(null);
const loading = ref(false);

async function load() {
  if (wordSet.value) return;
  loading.value = true;

  try {
    // Try localStorage cache first
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      wordSet.value = new Set(JSON.parse(cached));
      loading.value = false;
      return;
    }

    // Fetch from API
    const api = useApi();
    const words = await api.get<string[]>('/dictionary/words');
    wordSet.value = new Set(words);
    localStorage.setItem(CACHE_KEY, JSON.stringify(words));
  } catch {
    // Offline and no cache — dictionary unavailable
  } finally {
    loading.value = false;
  }
}

export function useDictionary() {
  function isValid(word: string): boolean {
    if (!wordSet.value || word.length < 2) return false;
    return wordSet.value.has(word.toLowerCase());
  }

  return { isValid, load, loading, loaded: wordSet };
}
