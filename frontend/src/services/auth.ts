// ============================================================
// EUROTRIPS — Auth Service
// POST /api/v1/auth/login  — отримати access_token + user
// GET  /api/v1/auth/me     — отримати поточного користувача
// POST /api/v1/auth/logout — вийти (очистити Cookie на сервері)
// POST /api/v1/auth/refresh— оновити access_token (через interceptor)
// ============================================================

import { api, ApiResponse } from './api';
import type { User } from '../types';

// ─── REQUEST / RESPONSE TYPES ────────────────────────────────

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;   // JWT, 15 хв (in-memory)
  user: User;             // Повний профіль користувача
  // Refresh token встановлюється сервером як HttpOnly Cookie
  // (не повертається в тілі відповіді — це навмисно)
}

export interface RegisterPayload {
  email:     string;
  password:  string;
  firstName: string;
  lastName:  string;
  phone?:    string;
  // role навмисно відсутній — публічна реєстрація завжди створює 'tourist' (бекенд)
}

export interface ApiError {
  message: string;
  code?: string;
  field?: string;   // для валідаційних помилок
}

// ─── AUTH API FUNCTIONS ──────────────────────────────────────

/**
 * POST /api/v1/auth/login
 *
 * Повертає access_token (зберігаємо в пам'яті) та user.
 * Сервер автоматично встановлює HttpOnly Cookie з refresh_token.
 *
 * @throws {AxiosError} 401 — невірні credentials
 * @throws {AxiosError} 403 — акаунт заблоковано
 * @throws {AxiosError} 422 — помилка валідації
 */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const { data } = await api.post<ApiResponse<LoginResponse>>(
    '/auth/login',
    credentials,
  );
  return data.data;
}

/**
 * GET /api/v1/auth/me
 *
 * Повертає повний профіль поточного авторизованого користувача.
 * Використовується при ініціалізації додатку для перевірки сесії.
 * Якщо access_token протухнув — interceptor автоматично оновить через Cookie.
 *
 * Поля відповіді для різних ролей:
 * - role='agent': включає agent_id, agent_type, network_id
 * - role='manager'|'admin': стандартний User профіль
 *
 * @throws {AxiosError} 401 — не авторизований (немає валідного токену / Cookie)
 */
export async function getMe(): Promise<User> {
  const { data } = await api.get<ApiResponse<User>>('/auth/me');
  return data.data;
}

/**
 * POST /api/v1/auth/register
 *
 * Публічна реєстрація — завжди створює акаунт з role='tourist'.
 * Повертає одразу access_token + user (як і login).
 *
 * @throws {AxiosError} 409 — email вже зареєстрований
 * @throws {AxiosError} 422 — помилка валідації (слабкий пароль тощо)
 */
export async function register(payload: RegisterPayload): Promise<LoginResponse> {
  const { data } = await api.post<ApiResponse<LoginResponse>>(
    '/auth/register',
    payload,
  );
  return data.data;
}

/**
 * POST /api/v1/auth/logout
 *
 * Видаляє refresh_token Cookie на сервері.
 * Після цього старий Cookie більше не буде прийнятий.
 *
 * Фронтенд очищає in-memory access_token незалежно від результату.
 */
export async function logout(): Promise<void> {
  // Fire-and-forget: навіть якщо запит провалиться — очищаємо стор
  try {
    await api.post('/auth/logout');
  } catch {
    // Ignore — токен міг вже бути недійсним
  }
}

/**
 * POST /api/v1/auth/refresh
 *
 * Зазвичай викликається ТІЛЬКИ через Axios interceptor (api.ts).
 * Для ручного виклику при ініціалізації — use initializeAuth() в useAuth.
 *
 * @throws {AxiosError} 401 — refresh_token протухнув або відсутній
 */
export async function refreshAccessToken(): Promise<string> {
  const { data } = await api.post<ApiResponse<{ access_token: string }>>(
    '/auth/refresh',
  );
  return data.data.access_token;
}

// ─── ERROR HELPER ─────────────────────────────────────────────

/**
 * Витягує людиночитабельне повідомлення з Axios помилки.
 * Повертає українське повідомлення.
 */
export function getAuthErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Невідома помилка';
  }

  const axiosError = error as {
    response?: { status: number; data?: { error?: string; message?: string } };
  };

  const status = axiosError.response?.status;
  const serverMsg =
    axiosError.response?.data?.error ??
    axiosError.response?.data?.message;

  if (serverMsg) return serverMsg;

  switch (status) {
    case 400: return 'Невірний запит. Перевірте введені дані.';
    case 401: return 'Невірний email або пароль.';
    case 403: return 'Ваш акаунт заблоковано. Зверніться до адміністратора.';
    case 422: return 'Помилка валідації. Перевірте поля форми.';
    case 429: return 'Забагато спроб. Спробуйте через кілька хвилин.';
    case 500: return 'Помилка сервера. Спробуйте пізніше.';
    default:  return 'Не вдалося підключитися до сервера.';
  }
}
