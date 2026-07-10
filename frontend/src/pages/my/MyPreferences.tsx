// ============================================================
// EUROTRIPS — pages/my/MyPreferences.tsx
// Маршрут: /my/preferences   Роль: tourist тільки (ProtectedRoute)
//
// «Мої преференси» (C4, WF5, OPS-03/BR-12): тип номера + місце в автобусі
// через GET /bookings/:id/seat-map і PATCH .../tourist/:tId/preferences.
// Бекенд може заблокувати запис (403, ще рано за статусом / фінальний румінг
// вже закрито) або повернути applied:false (структура номерів ще готується) —
// обидва випадки обробляються тут інформаційним повідомленням, без crash.
// ============================================================

import React, { useEffect, useState } from 'react';
import { Sliders, Loader2, AlertTriangle, Info, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { BusSeatMap } from '../../components/ops/BusSeatMap';
import { useAuth } from '../../hooks/useAuth';
import {
  useMyBookings, useMyBookingDetail, useMySeatMap, useSetMyPreferences,
  type MyRoomType,
} from '../../hooks/useMyBooking';

// ─── HELPERS ──────────────────────────────────────────────────

const ROOM_TYPE_OPTIONS: { value: MyRoomType; label: string }[] = [
  { value: 'no_preference', label: 'Без переваг' },
  { value: 'twin',          label: 'Двомісний (роздільні ліжка)' },
  { value: 'double',        label: 'Двомісний (двоспальне ліжко)' },
  { value: 'triple',        label: 'Тримісний' },
  { value: 'single',        label: 'Одномісний' },
];

function extractErrorMessage(err: unknown): string {
  const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
  return axiosErr.response?.data?.error?.message ?? 'Не вдалося зберегти побажання. Спробуйте пізніше.';
}

// ─── MAIN PAGE ────────────────────────────────────────────────

const MyPreferences: React.FC = () => {
  const { user } = useAuth();
  const { data: bookings, isLoading: listLoading } = useMyBookings();
  const bookingId = bookings?.[0]?.id;

  const { data: booking, isLoading: detailLoading } = useMyBookingDetail(bookingId);
  const { data: seatMap, isLoading: seatMapLoading } = useMySeatMap(bookingId);

  const touristId = user?.tourist_id;
  const myParticipant = booking?.participants.find((p) => p.tourist.id === touristId);

  const mutation = useSetMyPreferences(bookingId ?? '', touristId ?? '');

  const [roomType, setRoomType] = useState<MyRoomType>('no_preference');
  const [seatNumber, setSeatNumber] = useState<number | null>(null);
  const [roommate, setRoommate] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Підвантажуємо поточні побажання як стартові значення форми
  useEffect(() => {
    if (myParticipant) {
      setRoomType((myParticipant.preferred_room_type as MyRoomType) ?? 'no_preference');
      setSeatNumber(myParticipant.bus_sea_number);
      setRoommate(myParticipant.roommate_preference ?? '');
    }
  }, [myParticipant]);

  const handleSeatClick = (seat: number) => {
    const occupiedBySomeoneElse = seatMap?.seats.find((s) => s.seat_number === seat)?.is_occupied
      && seat !== myParticipant?.bus_sea_number;
    if (occupiedBySomeoneElse) return;
    setSeatNumber((prev) => (prev === seat ? null : seat));
  };

  const handleSubmit = async () => {
    setInfo(null);
    setError(null);
    try {
      const result = await mutation.mutateAsync({
        preferredRoomType: roomType,
        busSeaNumber: seatNumber,
        roommatePreference: roommate || undefined,
      });
      if (result.applied) {
        setInfo('Побажання збережено.');
      } else {
        setInfo(result.message ?? 'Побажання прийнято, але ще не застосовано.');
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const isLoading = listLoading || detailLoading;

  if (isLoading) {
    return (
      <div className="p-6 max-w-screen-md mx-auto flex items-center justify-center py-24">
        <Loader2 size={20} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (!bookingId || !booking) {
    return (
      <div className="p-6 max-w-screen-md mx-auto flex flex-col items-center py-20 text-slate-400">
        <AlertTriangle size={32} className="opacity-50 mb-3" />
        <p className="text-sm">Немає активного бронювання для внесення побажань.</p>
      </div>
    );
  }

  if (!myParticipant) {
    return (
      <div className="p-6 max-w-screen-md mx-auto flex flex-col items-center py-20 text-slate-400">
        <AlertTriangle size={32} className="opacity-50 mb-3" />
        <p className="text-sm text-center max-w-xs">
          Вас ще не додано до списку учасників цього бронювання. Зверніться до вашого менеджера.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-screen-md mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link
          to="/my/booking"
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-500"
          aria-label="Назад"
        >
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100">Мої преференси</h1>
          <p className="text-xs text-slate-400">{booking.booking_number} · {booking.tour.name}</p>
        </div>
      </div>

      {info && (
        <div className="flex items-start gap-2.5 mb-4 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 text-sm text-blue-700 dark:text-blue-300">
          <Info size={15} className="flex-shrink-0 mt-0.5" />
          <span>{info}</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2.5 mb-4 px-4 py-3 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

        {/* ── ТИП НОМЕРУ + ПОБАЖАННЯ ПО СУСІДУ ── */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Sliders size={13} className="text-slate-400" />
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Тип номера</h3>
          </div>
          <select
            value={roomType}
            onChange={(e) => setRoomType(e.target.value as MyRoomType)}
            className="text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ROOM_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
              Побажання по сусіду (необов'язково)
            </label>
            <textarea
              value={roommate}
              onChange={(e) => setRoommate(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Напр.: хочу їхати з донькою Оленою"
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* ── МІСЦЕ В АВТОБУСІ ── */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sliders size={13} className="text-slate-400" />
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Місце в автобусі</h3>
          </div>
          {seatMapLoading || !seatMap ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={16} className="animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                {seatNumber ? <>Обране місце: <strong>{seatNumber}</strong></> : 'Місце не обрано'}
              </p>
              <BusSeatMap
                seats={seatMap.seats.map((s) => ({
                  seatNumber: s.seat_number,
                  isOccupied: s.is_occupied && s.seat_number !== seatNumber,
                }))}
                onSeatClick={handleSeatClick}
              />
            </>
          )}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={mutation.isPending}
        style={{ borderRadius: 9999 }}
        className="mt-5 flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 disabled:opacity-40 transition-colors"
      >
        {mutation.isPending
          ? <Loader2 size={14} className="animate-spin" />
          : <CheckCircle2 size={14} />}
        Зберегти побажання
      </button>
    </div>
  );
};

export default MyPreferences;
