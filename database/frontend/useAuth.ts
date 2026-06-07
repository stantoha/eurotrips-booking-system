// ============================================================
// EUROTRIPS — useAuth Hook
// Обгортає auth store + API calls в зручний React хук.
// Використовується у всіх компонентах що потребують авторизації.
// ============================================================

import { useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  login,
  getMe,
  logout as logoutApi,
  getAuthErrorMessage,
  type LoginCredentials,
} from '../services/auth';
import type { UserRole } from '../types';

// ─── RETURN TYPE ─────────────────────────────────────────────

export interface UseAuthReturn {
  // Стан
  user:            ReturnType<typeof useAuthStore.getState>['user'];
  isAuthenticated: boolean;
  isLoading:       boolean;
  isInitialized:   boolean;

  // Дії
  signIn:      (creds: LoginCredentials) => Promise<SignInResult>;
  signOut:     () => Promise<void>;
  initialize:  () => Promise<void>;

  // RBAC helpers
  hasRole:         (...roles: UserRole[]) => boolean;
  isAdmin:         boolean;
  isDirector:      boolean;
  isManager:       boolean;
  isOpsManager:    boolean;
  isAccountant:    boolean;
  isAgent:         boolean;
  isTourist:       boolean;
  isNetworkAgent:  boolean;
  canSeeMargin:    boolean;   // false для агентів (BR-04)
  canSeeAllAgents: boolean;   // тільки admin/director/manager/accountant
}

export interface SignInResult {
  success: boolean;
  error?:  string;
}

// ─── HOOK ─────────────────────────────────────────────────────

export function useAuth(): UseAuthReturn {
  const {
    user,
    isAuthenticated,
    isLoading,
    isInitialized,
    setAuth,
    clearAuth,
    setLoading,
    setInitialized,
  } = useAuthStore();

  // ── initialize ─────────────────────────────────────────────
  /**
   * Викликається один раз при старті додатку (у App.tsx або root layout).
   * Спробує отримати /auth/me — якщо провалиться, interceptor спробує
   * /auth/refresh через HttpOnly Cookie. Якщо обидва провалились —
   * clearAuth (покажемо login сторінку).
   */
  const initialize = useCallback(async () => {
    if (isInitialized) return;

    setLoading(true);
    try {
      const fetchedUser = await getMe();
      // Після авто-refresh в interceptor, токен вже оновлено в store
      const currentToken = useAuthStore.getState().accessToken ?? '';
      setAuth(fetchedUser, currentToken);
    } catch {
      // Немає валідного Cookie → покажемо login
      clearAuth();
    } finally {
      setLoading(false);
      setInitialized();
    }
  }, [isInitialized, setAuth, clearAuth, setLoading, setInitialized]);

  // ── signIn ─────────────────────────────────────────────────
  const signIn = useCallback(async (
    credentials: LoginCredentials,
  ): Promise<SignInResult> => {
    setLoading(true);
    try {
      const { user: loggedUser, access_token } = await login(credentials);
      setAuth(loggedUser, access_token);
      return { success: true };
    } catch (error) {
      return { success: false, error: getAuthErrorMessage(error) };
    } finally {
      setLoading(false);
    }
  }, [setAuth, setLoading]);

  // ── signOut ────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    setLoading(true);
    await logoutApi();          // видаляє Cookie на сервері
    clearAuth();                // очищає in-memory token
  }, [clearAuth, setLoading]);

  // ── RBAC ───────────────────────────────────────────────────

  const hasRole = useCallback(
    (...roles: UserRole[]): boolean => !!user && roles.includes(user.role),
    [user],
  );

  const isAdmin       = hasRole('admin');
  const isDirector    = hasRole('director');
  const isManager     = hasRole('manager');
  const isOpsManager  = hasRole('ops_manager');
  const isAccountant  = hasRole('accountant');
  const isAgent       = hasRole('agent');
  const isTourist     = hasRole('tourist');

  // Мережевий агент має royalty_pct > 0 (ADR-001 §3.4)
  const isNetworkAgent = isAgent && user?.agent_type === 'network';

  // BR-04: Собівартість та маржа — тільки для внутрішніх ролей
  const canSeeMargin = isAdmin || isDirector || isAccountant;

  // Бачити заявки інших агентів
  const canSeeAllAgents = isAdmin || isDirector || isManager || isAccountant;

  return {
    user,
    isAuthenticated,
    isLoading,
    isInitialized,

    signIn,
    signOut,
    initialize,

    hasRole,
    isAdmin,
    isDirector,
    isManager,
    isOpsManager,
    isAccountant,
    isAgent,
    isTourist,
    isNetworkAgent,
    canSeeMargin,
    canSeeAllAgents,
  };
}

export default useAuth;
