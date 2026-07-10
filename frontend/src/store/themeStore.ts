// ============================================================
// EUROTRIPS — Theme Store (Zustand)
// Перемикач світлої/темної теми: localStorage → prefers-color-scheme.
// Клас `dark` на <html> застосовується прямо в діях стору (не в
// useEffect компонента), щоб уникнути спалаху неправильної теми —
// початкове значення обчислюється й застосовується синхронно при
// завантаженні модуля, до першого рендеру React.
// ============================================================

import { create } from 'zustand';

const THEME_STORAGE_KEY = 'eurotrips-theme';

function getInitialIsDark(): boolean {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(isDark: boolean): void {
  document.documentElement.classList.toggle('dark', isDark);
  localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
}

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
}

const initialIsDark = getInitialIsDark();
applyTheme(initialIsDark);

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: initialIsDark,

  toggleTheme: () => {
    const next = !get().isDark;
    applyTheme(next);
    set({ isDark: next });
  },

  setTheme: (isDark) => {
    applyTheme(isDark);
    set({ isDark });
  },
}));
