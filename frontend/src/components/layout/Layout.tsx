// ============================================================
// EUROTRIPS — components/layout/Layout.tsx
// Навігаційний шелл для авторизованих сторінок: постійний темний
// Topbar + сайдбар з рольовими посиланнями, згрупованими за розділами.
// ============================================================

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, MapPinned, ClipboardList, Users2,
  Wallet, Wrench, UserCircle2, Ticket
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Topbar } from './Topbar';

// ─── NAV ITEMS ────────────────────────────────────────────────

type NavSection = 'Головне' | 'Продажі' | 'Управління';

interface NavItem {
  to:      string;
  label:   string;
  icon:    React.ElementType;
  show:    boolean;
  section: NavSection;
}

const SECTION_ORDER: NavSection[] = ['Головне', 'Продажі', 'Управління'];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    isAdmin, isDirector, isManager, isOpsManager, isAccountant, isAgent, isTourist,
    signOut,
  } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isInternal = isAdmin || isDirector || isManager || isOpsManager || isAccountant;

  const allNavItems: NavItem[] = [
    { to: '/dashboard',  label: 'Дашборд',         icon: LayoutDashboard, show: isInternal,                          section: 'Головне' },
    { to: '/my/booking', label: 'Моє бронювання',  icon: Ticket,          show: isTourist,                           section: 'Головне' },
    { to: '/tours',      label: 'Каталог турів',   icon: MapPinned,       show: isInternal,                          section: 'Продажі' },
    { to: '/bookings',   label: 'Бронювання',      icon: ClipboardList,   show: isInternal,                          section: 'Продажі' },
    { to: '/leads',      label: 'CRM · Ліди',      icon: Users2,          show: isAdmin || isDirector || isManager,  section: 'Продажі' },
    { to: '/operations', label: 'Операційний блок',icon: Wrench,          show: isInternal,                          section: 'Управління' },
    { to: '/finance',    label: 'Фінанси',         icon: Wallet,          show: isAdmin || isDirector,               section: 'Управління' },
    { to: '/agent',      label: 'Кабінет агента',  icon: UserCircle2,     show: isAgent,                             section: 'Управління' },
  ];
  const navItems = allNavItems.filter((item) => item.show);

  const handleSignOut = async () => {
    await signOut();
    window.location.replace('/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-brand-cyan/10 text-brand-cyan'
        : 'text-slate-300 hover:bg-white/5 hover:text-white'
    }`;

  const SidebarContent = (
    <nav className="flex-1 overflow-y-auto px-3 py-3">
      {SECTION_ORDER.map((section) => {
        const items = navItems.filter((item) => item.section === section);
        if (items.length === 0) return null;
        return (
          <div key={section} className="mb-1">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 px-3 pt-3 pb-1.5">
              {section}
            </div>
            <div className="space-y-1">
              {items.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className={navLinkClass} onClick={() => setMobileOpen(false)}>
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Topbar
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen((v) => !v)}
        onSignOut={handleSignOut}
      />

      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar — постійно темний, незалежно від світлої/темної теми */}
        <aside className="hidden md:flex md:flex-col w-[212px] bg-brand-dark flex-shrink-0">
          {SidebarContent}
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-30 flex">
            <div className="w-[212px] bg-brand-dark flex flex-col pt-[52px]">{SidebarContent}</div>
            <div className="flex-1 bg-black/30" onClick={() => setMobileOpen(false)} />
          </div>
        )}

        {/* Content */}
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
