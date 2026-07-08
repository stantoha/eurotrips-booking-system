// ============================================================
// EUROTRIPS — RoomingBoard Component (OPS UX C-3)
// Split-panel: туристи зліва + кімнати справа, click-assign,
// фільтр «без кімнати». Дані реальні: useTourTourists + useAssignRoom.
// ============================================================

import React, { useMemo, useState } from 'react';
import { useTourTourists, type TourTouristRow } from '../../hooks/useTourTourists';
import { useAssignRoom } from '../../hooks/useRooming';

export interface RoomingBoardProps {
  tourId: string;
  canEdit: boolean;
}

const ROOM_TYPE_LABELS: Record<string, string> = {
  single: 'Одномісний', twin: 'Двомісний (2 ліжка)', double: 'Двомісний (1 ліжко)', triple: 'Тримісний',
};

export const RoomingBoard: React.FC<RoomingBoardProps> = ({ tourId, canEdit }) => {
  const { data, isLoading } = useTourTourists(tourId);
  const assignRoom = useAssignRoom(tourId);
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newRoomNumber, setNewRoomNumber] = useState('');

  const tourists = data?.tourists ?? [];

  const roomGroups = useMemo(() => {
    const map = new Map<string, TourTouristRow[]>();
    tourists.forEach((t) => {
      if (!t.actual_room_number) return;
      const arr = map.get(t.actual_room_number) ?? [];
      arr.push(t);
      map.set(t.actual_room_number, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'uk'));
  }, [tourists]);

  if (isLoading || !data) return <p className="text-sm text-slate-400 py-6">Завантаження…</p>;

  const filtered = onlyUnassigned ? tourists.filter((t) => !t.actual_room_number) : tourists;
  const selected = tourists.find((t) => t.tourist_id === selectedId) ?? null;

  const assignToRoom = (roomNumber: string, roomType?: string | null) => {
    if (!selected || !roomNumber) return;
    assignRoom.mutate({
      touristId: selected.tourist_id,
      payload: { actualRoomNumber: roomNumber, actualRoomType: (roomType ?? selected.actual_room_type) as any },
    });
    setSelectedId(null);
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* LEFT: tourists */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase text-slate-400">Туристи ({filtered.length})</h3>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <input type="checkbox" checked={onlyUnassigned} onChange={(e) => setOnlyUnassigned(e.target.checked)} />
              без кімнати
            </label>
          </div>
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 max-h-[28rem] overflow-y-auto">
            {filtered.length === 0 && <p className="text-xs text-slate-400 p-3">Немає туристів за фільтром.</p>}
            {filtered.map((t) => (
              <button
                key={t.tourist_id}
                type="button"
                disabled={!canEdit}
                onClick={() => setSelectedId(t.tourist_id === selectedId ? null : t.tourist_id)}
                className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed ${
                  selectedId === t.tourist_id ? 'bg-brand-cyan/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <span className="truncate">{t.last_name} {t.first_name}</span>
                <span className={`text-xs shrink-0 ${t.actual_room_number ? 'text-slate-400' : 'text-brand-red'}`}>
                  {t.actual_room_number ?? 'без кімнати'}
                </span>
              </button>
            ))}
          </div>
          {selected && (
            <p className="text-xs text-brand-cyan-dark dark:text-brand-cyan mt-2">
              Обрано: {selected.last_name} {selected.first_name} — натисніть кімнату праворуч, щоб призначити.
            </p>
          )}
        </div>

        {/* RIGHT: rooms */}
        <div>
          <h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">Кімнати ({roomGroups.length})</h3>
          <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
            {roomGroups.map(([roomNumber, occupants]) => (
              <button
                key={roomNumber}
                type="button"
                disabled={!canEdit || !selected}
                onClick={() => assignToRoom(roomNumber, occupants[0]?.actual_room_type)}
                className="w-full text-left border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 hover:border-brand-cyan disabled:hover:border-slate-200 dark:disabled:hover:border-slate-700 disabled:cursor-not-allowed transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">№ {roomNumber}</span>
                  <span className="text-[10px] text-slate-400 uppercase">
                    {ROOM_TYPE_LABELS[occupants[0]?.actual_room_type ?? ''] ?? occupants[0]?.actual_room_type ?? '—'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {occupants.map((o) => `${o.last_name} ${o.first_name}`).join(', ')}
                </p>
              </button>
            ))}

            {canEdit && (
              <div className="flex items-end gap-2 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-2.5">
                <label className="flex flex-col gap-0.5 flex-1">
                  <span className="text-[10px] text-slate-400 uppercase">Нова кімната №</span>
                  <input
                    value={newRoomNumber}
                    onChange={(e) => setNewRoomNumber(e.target.value)}
                    placeholder="напр. 214"
                    disabled={!selected}
                    className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900 disabled:opacity-50"
                  />
                </label>
                <button
                  type="button"
                  disabled={!selected || !newRoomNumber}
                  onClick={() => { assignToRoom(newRoomNumber); setNewRoomNumber(''); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-cyan text-white hover:bg-brand-cyan-dark disabled:opacity-40"
                >
                  Призначити
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {assignRoom.isError && (
        <p className="text-xs text-brand-red mt-3">Не вдалося призначити кімнату.</p>
      )}
    </div>
  );
};

export default RoomingBoard;
