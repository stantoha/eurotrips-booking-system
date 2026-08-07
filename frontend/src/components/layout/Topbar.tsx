// ============================================================
// EUROTRIPS — components/layout/Topbar.tsx
// Постійна темна панель (52px), завжди видима — і на десктопі,
// і на мобільній версії.
//
// DS: chrome темний в ОБОХ темах — це фіксований бренд-елемент,
// а не реакція на тему. Аппмарк = лого в 28px cyan-плитці +
// «EUROTRIPS» у IBM Plex Mono 700 з tracking .1em.
// ============================================================

import React from 'react';
import { Sun, Moon, Bell, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { ROLE_LABELS } from '../../constants/roles';
import { IconButton } from '../ui/Feedback';
import logoBlack from '../../icons/ET_logo_black.png';

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
    <header className="h-topbar flex-shrink-0 bg-chrome flex items-center justify-between px-4 sticky top-0 z-40">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleMobile}
          aria-label={mobileOpen ? 'Закрити меню' : 'Відкрити меню'}
          className="md:hidden p-1.5 -ml-1.5 text-chrome-fg"
        >
          {mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>

        {/* Аппмарк — лого в cyan-плитці + монопросторовий вордмарк */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 bg-brand-cyan rounded-tile flex items-center justify-center flex-shrink-0">
            <img src={logoBlack} alt="Eurotrips" className="w-5 h-5 object-contain" />
          </div>
          <span className="font-mono font-bold text-sm tracking-logo text-brand-cyan">EUROTRIPS</span>
        </div>

        <div className="hidden sm:block w-px h-5 bg-chrome-divider flex-shrink-0" />
        <span className="hidden sm:block text-caption text-chrome-muted truncate">Booking System</span>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <IconButton
          size="md"
          variant="onDark"
          label="Перемкнути тему"
          onClick={toggleTheme}
        >
          {isDark ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
        </IconButton>

        {/* Сповіщення — поки декоративна іконка, бекенду сповіщень не існує */}
        <Bell size={17} className="text-chrome-muted" aria-hidden="true" />

        <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-chrome-divider">
          <div className="w-7 h-7 rounded-pill bg-brand-cyan flex items-center justify-center text-caption font-bold text-brand-dark flex-shrink-0">
            {initials}
          </div>
          <div className="leading-tight">
            <p className="text-caption font-medium text-chrome-fg">{user?.first_name} {user?.last_name}</p>
            <p className="text-micro text-brand-cyan-light">
              {user?.role ? (ROLE_LABELS[user.role] ?? user.role) : ''}
            </p>
          </div>
          <IconButton size="sm" variant="onDark" label="Вийти" onClick={onSignOut} className="ml-1">
            <LogOut size={15} aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
