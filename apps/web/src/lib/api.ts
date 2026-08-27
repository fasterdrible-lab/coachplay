import { getToken, setToken, clearToken } from './auth';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// /uploads (vídeos, frames) é servido pela API fora do prefixo /api/v1
// (useStaticAssets em main.ts) — resolve a origem uma vez pra montar essas URLs.
export const API_ORIGIN = BASE_URL.replace(/\/api\/v1\/?$/, '');

// Sem timeout, uma requisição pendurada (ex.: servidor reiniciando no meio da
// conexão) trava para sempre qualquer tela que dependa dela — como o
// AuthProvider, deixando o "Carregando..." preso indefinidamente.
const DEFAULT_TIMEOUT_MS = 15_000;

type RequestOptions = RequestInit & { skipAuth?: boolean };

// access token dura 15min (JWT_ACCESS_EXPIRES_IN) e nada renovava — depois desse
// tempo toda chamada voltava 401 e a página ficava presa num estado quebrado até
// um reload completo. refreshPromise deduplica corridas quando várias chamadas
// expiram ao mesmo tempo (ex.: /matches/:id e /matches/:id/report em paralelo).
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as { accessToken: string };
        setToken(data.accessToken);
        return data.accessToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function doFetch(path: string, init: RequestInit, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Tempo de resposta excedido. Verifique sua conexão e tente novamente.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth, ...init } = options;

  let res = await doFetch(path, init, skipAuth ? null : getToken());

  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      clearToken();
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    res = await doFetch(path, init, newToken);
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Erro desconhecido' }));
    throw new Error(error.message ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { method: 'GET', ...options }),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body), ...options }),

  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body), ...options }),

  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body), ...options }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { method: 'DELETE', ...options }),
};
