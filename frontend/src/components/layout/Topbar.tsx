// ============================================================
// EUROTRIPS — components/layout/Topbar.tsx
// Постійна темна панель (52px), завжди видима — і на десктопі,
// і на мобільній версії (замінює колишній mobile-only topbar).
// ============================================================

import React from 'react';
import { Sun, Moon, Bell, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { ROLE_LABELS } from '../../constants/roles';

export interface TopbarProps {
  mobileOpen: boolean;
  onToggleMobile: () => void;
  onSignOut: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ mobileOpen, onToggleMobile, onSignOut }) => {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()
    : '';

  return (
    <header className="h-[52px] flex-shrink-0 bg-brand-dark flex items-center justify-between px-4 sticky top-0 z-40">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleMobile}
          aria-label={mobileOpen ? 'Закрити меню' : 'Відкрити меню'}
          className="md:hidden p-1.5 -ml-1.5 text-slate-300"
        >
          {mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 bg-brand-cyan rounded-md flex items-center justify-center flex-shrink-0">
            <img src="/ET_logo_black.svg" alt="Eurotrips" className="w-5 h-5 object-contain" />
          </div>
          <span className="font-mono font-bold text-sm tracking-wider text-brand-cyan">EUROTRIPS</span>
        </div>

        <div className="hidden sm:block w-px h-5 bg-slate-700 flex-shrink-0" />
        <span className="hidden sm:block text-xs text-slate-400 truncate">Booking System</span>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={toggleTheme}
          title="Перемкнути тему"
          aria-label="Перемкнути тему"
          className="w-8 h-8 rounded-lg border border-slate-700 flex items-center justify-center text-slate-300 hover:bg-white/5 transition-colors"
        >
          {isDark ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
        </button>

        {/* Сповіщення — поки декоративна іконка, бекенду сповіщень не існує */}
        <Bell size={17} className="text-slate-400" aria-hidden="true" />

        <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-700">
          <div className="w-7 h-7 rounded-full bg-brand-cyan flex items-center justify-center text-[11px] font-bold text-brand-dark flex-shrink-0">
            {initials}
          </div>
          <div className="leading-tight">
            <p className="text-xs font-medium text-slate-100">{user?.first_name} {user?.last_name}</p>
            <p className="text-[10px] text-brand-cyan-light">
              {user?.role ? (ROLE_LABELS[user.role] ?? user.role) : ''}
            </p>
          </div>
          <button
            onClick={onSignOut}
            title="Вийти"
            aria-label="Вийти"
            className="ml-1 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <LogOut size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
