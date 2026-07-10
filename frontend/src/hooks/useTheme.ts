// ============================================================
// EUROTRIPS — useTheme Hook
// Тонка обгортка над themeStore — за зразком того, як useAuth
// обгортає authStore. Компоненти імпортують цей хук, не стор напряму.
// ============================================================

import { useThemeStore } from '../store/themeStore';

export interface UseThemeReturn {
  isDark: boolean;
  toggleTheme: () => void;
}

export function useTheme(): UseThemeReturn {
  const isDark = useThemeStore((s) => s.isDark);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  return { isDark, toggleTheme };
}

export default useTheme;
