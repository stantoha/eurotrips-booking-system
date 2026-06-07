// ============================================================
// EUROTRIPS — Axios Instance
// JWT Bearer auth + auto-refresh через HttpOnly Cookie (ADR-001)
// Access token: 15 хв | Refresh token: 30 днів (Cookie)
// ============================================================

import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';

// ─── BASE URL ────────────────────────────────────────────────
// Vite env: VITE_API_URL=https://api.eurotrips.ua
// Якщо не задано — dev proxy через vite.config.ts
export const BASE_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

// ─── AXIOS INSTANCE ──────────────────────────────────────────
export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  withCredentials: true,           // HttpOnly Cookie для refresh token
  headers: {
    'Content-Type': 'application/json',
    'Accept-Language': 'uk',       // Відповіді помилок — українською
  },
});

// ─── REFRESH LOCK ────────────────────────────────────────────
// Один refresh-запит одночасно, решта — чекають у черзі

let isRefreshing = false;
type QueueItem = { resolve: (t: string) => void; reject: (e: unknown) => void };
let pendingQueue: QueueItem[] = [];

function flushQueue(error: unknown, token?: string) {
  pendingQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token!),
  );
  pendingQueue = [];
}

// ─── REQUEST INTERCEPTOR ─────────────────────────────────────
// Підставляємо Bearer токен у кожен запит

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Токен зберігається в Zustand store (in-memory, не localStorage)
    // Імпортуємо тут щоб уникнути циклічних залежностей
    const { getAccessToken } = getAuthActions();
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── RESPONSE INTERCEPTOR ────────────────────────────────────
// На 401: оновлюємо токен через HttpOnly Cookie, повторюємо запит

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig;

    const is401 = error.response?.status === 401;
    const isAlreadyRetried = original?._retry === true;
    const isAuthEndpoint =
      original?.url?.includes('/auth/refresh') ||
      original?.url?.includes('/auth/login');

    if (!is401 || isAlreadyRetried || isAuthEndpoint) {
      return Promise.reject(error);
    }

    // Якщо вже йде refresh — ставимо в чергу
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((newToken) => {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      // POST /auth/refresh — Cookie надсилається автоматично (withCredentials)
      const { data } = await axios.post<{ data: { access_token: string } }>(
        `${BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true },
      );
      const newToken = data.data.access_token;

      // Зберігаємо новий токен в стор
      getAuthActions().setToken(newToken);

      flushQueue(null, newToken);
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshError) {
      flushQueue(refreshError);
      getAuthActions().clearAuth();
      // Редіректимо на логін (без router dependency)
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

// ─── LAZY AUTH STORE ACCESSOR ─────────────────────────────────
// Уникаємо циклічних залежностей між api.ts та authStore.ts

type AuthActions = {
  getAccessToken: () => string | null;
  setToken: (token: string) => void;
  clearAuth: () => void;
};

function getAuthActions(): AuthActions {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useAuthStore } = require('../store/authStore') as {
    useAuthStore: { getState: () => AuthActions & { accessToken: string | null } };
  };
  const state = useAuthStore.getState();
  return {
    getAccessToken: () => state.accessToken,
    setToken: state.setToken,
    clearAuth: state.clearAuth,
  };
}

// ─── API RESPONSE TYPE ───────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    per_page?: number;
  };
  error?: string;
}

export default api;
