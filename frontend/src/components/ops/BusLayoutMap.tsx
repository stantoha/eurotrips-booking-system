// ============================================================
// EUROTRIPS — BusLayoutMap Component
// Візуальна схема салону автобуса за обраною конфігурацією
// (data/busLayoutTemplates.ts) з накладеними реальними даними
// розсадки (зайнято/вільно/ім'я туриста).
//
// Рендер — CSS-grid з 5 РІВНИХ колонок (2 місця · прохід · 2 місця).
// Колонка-прохід (індекс 2) — порожня в рядах 2+2 і місце в задній
// лавці на 5. Рівні колонки гарантують, що всі ряди (2+2, задня
// лавка, частковий ряд) вирівняні по ширині — без "з'їжджання".
//
// Навколо салону — "кузов": передні двері + водій спереду та задні
// двері/вихід ззаду (як у 1С-схемах автопарку).
// ============================================================

import React from 'react';
import { Armchair, DoorOpen, LogOut } from 'lucide-react';
import {
  generateBusLayout, type BusLayoutFamilyKey, type BusCell,
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

const SEAT = 34; // ширина/висота крісла, px
const GRID_COLUMNS = `repeat(5, ${SEAT}px)`;

const Spacer: React.FC = () => <div style={{ height: SEAT }} />;

const MarkerCell: React.FC<{ label?: string; children?: React.ReactNode; title: string }> = ({ label, children, title }) => (
  <div
    title={title}
    className="flex items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 text-[8px] font-semibold"
    style={{ height: SEAT }}
  >
    {children ?? label}
  </div>
);

const DoorCell: React.FC<{ title: string; exit?: boolean }> = ({ title, exit }) => (
  <div
    title={title}
    className="flex items-center justify-center rounded-md border-2 border-dashed text-amber-500 border-amber-400/70 bg-amber-50/50 dark:bg-amber-950/30"
    style={{ height: SEAT }}
  >
    {exit ? <LogOut size={13} aria-hidden="true" /> : <DoorOpen size={13} aria-hidden="true" />}
  </div>
);

const Cell: React.FC<{ cell: BusCell; data?: BusLayoutSeatData; onClick?: (n: number) => void }> = ({ cell, data, onClick }) => {
  switch (cell.kind) {
    case 'aisle':
    case 'empty':
      return <Spacer />;
    case 'wc':
      return <MarkerCell label="WC" title="Туалет / кухня" />;
    case 'table':
      return <MarkerCell label="стіл" title="Столик (переговорна зона)" />;
    case 'guide':
      return <MarkerCell label="гід" title="Місце гіда / супроводу" />;
    case 'driver':
      return <MarkerCell title="Водій"><Armchair size={12} aria-hidden="true" /></MarkerCell>;
    case 'stairs':
      return <MarkerCell title="Сходи на 2 поверх"><DoorOpen size={12} aria-hidden="true" /></MarkerCell>;
    case 'seat': {
      const occupied = data?.isOccupied ?? false;
      return (
        <button
          title={data?.touristName ?? undefined}
          onClick={() => cell.seatNumber != null && onClick?.(cell.seatNumber)}
          style={{ height: SEAT }}
          className={`rounded-md text-[10px] font-semibold flex items-center justify-center border transition-colors ${
            occupied
              ? 'bg-brand-cyan/15 border-brand-cyan/40 text-brand-cyan-dark'
              : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-400'
          }`}
        >
          {cell.seatNumber}
        </button>
      );
    }
    default:
      return <Spacer />;
  }
};

const GridRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid gap-1.5" style={{ gridTemplateColumns: GRID_COLUMNS }}>{children}</div>
);

export const BusLayoutMap: React.FC<BusLayoutMapProps> = ({ totalSeats, family, seats, onSeatClick, className = '' }) => {
  const layout = React.useMemo(() => generateBusLayout(totalSeats, family), [totalSeats, family]);
  const seatByNumber = React.useMemo(() => new Map(seats.map((s) => [s.seatNumber, s])), [seats]);
  const occupiedCount = seats.filter((s) => s.isOccupied).length;

  return (
    <div className={className}>
      <p className="text-xs text-slate-400 mb-2">{occupiedCount}/{totalSeats} місць зайнято</p>

      <div className="flex flex-col gap-4">
        {layout.decks.map((deck, dIdx) => {
          const isMainDeck = dIdx === 0;
          return (
            <div key={dIdx}>
              {deck.label && (
                <p className="text-[11px] font-medium text-slate-400 mb-1.5 uppercase tracking-wide">{deck.label}</p>
              )}
              <div className="inline-flex flex-col gap-1.5 border border-slate-200 dark:border-slate-700 rounded-2xl p-2.5 bg-slate-50/50 dark:bg-slate-900/40">
                {/* Передній кузов: водій (зліва) + передні двері (справа) — лише на основному поверсі */}
                {isMainDeck && (
                  <GridRow>
                    <MarkerCell title="Водій"><Armchair size={12} aria-hidden="true" /></MarkerCell>
                    <Spacer />
                    <Spacer />
                    <Spacer />
                    <DoorCell title="Передні двері" />
                  </GridRow>
                )}

                {deck.rows.map((row, rIdx) => (
                  <GridRow key={rIdx}>
                    {row.map((cell, cIdx) => (
                      <Cell
                        key={cIdx}
                        cell={cell}
                        data={cell.seatNumber != null ? seatByNumber.get(cell.seatNumber) : undefined}
                        onClick={onSeatClick}
                      />
                    ))}
                  </GridRow>
                ))}

                {/* Задній кузов: задні двері / вихід (справа) */}
                {isMainDeck && (
                  <GridRow>
                    <Spacer />
                    <Spacer />
                    <Spacer />
                    <Spacer />
                    <DoorCell title="Задні двері / вихід" exit />
                  </GridRow>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-2.5 text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brand-cyan/40 inline-block" />Зайнято</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 inline-block" />Вільно</span>
        <span className="flex items-center gap-1"><DoorOpen size={11} className="text-amber-500" aria-hidden="true" />Двері</span>
      </div>
    </div>
  );
};

export default BusLayoutMap;
