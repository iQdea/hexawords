const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export function getUserId(): string {
  return localStorage.getItem('hexawords-user-id') ?? '';
}

export function useApi() {
  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Fallback header for pre-auth requests
    const uid = getUserId();
    if (uid) headers['X-User-Id'] = uid;

    const res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers,
      ...options,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? `HTTP ${res.status}`);
    }

    return res.json();
  }

  function get<T>(path: string) {
    return request<T>(path);
  }

  function post<T>(path: string, body: unknown) {
    return request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  function patch<T>(path: string, body: unknown) {
    return request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  return { get, post, patch, request };
}
