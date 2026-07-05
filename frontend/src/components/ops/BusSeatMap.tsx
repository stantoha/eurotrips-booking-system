// ============================================================
// EUROTRIPS — BusSeatMap Component
// Схема автобуса (N рядів × 4 місця). OPS UX C-3, Wireframe /seating.
// Підключено в TourDetail.tsx (вкладка "Розсадка") через
// useTourSeatMap/useAssignSeat — GET/PATCH /tours/:id/seat-map (OPS-17).
// ============================================================

import React from 'react';

export interface BusSeat {
  seatNumber: number;
  isOccupied: boolean;
  touristName?: string | null;
}

export interface BusSeatMapProps {
  seats: BusSeat[];
  /** К-сть місць у ряду (стандартно 4: 2+прохід+2) */
  seatsPerRow?: number;
  onSeatClick?: (seatNumber: number) => void;
  className?: string;
}

export const BusSeatMap: React.FC<BusSeatMapProps> = ({
  seats, seatsPerRow = 4, onSeatClick, className = '',
}) => {
  const occupiedCount = seats.filter((s) => s.isOccupied).length;

  return (
    <div className={className}>
      <p className="text-xs text-slate-400 mb-2">{occupiedCount}/{seats.length} місць зайнято</p>
      <div
        className="grid gap-1.5 max-w-xs"
        style={{ gridTemplateColumns: `repeat(${seatsPerRow}, minmax(0, 1fr))` }}
      >
        {seats.map((seat) => (
          <button
            key={seat.seatNumber}
            title={seat.touristName ?? undefined}
            onClick={() => onSeatClick?.(seat.seatNumber)}
            className={`
              aspect-square rounded-md text-[10px] font-semibold flex items-center justify-center border transition-colors
              ${seat.isOccupied
                ? 'bg-brand-cyan/15 border-brand-cyan/40 text-brand-cyan-dark'
                : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-400'}
            `}
          >
            {seat.seatNumber}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brand-cyan/40 inline-block" />Зайнято</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 inline-block" />Вільно</span>
      </div>
    </div>
  );
};

export default BusSeatMap;
