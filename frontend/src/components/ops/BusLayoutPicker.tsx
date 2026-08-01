// ============================================================
// EUROTRIPS — BusLayoutPicker Component
// Вибір конфігурації схеми розсадки (OPS-03). Міні-прев'ю кожної
// конфігурації генерується тим самим generateBusLayout (5-колонкова
// сітка), тож мініатюра завжди відповідає реальному вигляду салону.
// ============================================================

import React from 'react';
import { Check } from 'lucide-react';
import {
  BUS_LAYOUT_FAMILIES, generateBusLayout, type BusLayoutFamilyKey, type BusCell,
} from '../../data/busLayoutTemplates';

export interface BusLayoutPickerProps {
  totalSeats: number;
  value: BusLayoutFamilyKey;
  onChange: (family: BusLayoutFamilyKey) => void;
  className?: string;
}

const DOT = 8; // px
const PREVIEW_COLUMNS = `repeat(5, ${DOT}px)`;

function cellClass(cell: BusCell): string {
  switch (cell.kind) {
    case 'seat': return 'rounded-[2px] bg-brand-cyan/50';
    case 'aisle':
    case 'empty': return '';
    default: return 'rounded-[2px] bg-slate-300 dark:bg-slate-600'; // wc/table/guide/driver/stairs
  }
}

const MiniPreview: React.FC<{ totalSeats: number; family: BusLayoutFamilyKey }> = ({ totalSeats, family }) => {
  const layout = generateBusLayout(totalSeats, family);
  const rows = layout.decks.flatMap((d) => d.rows).slice(0, 5);
  return (
    <div className="flex flex-col gap-0.5">
      {rows.map((row, i) => (
        <div key={i} className="grid gap-0.5" style={{ gridTemplateColumns: PREVIEW_COLUMNS }}>
          {row.map((cell, j) => (
            <div key={j} className={cellClass(cell)} style={{ height: DOT }} />
          ))}
        </div>
      ))}
    </div>
  );
};

export const BusLayoutPicker: React.FC<BusLayoutPickerProps> = ({ totalSeats, value, onChange, className = '' }) => {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 ${className}`}>
      {BUS_LAYOUT_FAMILIES.map((fam) => {
        const active = fam.key === value;
        return (
          <button
            key={fam.key}
            type="button"
            onClick={() => onChange(fam.key)}
            title={fam.description}
            className={`relative text-left p-2.5 rounded-lg border transition-colors ${
              active
                ? 'border-brand-cyan bg-brand-cyan/5 dark:bg-brand-cyan/10'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            {active && (
              <span className="absolute top-1.5 right-1.5 text-brand-cyan-dark dark:text-brand-cyan">
                <Check size={13} aria-hidden="true" />
              </span>
            )}
            <MiniPreview totalSeats={totalSeats} family={fam.key} />
            <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 mt-2">{fam.label}</p>
          </button>
        );
      })}
    </div>
  );
};

export default BusLayoutPicker;
