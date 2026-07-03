// ============================================================
// EUROTRIPS — pages/tourist/TouristCabinet.tsx
// Маршрут: /my/*   Роль: tourist тільки (ProtectedRoute)
//
// Кабінет туриста: мої бронювання, статус оплати, self-service
// вибір місця в автобусі + тип номеру (BR-12/OPS-03), профіль.
//
// Бронювання туристу створює менеджер/агент (агентська модель
// продажів, див. Контекст.txt Сценарій A/B) — тут НЕМАЄ каталогу
// турів для самостійного бронювання, тільки перегляд своїх поїздок.
// ============================================================

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Luggage, Calendar, MapPin, CreditCard, Armchair, User, Loader2,
  ShieldCheck, Edit3, Save, X, Info, CheckCircle2,
} from 'lucide-react';

import { StatusBadge }  from '../../components/ui/StatusBadge';
import { PaymentBlock } from '../../components/ui/PaymentBlock';
import { useAuth }      from '../../hooks/useAuth';
import { useBookings }  from '../../hooks/useBookings';
import { useSeatMap }   from '../../hooks/useSeatMap';
import { useUpdateTouristPreferences } from '../../hooks/useTouristPreferences';
import { useTouristProfile, useUpdateTouristProfile } from '../../hooks/useTouristProfile';
import { api } from '../../services/api';
import type { PaymentInfo, TouristRoomType, BookingStatus } from '../../types';

// ─── ROOM TYPE LABELS ───────────────────────────────────────────

const ROOM_TYPE_LABELS: Record<TouristRoomType, string> = {
  twin:          'Twin (2 окремих ліжка)',
  double:        'Double (1 двоспальне ліжко)',
  triple:        'Тримісний номер',
  single:        'Одномісний номер',
  no_preference: 'Без переваги',
};

const PREFERENCES_ALLOWED_STATUSES: BookingStatus[] = [
  'confirmed', 'docs_collected', 'ready_to_depart', 'on_trip',
];

const fmtEur = (n: number) => n.toLocaleString('uk-UA', { minimumFractionDigits: 0 });
const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
};

// ─── RAW BOOKING DETAIL (окремо від useBookings — потрібні participants/payments) ──

interface RawParticipant {
  id: string;
  tourist_id: string;
  role: string;
  preferred_room_type: TouristRoomType | null;
  bus_seat_number: number | null;
  roommate_preference: string | null;
  special_requirements: string | null;
  tourist: { id: string; first_name: string; last_name: string };
}

interface RawPayment {
  id: string; amount: number; payment_type: string;
  payment_method: string | null; status: string; paid_at: string | null;
}

interface RawBookingDetail {
  id: string; booking_number: string; status: BookingStatus;
  total_amount: number; deposit_amount: number; deposit_paid: number; deposit_deadline: string | null;
  balance_amount: number; balance_paid: number; balance_deadline: string | null;
  currency: string; payment_status: string;
  tour: { id: string; code: string; name: string; departure_date: string; return_date: string };
  manager: { id: string; first_name: string; last_name: string };
  participants: RawParticipant[];
  payments: RawPayment[];
  comment: string | null;
}

function useTouristBookingDetail(bookingId: string | undefined) {
  return useQuery({
    queryKey: ['bookings', 'detail', bookingId, 'tourist-view'],
    queryFn: async () => {
      const { data } = await api.get<{ data: RawBookingDetail }>(`/bookings/${bookingId}`);
      return data.data;
    },
    enabled: !!bookingId,
    staleTime: 30_000,
  });
}

// ─── SEAT PICKER ────────────────────────────────────────────────

const SeatPicker: React.FC<{
  bookingId: string;
  touristId: string;
  currentSeat: number | null;
}> = ({ bookingId, touristId, currentSeat }) => {
  const { data: seatMap, isLoading } = useSeatMap(bookingId);
  const mutation = useUpdateTouristPreferences();

  if (isLoading) return <Loader2 size={16} className="animate-spin text-slate-400" />;
  if (!seatMap || seatMap.total_seats === 0) {
    return <p className="text-xs text-slate-400">Схема місць недоступна для цього туру.</p>;
  }

  const pick = (seatNumber: number, isOccupied: boolean, isMine: boolean) => {
    if (isOccupied && !isMine) return;
    mutation.mutate({
      bookingId, touristId,
      dto: { busSeatNumber: isMine ? null : seatNumber },
    });
  };

  return (
    <div>
      <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5 mb-2">
        {seatMap.seats.map((s) => {
          const disabled = s.is_occupied && !s.is_mine;
          return (
            <button
              key={s.seat_number}
              type="button"
              disabled={disabled || mutation.isPending}
              onClick={() => pick(s.seat_number, s.is_occupied, s.is_mine)}
              title={s.is_mine ? 'Ваше місце — натисніть, щоб скасувати' : disabled ? 'Зайнято' : `Місце ${s.seat_number}`}
              className={`
                aspect-square rounded-md text-[10px] font-medium flex items-center justify-center transition-colors
                ${s.is_mine
                  ? 'bg-brand-cyan text-white'
                  : disabled
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-brand-cyan hover:text-brand-cyan cursor-pointer'
                }
              `}
            >
              {s.seat_number}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-brand-cyan inline-block" /> Ваше місце</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-200 dark:bg-slate-700 inline-block" /> Зайнято</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded border border-slate-300 inline-block" /> Вільно</span>
      </div>
      {currentSeat && (
        <p className="text-xs text-slate-500 mt-2">Ваше місце: <span className="font-medium text-slate-900 dark:text-slate-100">№{currentSeat}</span></p>
      )}
      {mutation.isError && (
        <p className="text-xs text-red-500 mt-2">
          {(mutation.error as any)?.response?.data?.error?.message ?? 'Не вдалося зберегти вибір місця'}
        </p>
      )}
    </div>
  );
};

// ─── PREFERENCES FORM (тип номеру + побажання) ───────────────────

const PreferencesForm: React.FC<{
  bookingId: string;
  touristId: string;
  initial: RawParticipant | undefined;
}> = ({ bookingId, touristId, initial }) => {
  const [roomType, setRoomType]   = useState<TouristRoomType>(initial?.preferred_room_type ?? 'no_preference');
  const [roommate, setRoommate]   = useState(initial?.roommate_preference ?? '');
  const [special, setSpecial]     = useState(initial?.special_requirements ?? '');
  const [saved, setSaved]         = useState(false);
  const mutation = useUpdateTouristPreferences();

  const handleSave = () => {
    setSaved(false);
    mutation.mutate({
      bookingId, touristId,
      dto: {
        preferredRoomType:   roomType,
        roommatePreference:  roommate || undefined,
        specialRequirements: special || undefined,
      },
    }, { onSuccess: () => setSaved(true) });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
          Бажаний тип номеру
        </label>
        <select
          value={roomType}
          onChange={(e) => { setRoomType(e.target.value as TouristRoomType); setSaved(false); }}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100"
        >
          {(Object.keys(ROOM_TYPE_LABELS) as TouristRoomType[]).map((k) => (
            <option key={k} value={k}>{ROOM_TYPE_LABELS[k]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
          Побажання по сусіду
        </label>
        <input
          value={roommate}
          onChange={(e) => { setRoommate(e.target.value); setSaved(false); }}
          placeholder="Наприклад: хочу жити з чоловіком / Оленою Коваленко"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
          Алергії / медичні обмеження
        </label>
        <textarea
          value={special}
          onChange={(e) => { setSpecial(e.target.value); setSaved(false); }}
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none"
        />
      </div>
      <button
        onClick={handleSave}
        disabled={mutation.isPending}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50 transition-colors"
      >
        {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Зберегти побажання
      </button>
      {saved && !mutation.isPending && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 size={12} /> Збережено</p>
      )}
    </div>
  );
};

// ─── BOOKING DETAIL PANEL ─────────────────────────────────────────

const BookingDetailPanel: React.FC<{ bookingId: string; touristId: string }> = ({ bookingId, touristId }) => {
  const { data: booking, isLoading } = useTouristBookingDetail(bookingId);

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 size={20} className="animate-spin text-slate-400" /></div>;
  }
  if (!booking) return null;

  const myParticipation = booking.participants.find((p) => p.tourist_id === touristId);
  const preferencesAllowed = PREFERENCES_ALLOWED_STATUSES.includes(booking.status);

  const payment: PaymentInfo = {
    label:            booking.booking_number,
    total_price:      booking.total_amount,
    amount_paid:      booking.deposit_paid + booking.balance_paid,
    deposit_amount:   booking.deposit_amount,
    balance_due:      Math.max(0, booking.balance_amount - booking.balance_paid),
    payment_deadline: booking.balance_deadline ?? booking.deposit_deadline ?? '',
    payment_status:   booking.payment_status as PaymentInfo['payment_status'],
    currency:         booking.currency,
  };

  return (
    <div className="space-y-5">
      {/* Tour info */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium text-slate-900 dark:text-slate-100">{booking.tour.name}</h3>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1"><Calendar size={11} /> {fmtDate(booking.tour.departure_date)} — {fmtDate(booking.tour.return_date)}</span>
            <code className="font-mono">{booking.tour.code}</code>
          </div>
        </div>
        <StatusBadge status={booking.status} domain="booking" size="sm" />
      </div>

      {/* Payment */}
      <PaymentBlock payment={payment} userRole="tourist" />

      {/* Manager contact */}
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2">
        <User size={12} />
        Ваш менеджер: <span className="font-medium text-slate-700 dark:text-slate-300">{booking.manager.first_name} {booking.manager.last_name}</span>
      </div>

      {/* Preferences: seat + room */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700">
          <Armchair size={14} className="text-slate-400" />
          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">Місце та розміщення</h4>
        </div>
        <div className="p-4">
          {!preferencesAllowed ? (
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Info size={12} /> Побажання можна вказати після підтвердження бронювання менеджером.
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">Місце в автобусі</p>
                <SeatPicker bookingId={bookingId} touristId={touristId} currentSeat={myParticipation?.bus_seat_number ?? null} />
              </div>
              <PreferencesForm bookingId={bookingId} touristId={touristId} initial={myParticipation} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── PROFILE CARD ───────────────────────────────────────────────

const ProfileCard: React.FC = () => {
  const { data: profile, isLoading } = useTouristProfile();
  const updateProfile = useUpdateTouristProfile();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    phone: '', nationality: '', passportNumber: '', passportExpiry: '',
    allergies: '', dietaryRestrictions: '',
  });

  const startEdit = () => {
    if (!profile) return;
    setForm({
      phone:               profile.phone ?? '',
      nationality:         profile.nationality ?? '',
      passportNumber:      profile.passport_number ?? '',
      passportExpiry:      profile.passport_expiry?.slice(0, 10) ?? '',
      allergies:           profile.allergies ?? '',
      dietaryRestrictions: profile.dietary_restrictions ?? '',
    });
    setEditing(true);
  };

  const save = () => {
    updateProfile.mutate({
      phone:               form.phone || undefined,
      nationality:         form.nationality || undefined,
      passportNumber:      form.passportNumber || undefined,
      passportExpiry:      form.passportExpiry || undefined,
      allergies:           form.allergies || undefined,
      dietaryRestrictions: form.dietaryRestrictions || undefined,
    }, { onSuccess: () => setEditing(false) });
  };

  if (isLoading) {
    return <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex justify-center"><Loader2 size={16} className="animate-spin text-slate-400" /></div>;
  }
  if (!profile) return null;

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <User size={14} className="text-slate-400" />
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Мій профіль</h3>
        </div>
        {!editing && (
          <button onClick={startEdit} className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700">
            <Edit3 size={11} /> Редагувати
          </button>
        )}
      </div>

      {!editing ? (
        <dl className="p-4 space-y-2.5 text-sm">
          <Row label="Ім'я"           value={`${profile.first_name} ${profile.last_name}`} />
          <Row label="Email"          value={profile.email ?? '—'} />
          <Row label="Телефон"        value={profile.phone ?? '—'} />
          <Row label="Громадянство"   value={profile.nationality ?? '—'} />
          <Row label="Паспорт"        value={profile.passport_number ?? '—'} />
          <Row label="Дійсний до"     value={fmtDate(profile.passport_expiry)} />
          <Row label="Алергії"        value={profile.allergies ?? '—'} />
          <Row label="Харчування"     value={profile.dietary_restrictions ?? '—'} />
        </dl>
      ) : (
        <div className="p-4 space-y-3">
          <Field label="Телефон" value={form.phone} onChange={(v) => setForm((s) => ({ ...s, phone: v }))} />
          <Field label="Громадянство" value={form.nationality} onChange={(v) => setForm((s) => ({ ...s, nationality: v }))} />
          <Field label="Номер паспорта" value={form.passportNumber} onChange={(v) => setForm((s) => ({ ...s, passportNumber: v }))} />
          <Field label="Паспорт дійсний до" type="date" value={form.passportExpiry} onChange={(v) => setForm((s) => ({ ...s, passportExpiry: v }))} />
          <Field label="Алергії" value={form.allergies} onChange={(v) => setForm((s) => ({ ...s, allergies: v }))} />
          <Field label="Обмеження харчування" value={form.dietaryRestrictions} onChange={(v) => setForm((s) => ({ ...s, dietaryRestrictions: v }))} />
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={updateProfile.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50"
            >
              {updateProfile.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Зберегти
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={12} /> Скасувати
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3">
    <dt className="text-slate-400 dark:text-slate-500">{label}</dt>
    <dd className="font-medium text-slate-900 dark:text-slate-100 text-right truncate">{value}</dd>
  </div>
);

const Field: React.FC<{ label: string; value: string; type?: string; onChange: (v: string) => void }> =
  ({ label, value, type = 'text', onChange }) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100"
      />
    </div>
  );

// ─── MAIN PAGE ────────────────────────────────────────────────

const TouristCabinet: React.FC = () => {
  const { user } = useAuth();
  const { data: bookingsData, isLoading: bookingsLoading } = useBookings({ limit: 20 });
  const bookings = bookingsData?.data ?? [];

  const upcoming = useMemo(
    () => bookings.filter((b) => !['completed', 'cancelled_client', 'cancelled_operator', 'refund', 'no_show'].includes(b.status)),
    [bookings]
  );

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const activeId = selectedId ?? upcoming[0]?.id ?? bookings[0]?.id;

  const totalDebt = bookings.reduce((s, b) => s + b.balance_due, 0);
  const name = user ? `${user.first_name} ${user.last_name}` : '—';

  // tourist_id резолвиться синхронно під час логіну (auth.service.ts) —
  // не залежить від bookingsLoading, тому перевіряємо одразу, без flash
  // повного кабінету (і зайвого 404 від /tourists/me) до першого рендеру.
  if (!user?.tourist_id) {
    return (
      <div className="p-6 max-w-screen-md mx-auto">
        <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-5 flex items-start gap-3">
          <Info size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Профіль ще не пов'язано з бронюванням</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              Ваш email ще не збігається з жодним записом клієнта в системі. Зверніться до менеджера,
              який оформлював вашу поїздку, щоб він прив'язав {user?.email} до вашого бронювання —
              після цього тут з'являться ваші тури.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-brand-cyan/10 border border-brand-cyan/30">
          <Luggage size={19} className="text-brand-cyan" />
        </div>
        <div>
          <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100">Вітаємо, {name}!</h1>
          <p className="text-xs text-slate-400">{user?.email}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Активні поїздки</p>
          <p className="text-base font-medium text-slate-900 dark:text-slate-100">{bookingsLoading ? '…' : upcoming.length}</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Найближча поїздка</p>
          <p className="text-base font-medium text-slate-900 dark:text-slate-100">
            {bookingsLoading ? '…' : upcoming[0] ? fmtDate(upcoming[0].tour_date) : '—'}
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Борг до сплати</p>
          <p className={`text-base font-medium ${totalDebt > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>
            {bookingsLoading ? '…' : totalDebt > 0 ? `${fmtEur(totalDebt)} EUR` : 'Все оплачено'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: bookings + detail */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700">
              <Luggage size={14} className="text-slate-400" />
              <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">Мої поїздки</h2>
            </div>

            {bookingsLoading ? (
              <div className="p-8 flex justify-center"><Loader2 size={18} className="animate-spin text-slate-400" /></div>
            ) : bookings.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">У вас поки немає бронювань</p>
            ) : (
              bookings.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0 text-left transition-colors ${
                    b.id === activeId ? 'bg-brand-cyan/5' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{b.tour_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin size={10} /> {fmtDate(b.tour_date)} · <code className="font-mono">{b.booking_number}</code>
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{fmtEur(b.total_price)} EUR</p>
                    {b.balance_due > 0 && <p className="text-xs text-amber-600 dark:text-amber-400">-{fmtEur(b.balance_due)}</p>}
                  </div>
                  <StatusBadge status={b.status} domain="booking" size="xs" />
                </button>
              ))
            )}
          </div>

          {activeId && user?.tourist_id && (
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-5">
              <BookingDetailPanel bookingId={activeId} touristId={user.tourist_id} />
            </div>
          )}
        </div>

        {/* RIGHT: profile */}
        <div className="flex flex-col gap-5">
          <ProfileCard />
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-start gap-2.5 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck size={14} className="text-slate-400 shrink-0 mt-0.5" />
            <p>Дані про вартість турів та комісії агентів вам недоступні — ви бачите лише інформацію,
              що стосується вашого бронювання.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TouristCabinet;
