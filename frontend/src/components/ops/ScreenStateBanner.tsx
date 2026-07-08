// ============================================================
// EUROTRIPS — ScreenStateBanner Component
// OPS UX C-4 «Стани екранів»: empty / partial / ready / post-tour.
// Правило дизайну (з wireframes-документа): ОМ ніколи не бачить
// "порожній тупик" — кожен стан показує конкретний наступний крок.
// ============================================================

import React from 'react';
import { Inbox, AlertTriangle, CheckCircle2, Archive } from 'lucide-react';

export type ScreenState = 'empty' | 'partial' | 'ready' | 'post-tour';

const STATE_CONFIG: Record<ScreenState, { classes: string; Icon: React.FC<{ size?: number; className?: string }> }> = {
  empty:     { classes: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500', Icon: Inbox },
  partial:   { classes: 'bg-brand-gold/10 border-brand-gold/30 text-brand-gold-dark', Icon: AlertTriangle },
  ready:     { classes: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400', Icon: CheckCircle2 },
  'post-tour': { classes: 'bg-brand-blue/10 border-brand-blue/30 text-brand-blue', Icon: Archive },
};

export interface ScreenStateBannerProps {
  state: ScreenState;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
  className?: string;
}

export const ScreenStateBanner: React.FC<ScreenStateBannerProps> = ({
  state, title, subtitle, action, className = '',
}) => {
  const cfg = STATE_CONFIG[state];
  const { Icon } = cfg;

  return (
    <div className={`flex items-start gap-3 border rounded-xl px-4 py-3 mb-4 ${cfg.classes} ${className}`}>
      <Icon size={18} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {subtitle && <p className="text-xs opacity-80 mt-0.5">{subtitle}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          disabled={action.disabled}
          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-current hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default ScreenStateBanner;
