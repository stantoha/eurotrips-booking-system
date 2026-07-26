// ============================================================
// EUROTRIPS — BusLayoutMap Component
// Візуальна схема салону автобуса за обраним сімейством
// (data/busLayoutTemplates.ts) з накладеними реальними даними
// розсадки (зайнято/вільно/ім'я туриста). Заміна наївної рівномірної
// сітки з BusSeatMap.tsx там, де потрібна точніша форма салону
// (задня лавка, другий поверх, кермо/двері).
// ============================================================

import React from 'react';
import { Armchair, DoorOpen, Info } from 'lucide-react';
import {
  generateBusLayout, type BusLayoutFamilyKey, type BusSlot,
} from '../../data/busLayoutTemplates';

export interface BusLayoutSeatData {
  seatNumber: number;
  isOccupied: boolean;
  touristName?: string | null;
}

export interface BusLayoutMapProps {
  totalSeats: number;
  family: BusLayoutFamilyKey;
  seats: BusLayoutSeatData[];
  onSeatClick?: (seatNumber: number) => void;
  className?: string;
}

const SLOT_SIZE = 34;

const SeatSlot: React.FC<{ slot: BusSlot; data?: BusLayoutSeatData; onClick?: (n: number) => void }> = ({ slot, data, onClick }) => {
  if (slot.kind === 'aisle' || slot.kind === 'gap') {
    return <div style={{ width: SLOT_SIZE / 1.6, height: SLOT_SIZE }} />;
  }
  if (slot.kind === 'stairs') {
    return (
      <div
        title="Сходи на другий поверх"
        className="flex items-center justify-center rounded-md border border-dashed border-slate-300 dark:border-slate-600 text-slate-400"
        style={{ width: SLOT_SIZE, height: SLOT_SIZE }}
      >
        <Info size={13} aria-hidden="true" />
      </div>
    );
  }
  if (slot.kind === 'driver' || slot.kind === 'door' || slot.kind === 'wc') {
    const label = slot.kind === 'driver' ? 'Водій' : slot.kind === 'door' ? 'Двері' : 'WC';
    return (
      <div
        title={label}
        className="flex items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400"
        style={{ width: SLOT_SIZE, height: SLOT_SIZE }}
      >
        {slot.kind === 'door' ? <DoorOpen size={13} aria-hidden="true" /> : <span className="text-[9px]">{label}</span>}
      </div>
    );
  }

  const occupied = data?.isOccupied ?? false;
  return (
    <button
      title={data?.touristName ?? undefined}
      onClick={() => slot.seatNumber != null && onClick?.(slot.seatNumber)}
      style={{ width: SLOT_SIZE, height: SLOT_SIZE }}
      className={`
        rounded-md text-[10px] font-semibold flex items-center justify-center border transition-colors
        ${occupied
          ? 'bg-brand-cyan/15 border-brand-cyan/40 text-brand-cyan-dark'
          : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-400'}
      `}
    >
      {slot.seatNumber}
    </button>
  );
};

export const BusLayoutMap: React.FC<BusLayoutMapProps> = ({ totalSeats, family, seats, onSeatClick, className = '' }) => {
  const layout = React.useMemo(() => generateBusLayout(totalSeats, family), [totalSeats, family]);
  const seatByNumber = React.useMemo(() => new Map(seats.map((s) => [s.seatNumber, s])), [seats]);
  const occupiedCount = seats.filter((s) => s.isOccupied).length;

  return (
    <div className={className}>
      <p className="text-xs text-slate-400 mb-2">{occupiedCount}/{totalSeats} місць зайнято</p>

      <div className="flex items-start gap-1.5 mb-2 text-slate-300 dark:text-slate-600">
        <div className="w-8 h-6 rounded-t-lg border border-b-0 border-slate-200 dark:border-slate-700 flex items-center justify-center">
          <Armchair size={12} aria-hidden="true" />
        </div>
        <span className="text-[10px] text-slate-400 mt-1.5">кермо</span>
      </div>

      <div className="space-y-4">
        {layout.sections.map((section, sIdx) => (
          <div key={sIdx}>
            {section.label && (
              <p className="text-[11px] font-medium text-slate-400 mb-1.5 uppercase tracking-wide">{section.label}</p>
            )}
            <div className="inline-flex flex-col gap-1.5 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-slate-50/50 dark:bg-slate-900/40">
              {section.rows.map((row, rIdx) => (
                <div key={rIdx} className="flex items-center gap-1.5">
                  {row.map((slot, slotIdx) => (
                    <SeatSlot
                      key={slotIdx}
                      slot={slot}
                      data={slot.seatNumber != null ? seatByNumber.get(slot.seatNumber) : undefined}
                      onClick={onSeatClick}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-2.5 text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brand-cyan/40 inline-block" />Зайнято</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 inline-block" />Вільно</span>
      </div>
    </div>
  );
};

export default BusLayoutMap;
