// ============================================================
// EUROTRIPS — HotelStatusBadge Component
// Бейдж статусу готельного бронювання — OPS UX C-3 (wireframe 2).
//
// ПРИМІТКА: це 5-статусна модель з UX-специфікації
// (пошук → опція → підтверджено → депозит → фінал_оплачено).
// Поточна Prisma-модель HotelBooking.status — вільний рядок
// ("active|confirmed|cancelled|archived"), не цей enum. Компонент
// готовий для використання, коли з'явиться відповідний
// backend-workflow або мапінг з реальних полів (status+depositStatus).
// ============================================================

import React from 'react';
import { Search, Clock, CheckCircle2, CreditCard, BadgeCheck } from 'lucide-react';

export type HotelBookingUiStatus = 'searching' | 'option' | 'confirmed' | 'deposit_paid' | 'final_paid';

const CONFIG: Record<HotelBookingUiStatus, { label: string; classes: string; Icon: React.FC<{ size?: number }> }> = {
  searching:    { label: 'Пошук',        classes: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700', Icon: Search },
  option:       { label: 'Опція',        classes: 'bg-brand-gold/10 text-brand-gold-dark border-brand-gold/30', Icon: Clock },
  confirmed:    { label: 'Підтверджено', classes: 'bg-brand-blue/10 text-brand-blue border-brand-blue/30', Icon: CheckCircle2 },
  deposit_paid: { label: 'Депозит',      classes: 'bg-brand-cyan/10 text-brand-cyan-dark border-brand-cyan/30', Icon: CreditCard },
  final_paid:   { label: 'Оплачено',     classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800', Icon: BadgeCheck },
};

export interface HotelStatusBadgeProps {
  status: HotelBookingUiStatus;
  className?: string;
}

export const HotelStatusBadge: React.FC<HotelStatusBadgeProps> = ({ status, className = '' }) => {
  const cfg = CONFIG[status];
  if (!cfg) return null;
  const { Icon } = cfg;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.classes} ${className}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
};

export default HotelStatusBadge;
