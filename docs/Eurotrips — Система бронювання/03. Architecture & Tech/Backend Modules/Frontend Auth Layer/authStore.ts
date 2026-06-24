// ============================================================
// EUROTRIPS — Auth Store (Zustand)
// Access token зберігається ТІЛЬКИ в пам'яті (in-memory).
// Refresh token — в HttpOnly Cookie (управляє сервер).
// НЕ використовуємо localStorage для токенів (XSS захист).
// ============================================================

import { create } from 'zustand';
import type { User } from '../types';

// ─── STATE TYPE ───────────────────────────────────────────────

interface AuthState {
  // ── Дані ──────────────────────────────────────────────────
  user: User | null;
  accessToken: string | null;   // in-memory, скидається при reload

  // ── Статуси ───────────────────────────────────────────────
  isAuthenticated: boolean;
  isLoading: boolean;
  /**
   * true після першої перевірки /auth/me або /auth/refresh.
   * Поки false — показуємо loading overlay (ProtectedRoute чекає).
   */
  isInitialized: boolean;

  // ── Actions ───────────────────────────────────────────────
  setAuth: (user: User, token: string) => void;
  setToken: (token: string) => void;
  updateUser: (partial: Partial<User>) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  setInitialized: () => void;
}

// ─── STORE ───────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set) => ({
  // ── Initial state ─────────────────────────────────────────
  user:            null,
  accessToken:     null,
  isAuthenticated: false,
  isLoading:       false,
  isInitialized:   false,

  // ── setAuth: після успішного login або refresh ─────────────
  setAuth: (user, token) =>
    set({
      user,
      accessToken:     token,
      isAuthenticated: true,
      isLoading:       false,
    }),

  // ── setToken: тільки токен (після auto-refresh) ───────────
  setToken: (token) =>
    set({ accessToken: token }),

  // ── updateUser: після зміни профілю ───────────────────────
  updateUser: (partial) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...partial } : null,
    })),

  // ── clearAuth: logout або refresh провалився ─────────────
  clearAuth: () =>
    set({
      user:            null,
      accessToken:     null,
      isAuthenticated: false,
      isLoading:       false,
    }),

  // ── setLoading ────────────────────────────────────────────
  setLoading: (isLoading) => set({ isLoading }),

  // ── setInitialized: викликається один раз при app init ────
  setInitialized: () => set({ isInitialized: true }),
}));

// ─── SELECTORS ───────────────────────────────────────────────
// Використовуємо для оптимізації re-renders

export const selectUser            = (s: AuthState) => s.user;
export const selectIsAuthenticated = (s: AuthState) => s.isAuthenticated;
export const selectIsInitialized   = (s: AuthState) => s.isInitialized;
export const selectIsLoading       = (s: AuthState) => s.isLoading;
export const selectUserRole        = (s: AuthState) => s.user?.role ?? null;
export const selectAgentType       = (s: AuthState) => s.user?.agent_type ?? null;
