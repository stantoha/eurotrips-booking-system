// ============================================================
// EUROTRIPS — components/layout/Layout.tsx
// Навігаційний шелл для авторизованих сторінок: сайдбар з
// рольовими посиланнями + інфо користувача + Logout.
// ============================================================

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, MapPinned, ClipboardList, Users2,
  Wallet, Wrench, UserCircle2, LogOut, Menu, X
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';


// ─── NAV ITEMS ────────────────────────────────────────────────

interface NavItem {
  to:    string;
  label: string;
  icon:  React.ElementType;
  show:  boolean;
}

const ROLE_LABELS: Record<string, string> = {
  admin:      'Адміністратор',
  director:   'Директор',
  manager:    'Менеджер',
  ops:        'Операційний менеджер',
  accountant: 'Фінансист',
  agent:      'Агент',
  tourist:    'Турист',
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user, signOut,
    isAdmin, isDirector, isManager, isOpsManager, isAccountant, isAgent,
  } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isInternal = isAdmin || isDirector || isManager || isOpsManager || isAccountant;

  const navItems: NavItem[] = [
    { to: '/dashboard',  label: 'Дашборд',       icon: LayoutDashboard, show: isInternal },
    { to: '/tours',      label: 'Тури',          icon: MapPinned,       show: isInternal },
    { to: '/bookings',   label: 'Бронювання',    icon: ClipboardList,   show: isInternal },
    { to: '/leads',      label: 'Ліди',          icon: Users2,          show: isAdmin || isDirector || isManager },
    { to: '/finance',    label: 'Фінанси',       icon: Wallet,          show: isAdmin || isDirector },
    { to: '/operations', label: 'Операції',      icon: Wrench,          show: isInternal },
    { to: '/agent',      label: 'Кабінет агента',icon: UserCircle2,     show: isAgent },
  ].filter((item) => item.show);

  const handleSignOut = async () => {
    await signOut();
    window.location.replace('/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-brand-cyan/10 text-brand-cyan'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
    }`;

  const SidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-16 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
        <div className="w-8 h-8 bg-brand-cyan rounded-lg flex items-center justify-center flex-shrink-0">
          <img
            src="/ET_logo_white.svg"
            alt="Eurotrips"
            className="w-8 h-8 object-contain"
          />
        </div>
        <span className="text-base font-semibold text-slate-900 dark:text-slate-100">Eurotrips</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={navLinkClass} onClick={() => setMobileOpen(false)}>
            <Icon size={17} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-slate-100 dark:border-slate-800 p-3 flex-shrink-0">
        <div className="px-2 mb-2">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
            {user?.first_name} {user?.last_name}
          </p>
          <p className="text-xs text-slate-400 truncate">
            {user?.role ? (ROLE_LABELS[user.role] ?? user.role) : ''}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <LogOut size={17} aria-hidden="true" />
          Вийти
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex-shrink-0">
        {SidebarContent}
      </aside>

      {/* Mobile topbar + drawer */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between h-14 px-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-brand-cyan rounded-lg flex items-center justify-center">
            <img
              src="/ET_logo_white.svg"
              alt="Eurotrips"
              className="w-7 h-7 object-contain"
            />
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Eurotrips</span>
        </div>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Закрити меню' : 'Відкрити меню'}
          className="p-1.5 text-slate-500"
        >
          {mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          <div className="w-64 bg-white dark:bg-slate-900 flex flex-col pt-14">{SidebarContent}</div>
          <div className="flex-1 bg-black/30" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Content */}
      <main className="flex-1 min-w-0 md:pt-0 pt-14">{children}</main>
    </div>
  );
};

export default Layout;
