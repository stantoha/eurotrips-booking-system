// ============================================================
// EUROTRIPS — pages/my/MyBooking.tsx
// Маршрут: /my/booking   Роль: tourist тільки (ProtectedRoute)
//
// «Моє бронювання» (C4, WF5): статус, учасники, платежі.
// Дані вже відфільтровані на бекенді (contactTouristId === user.tourist_id,
// bookings.service.ts) — тут нема потреби у клієнтському RBAC-фільтрі.
// ============================================================

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bus, Calendar, Users, CreditCard, Loader2, AlertTriangle,
  Sliders, Ticket,
} from 'lucide-react';

import { StatusBadge } from '../../components/ui/StatusBadge';
import { useMyBookings, useMyBookingDetail } from '../../hooks/useMyBooking';

// ─── HELPERS ──────────────────────────────────────────────────

const fmtEur = (n: number) =>
  n.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (s?: string | null): string => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  deposit: 'Передоплата', balance: 'Доплата', surcharge: 'Додатковий платіж', refund: 'Повернення',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'В обробці', completed: 'Проведено', failed: 'Відхилено', refunded: 'Повернено',
};

// ─── EMPTY STATE ──────────────────────────────────────────────

const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <Ticket size={36} className="text-slate-300 dark:text-slate-600 mb-3" />
    <h2 className="text-base font-medium text-slate-700 dark:text-slate-300">
      У вас поки немає бронювань
    </h2>
    <p className="text-sm text-slate-400 mt-1 max-w-xs">
      Як тільки ваш агент або менеджер оформить бронювання туру на ваше ім'я,
      воно з'явиться тут.
    </p>
  </div>
);

// ─── MAIN PAGE ────────────────────────────────────────────────

const MyBooking: React.FC = () => {
  const { data: bookings, isLoading: listLoading, isError: listError } = useMyBookings();
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const activeId = selectedId ?? bookings?.[0]?.id;
  const { data: booking, isLoading: detailLoading } = useMyBookingDetail(activeId);

  const paidTotal = useMemo(
    () => (booking ? booking.deposit_paid + booking.balance_paid : 0),
    [booking],
  );
  const paidPct = booking && booking.total_amount > 0
    ? Math.round((paidTotal / booking.total_amount) * 100) : 0;

  if (listLoading) {
    return (
      <div className="p-6 max-w-screen-lg mx-auto flex items-center justify-center py-24">
        <Loader2 size={20} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (listError) {
    return (
      <div className="p-6 max-w-screen-lg mx-auto flex flex-col items-center py-20 text-slate-400">
        <AlertTriangle size={32} className="opacity-50 mb-3 text-red-400" />
        <p className="text-sm">Не вдалося завантажити бронювання. Спробуйте оновити сторінку.</p>
      </div>
    );
  }

  if (!bookings || bookings.length === 0) {
    return <div className="p-6 max-w-screen-lg mx-auto"><EmptyState /></div>;
  }

  return (
    <div className="p-6 max-w-screen-lg mx-auto">
      <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">
        Моє бронювання
      </h1>

      {/* ── СПИСОК (якщо кілька) ── */}
      {bookings.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {bookings.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedId(b.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-colors ${
                b.id === activeId
                  ? 'border-brand-cyan bg-brand-cyan/10 text-brand-cyan'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <code className="font-mono">{b.booking_number}</code>
              <StatusBadge status={b.status} domain="booking" size="xs" showPulse={false} />
            </button>
          ))}
        </div>
      )}

      {detailLoading || !booking ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ───── ЛІВО 8/12 ───── */}
          <div className="lg:col-span-8 flex flex-col gap-5">

            {/* ── ШАПКА ── */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-2.5 mb-2">
                <code className="text-lg font-semibold font-mono text-blue-600 dark:text-blue-400 tracking-wide">
                  {booking.booking_number}
                </code>
                <StatusBadge status={booking.status} domain="booking" size="sm" />
              </div>
              <div className="flex items-start gap-3">
                <Bus size={18} className="text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-base leading-tight">
                    {booking.tour.name}
                  </h2>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5"><Calendar size={13} />{fmtDate(booking.tour.departure_date)}</span>
                    <span className="flex items-center gap-1.5"><Users size={13} />{booking.persons_count} ос.</span>
                    {booking.agent && (
                      <span className="text-xs text-slate-400">через {booking.agent.agency_name}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── УЧАСНИКИ ── */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700">
                <Users size={13} className="text-slate-400" />
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Учасники ({booking.participants.length})
                </h3>
              </div>
              {booking.participants.length === 0 ? (
                <p className="px-4 py-6 text-sm text-center text-slate-400">Дані про учасників ще вносяться менеджером</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/40">
                        {['ПІБ', 'Місце', 'Тип номера', 'Побажання'].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {booking.participants.map((p) => (
                        <tr key={p.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0">
                          <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {p.tourist.last_name} {p.tourist.first_name}
                            {p.role === 'contact' && <span className="ml-1.5 text-xs text-blue-500">(контакт)</span>}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {p.bus_sea_number ?? p.seat_number ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap">
                            {(p.room_type ?? p.preferred_room_type) ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 text-xs">
                            {'—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700">
                <Link
                  to="/my/preferences"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  <Sliders size={12} /> Змінити мої побажання (місце, номер) →
                </Link>
              </div>
            </div>

            {/* ── ПЛАТЕЖІ ── */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700">
                <CreditCard size={13} className="text-slate-400" />
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Платежі ({booking.payments.length})
                </h3>
              </div>
              {booking.payments.length === 0 ? (
                <p className="px-4 py-6 text-sm text-center text-slate-400">Платежів ще не було</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {booking.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div>
                        <p className="text-slate-700 dark:text-slate-300">
                          {PAYMENT_TYPE_LABELS[p.payment_type] ?? p.payment_type}
                        </p>
                        <p className="text-xs text-slate-400">{fmtDate(p.paid_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{fmtEur(p.amount)} {booking.currency}</p>
                        <p className="text-xs text-slate-400">{PAYMENT_STATUS_LABELS[p.status] ?? p.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ───── ПРАВО 4/12: ФІНАНСИ ───── */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700">
                <CreditCard size={13} className="text-slate-400" />
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Фінанси</h3>
              </div>
              <div className="px-4 py-3 space-y-3 text-sm">
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500 dark:text-slate-400">Ціна туру:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                    {fmtEur(booking.total_amount)} {booking.currency}
                  </span>
                </div>
                <div className="h-px bg-slate-100 dark:bg-slate-700" />
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500 dark:text-slate-400">Передоплата:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {fmtEur(booking.deposit_paid)} / {fmtEur(booking.deposit_amount)} {booking.currency}
                  </span>
                </div>
                {booking.deposit_deadline && (
                  <p className="text-xs text-slate-400 -mt-2">до {fmtDate(booking.deposit_deadline)}</p>
                )}
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500 dark:text-slate-400">Залишок:</span>
                  <span className={`font-medium ${booking.balance_amount - booking.balance_paid > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {fmtEur(booking.balance_amount - booking.balance_paid)} {booking.currency}
                  </span>
                </div>
                {booking.balance_deadline && (
                  <p className="text-xs text-slate-400 -mt-2">до {fmtDate(booking.balance_deadline)}</p>
                )}
                <div className="pt-1 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Оплачено</span><span>{paidPct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${paidPct >= 100 ? 'bg-emerald-500' : paidPct > 0 ? 'bg-amber-500' : 'bg-slate-200'}`}
                      style={{ width: `${paidPct}%` }}
                    />
                  </div>
                </div>
                <div className="pt-2 flex justify-center">
                  <StatusBadge status={booking.payment_status} domain="payment" size="sm" />
                </div>
              </div>
            </div>

            {booking.manager && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm">
                <p className="text-xs text-slate-400 mb-1">Ваш менеджер</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {booking.manager.first_name} {booking.manager.last_name}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyBooking;
