// ============================================================
// EUROTRIPS — pages/BookingDetail.tsx
// Маршрут: /bookings/:id
// Ролі: admin, director, manager, ops_manager, accountant, agent (свої)
//
// Структура (відповідно до 1С-скринів):
//   1. Шапка: номер, статус, дата, кнопки документів
//   2. Деталі туру: код, назва, виїзд, місто, тип, гід
//   3. Список туристів: ПІБ, тип номера, місце в автобусі
//   4. Блок оплати: ціна, передоплата (дедлайн), залишок (дедлайн)
//   5. Комісія агента (прихована від tourist-ролі)
//   6. Статус інфолиста
//   7. Доступність місць (useTourAvailability)
//   8. Коментарі (real-time via polling / WebSocket — поки локальний стан)
//
// TODO: підключити navigate('/bookings/:id') у BookingRow.onRowClick
// ============================================================

import React, { useState, useMemo, useCallback } from 'react';
import {
  ArrowLeft, Download, FileText, Shield, CheckCircle2,
  Bus, MapPin, Calendar, Clock, Users, Coins,
  CreditCard, MessageSquare, Send, AlertTriangle,
  User, Loader2, RefreshCw, ChevronDown, Edit3,
  FileCheck, Info, Banknote, Network,
} from 'lucide-react';

import { StatusBadge }         from '../components/ui/StatusBadge';
import { useAuth }              from '../hooks/useAuth';
import { useBooking, useUpdateBookingStatus } from '../hooks/useBookings';
import { useTourAvailability }  from '../hooks/useTourAvailability';
import {
  getAllowedTransitions,
  isTerminalStatus,
} from '../constants/bookingTransitions';
import { BOOKING_STATUS_CONFIG } from '../constants/statuses';
import { MOCK_BOOKINGS }         from '../mocks';
import type { BookingStatus }    from '../types';

// ─── LOCAL TYPES ──────────────────────────────────────────────

/** Турист у складі бронювання */
interface BookingTourist {
  id:          string;
  first_name:  string;
  last_name:   string;
  middle_name?: string;
  passport?:   string;
  phone?:      string;
  birth_date?: string;
  room_type:   'twin' | 'dbl' | 'sngl' | 'triple';
  seat_number?: string;
  is_lead:     boolean;   // Контактна особа
}

interface BookingComment {
  id:          string;
  author:      string;
  role:        string;
  text:        string;
  created_at:  string;
}

// ─── MOCK EXTENSION ───────────────────────────────────────────
// TODO: замінити на tourists[] у відповіді GET /bookings/:id

const MOCK_TOURISTS: Record<string, BookingTourist[]> = {
  'bk-0001': [
    { id: 'tr-001', first_name: 'Марія',  last_name: 'Коваленко', middle_name: 'Іванівна',  passport: 'ФС 123456', phone: '+38 067 123 45 67', birth_date: '1985-03-12', room_type: 'twin', seat_number: '15', is_lead: true  },
    { id: 'tr-002', first_name: 'Петро',  last_name: 'Коваленко', middle_name: 'Олексійович', passport: 'ФС 789012', phone: '+38 067 123 45 68', birth_date: '1983-07-24', room_type: 'twin', seat_number: '16', is_lead: false },
  ],
  'bk-0002': [
    { id: 'tr-003', first_name: 'Іван',   last_name: 'Петренко',  passport: 'КА 345678', phone: '+38 050 987 65 43', birth_date: '1990-11-05', room_type: 'sngl', seat_number: '7', is_lead: true },
  ],
  'bk-0003': [
    { id: 'tr-004', first_name: 'Андрій', last_name: 'Ткаченко',  passport: 'АБ 001122', phone: '+38 044 100 00 01', birth_date: '1978-05-18', room_type: 'dbl', seat_number: '1',  is_lead: true  },
    { id: 'tr-005', first_name: 'Оксана', last_name: 'Мороз',     passport: 'АБ 003344', room_type: 'dbl',  seat_number: '2',  is_lead: false },
    { id: 'tr-006', first_name: 'Степан', last_name: 'Литвин',    passport: 'АБ 005566', room_type: 'twin', seat_number: '3',  is_lead: false },
    { id: 'tr-007', first_name: 'Наталя', last_name: 'Кузьменко', passport: 'АБ 007788', room_type: 'twin', seat_number: '4',  is_lead: false },
  ],
  'bk-0004': [
    { id: 'tr-008', first_name: 'Олена',  last_name: 'Сидоренко', passport: 'ВА 112233', phone: '+38 063 555 44 33', birth_date: '1992-08-30', room_type: 'twin', seat_number: '22', is_lead: true  },
    { id: 'tr-009', first_name: 'Дмитро', last_name: 'Сидоренко', passport: 'ВА 445566', birth_date: '1990-02-14', room_type: 'twin', seat_number: '23', is_lead: false },
  ],
};

const MOCK_COMMENTS: Record<string, BookingComment[]> = {
  'bk-0001': [
    { id: 'c1', author: 'Андрій Сич',       role: 'Менеджер', text: 'Клієнт підтвердив участь. Просить місця 15-16 (ряд 8, правий бік).', created_at: '2025-09-10T14:30:00Z' },
    { id: 'c2', author: 'ТА "Мрія"',        role: 'Агент',    text: 'Паспорти зняли копії, передамо завтра.', created_at: '2025-09-11T09:15:00Z' },
    { id: 'c3', author: 'Андрій Сич',       role: 'Менеджер', text: 'Передоплата 336 EUR надійшла на рахунок.', created_at: '2025-09-15T11:00:00Z' },
  ],
  'bk-0004': [
    { id: 'c4', author: 'Андрій Сич',       role: 'Менеджер', text: 'Клієнт повідомив про хворобу. Ініціює повернення.', created_at: '2025-10-14T16:00:00Z' },
    { id: 'c5', author: 'ТА "Галичина"',   role: 'Агент',    text: 'Підтверджуємо — форс-мажор, документи надамо.', created_at: '2025-10-14T17:30:00Z' },
  ],
};

// ─── HELPERS ──────────────────────────────────────────────────

const fmtEur = (n: number) => n.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtTime = (s?: string) => s ? new Date(s).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : '';

const ROOM_TYPE_LABELS: Record<string, string> = {
  twin:   'TWIN (окремі)',
  dbl:    'DBL (спільне)',
  sngl:   'SNGL (одномісний)',
  triple: 'TRIPLE (тримісний)',
};

// ─── SUB-COMPONENTS ───────────────────────────────────────────

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }> =
  ({ title, icon, children, className = '' }) => (
  <div className={`border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden ${className}`}>
    <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700">
      <span className="text-slate-400">{icon}</span>
      <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</h2>
    </div>
    {children}
  </div>
);

const DataRow: React.FC<{ label: string; value: React.ReactNode; highlight?: boolean }> =
  ({ label, value, highlight }) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
    <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0 min-w-[120px]">{label}</span>
    <span className={`text-sm text-right ${highlight ? 'font-medium text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
      {value}
    </span>
  </div>
);

const DocButton: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }> =
  ({ icon, label, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
  >
    {icon}
    {label}
  </button>
);

/** Скелетон для завантаження */
const DetailSkeleton: React.FC = () => (
  <div className="p-6 max-w-screen-xl mx-auto animate-pulse space-y-4">
    <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-64" />
    <div className="grid grid-cols-3 gap-4">
      {[1,2,3].map(i => <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl" />)}
    </div>
    <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-xl" />
  </div>
);

// ─── PAYMENT BLOCK ────────────────────────────────────────────

const PaymentSection: React.FC<{ booking: ReturnType<typeof MOCK_BOOKINGS[0]> }> =
  ({ booking: b }) => {
  const depositPct  = Math.round(b.prepayment_rate * 100);
  const paidPct     = b.total_price > 0 ? Math.round((b.amount_paid / b.total_price) * 100) : 0;
  const isOverdue   = b.payment_deadline && new Date(b.payment_deadline) < new Date();

  return (
    <Section title="Оплата" icon={<CreditCard size={14} />}>
      <div className="p-4 space-y-1">
        <DataRow label="Вартість туру" value={`${fmtEur(b.total_price)} EUR`} highlight />

        <DataRow
          label={`Передоплата (${depositPct}%)`}
          value={
            <span>
              <strong>{fmtEur(b.prepayment_amount)} EUR</strong>
              {b.payment_deadline && (
                <span className={`ml-2 text-xs ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                  до {fmtDate(b.payment_deadline)}
                </span>
              )}
            </span>
          }
        />

        <DataRow
          label="Залишок"
          value={
            b.balance_due > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {fmtEur(b.balance_due)} EUR
                {b.payment_deadline && (
                  <span className={`ml-2 text-xs font-normal ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                    до {fmtDate(b.payment_deadline)}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Закрито ✓</span>
            )
          }
        />

        <DataRow label="Оплачено" value={`${fmtEur(b.amount_paid)} EUR`} />

        {/* Прогрес */}
        <div className="pt-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>Оплата</span>
            <span>{paidPct}%</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                paidPct >= 100 ? 'bg-emerald-500' : paidPct > 0 ? 'bg-amber-500' : 'bg-slate-200'
              }`}
              style={{ width: `${paidPct}%` }}
            />
          </div>
        </div>

        {/* Статус оплати */}
        <div className="pt-2">
          <StatusBadge status={b.payment_status ?? b.status} domain="payment" size="xs" />
        </div>
      </div>
    </Section>
  );
};

// ─── COMMISSION BLOCK ─────────────────────────────────────────

const CommissionSection: React.FC<{ booking: ReturnType<typeof MOCK_BOOKINGS[0]> }> =
  ({ booking: b }) => {
  if (!b.agent_id || b.agent_commission_amount === undefined) return null;

  return (
    <Section title="Комісія агента" icon={<Coins size={14} />}>
      <div className="p-4 space-y-1">
        <DataRow label="Агент"       value={b.agent_name ?? '—'} />
        <DataRow
          label="Комісія"
          value={`${fmtEur(b.agent_commission_amount)} EUR (${Math.round((b.agent_commission_rate ?? 0) * 100)}%)`}
          highlight
        />
        <DataRow
          label="Статус"
          value={<StatusBadge status={b.commission_status ?? 'pending'} domain="commission" size="xs" />}
        />
        <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
          BR-02: комісія від базової ціни. BR-03: виплата після завершення туру.
        </p>
      </div>
    </Section>
  );
};

// ─── COMMENTS ─────────────────────────────────────────────────

const CommentsSection: React.FC<{ bookingId: string; authorName: string }> =
  ({ bookingId, authorName }) => {
  const [comments, setComments] = useState<BookingComment[]>(
    MOCK_COMMENTS[bookingId] ?? [],
  );
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const submit = useCallback(async () => {
    if (!draft.trim()) return;
    setSending(true);
    // TODO: POST /bookings/:id/comments { text: draft }
    await new Promise((r) => setTimeout(r, 400)); // simulate
    setComments((prev) => [
      ...prev,
      {
        id:         `c-${Date.now()}`,
        author:     authorName,
        role:       'Менеджер',
        text:       draft.trim(),
        created_at: new Date().toISOString(),
      },
    ]);
    setDraft('');
    setSending(false);
  }, [draft, authorName]);

  return (
    <Section title="Коментарі" icon={<MessageSquare size={14} />}>
      <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-72 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="px-4 py-6 text-sm text-center text-slate-400">Коментарів немає</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{c.author}</span>
                <span className="text-xs text-slate-400">{c.role}</span>
                <span className="text-xs text-slate-300 dark:text-slate-600 ml-auto">
                  {fmtDate(c.created_at)} {fmtTime(c.created_at)}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{c.text}</p>
            </div>
          ))
        )}
      </div>
      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submit()}
          placeholder="Додати коментар..."
          className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={submit}
          disabled={!draft.trim() || sending}
          className="px-3 py-2 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm hover:opacity-80 disabled:opacity-40 transition-opacity"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    </Section>
  );
};

// ─── STATUS CHANGE ────────────────────────────────────────────

const StatusChanger: React.FC<{
  bookingId:     string;
  currentStatus: BookingStatus;
  canChange:     boolean;
}> = ({ bookingId, currentStatus, canChange }) => {
  const [open, setOpen]   = useState(false);
  const mutation = useUpdateBookingStatus();
  const allowed  = useMemo(() => getAllowedTransitions(currentStatus), [currentStatus]);

  if (!canChange || allowed.length === 0) return null;

  const change = (next: BookingStatus) => {
    setOpen(false);
    mutation.mutate({
      bookingId,
      currentStatus,
      dto: { status: next },
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={mutation.isPending || isTerminalStatus(currentStatus)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
      >
        {mutation.isPending
          ? <Loader2 size={12} className="animate-spin" />
          : <Edit3 size={12} />
        }
        Змінити статус
        <ChevronDown size={11} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 min-w-[200px]">
          {allowed.map((s) => {
            const cfg = BOOKING_STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => change(s)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <StatusBadge status={s} domain="booking" size="xs" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────

interface BookingDetailProps {
  /** UUID бронювання з URL-параметра */
  bookingId: string;
  /** Навігація назад — викликається при кнопці "← Бронювання" */
  onBack:    () => void;
}

const BookingDetail: React.FC<BookingDetailProps> = ({ bookingId, onBack }) => {
  const { user, isAgent, isManager, isAdmin, isOpsManager, canSeeMargin } = useAuth();

  // ── Data ───────────────────────────────────────────────────
  const { data: booking, isLoading, isError, refetch } = useBooking(bookingId);

  const tourists = useMemo(
    () => (bookingId ? MOCK_TOURISTS[bookingId] ?? [] : []),
    [bookingId],
  );

  // Availability тільки якщо тур ще не завершений
  const {
    data: avail,
    isLoading: availLoading,
  } = useTourAvailability(booking?.tour_id, {
    enabled: !!booking?.tour_id && !['completed', 'cancelled_client', 'cancelled_operator'].includes(booking.status),
  });

  // ── RBAC ───────────────────────────────────────────────────
  const canChangeStatus = isAdmin || isManager || isOpsManager;
  const canDownloadDocs = !isLoading && !!booking;

  // ── Handlers ────────────────────────────────────────────────
  const handleDownload = (doc: string) => {
    // TODO: GET /bookings/:id/documents/:doc → download blob
    console.log('[BookingDetail] Download:', doc, bookingId);
  };

  if (isLoading) return <DetailSkeleton />;

  if (isError || !booking) return (
    <div className="p-6 flex flex-col items-center justify-center py-20 text-slate-400">
      <AlertTriangle size={32} className="opacity-50 mb-3 text-red-400" />
      <p className="text-sm mb-3">Бронювання не знайдено або виникла помилка.</p>
      <div className="flex gap-2">
        <button onClick={onBack} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          ← Назад
        </button>
        <button onClick={() => refetch()} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1">
          <RefreshCw size={11} /> Повторити
        </button>
      </div>
    </div>
  );

  const tour = booking;  // Booking contains tour_name, tour_date etc.
  const isOwnAgentBooking = isAgent && booking.agent_id === user?.id;
  const showCommission = (isAdmin || isManager || isAgent) && !!booking.agent_commission_amount;

  return (
    <div className="p-6 max-w-screen-xl mx-auto">

      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-500"
            aria-label="Назад до списку"
          >
            <ArrowLeft size={16} />
          </button>

          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-lg font-semibold font-mono text-blue-600 dark:text-blue-400">
                {booking.booking_number}
              </h1>
              <StatusBadge status={booking.status} domain="booking" size="sm" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Створено {fmtDate(booking.created_at)} · Оновлено {fmtDate(booking.updated_at)}
              {booking.manager_name && ` · ${booking.manager_name}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Зміна статусу */}
          <StatusChanger
            bookingId={booking.id}
            currentStatus={booking.status}
            canChange={canChangeStatus}
          />

          {/* Документи */}
          <DocButton icon={<FileText  size={13} />} label="Договір"       onClick={() => handleDownload('contract')}     disabled={!canDownloadDocs} />
          <DocButton icon={<FileCheck size={13} />} label="Підтвердження" onClick={() => handleDownload('confirmation')} disabled={!canDownloadDocs} />
          <DocButton icon={<Shield    size={13} />} label="Страховка"     onClick={() => handleDownload('insurance')}    disabled={!canDownloadDocs} />
          <DocButton icon={<Download  size={13} />} label="Всі PDF"       onClick={() => handleDownload('all')}          disabled={!canDownloadDocs} />
        </div>
      </div>

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* LEFT 7/12 */}
        <div className="lg:col-span-7 flex flex-col gap-5">

          {/* ── 1. Деталі туру ── */}
          <Section title="Тур" icon={<Bus size={14} />}>
            <div className="px-4 py-3 space-y-1">
              <DataRow label="Назва туру"      value={<strong>{booking.tour_name}</strong>} highlight />
              <DataRow label="Дата виїзду"     value={booking.tour_date} />
              <DataRow label="Тип бронювання"  value={{ direct: 'Прямий продаж', agent: 'Через агента', corporate: 'Корпоративне', group: 'Груповий' }[booking.booking_type] ?? booking.booking_type} />
              <DataRow label="К-сть туристів"  value={`${booking.pax_count} ос.`} />
              <DataRow label="Контакт"         value={booking.contact_name} />
              {booking.contact_phone && <DataRow label="Телефон" value={booking.contact_phone} />}
              {booking.contact_email && <DataRow label="Email"   value={booking.contact_email} />}
              {booking.notes && (
                <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Info size={10} /> Примітки</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{booking.notes}</p>
                </div>
              )}
            </div>
          </Section>

          {/* ── 2. Список туристів ── */}
          <Section title={`Туристи (${tourists.length})`} icon={<Users size={14} />}>
            {tourists.length === 0 ? (
              <p className="px-4 py-6 text-sm text-center text-slate-400">
                Дані туристів ще не внесені
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60">
                      {['ПІБ', 'Паспорт', 'Телефон', 'Тип номера', 'Місце', ''].map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tourists.map((t) => (
                      <tr key={t.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {t.last_name} {t.first_name}
                          {t.middle_name && ` ${t.middle_name}`}
                          {t.is_lead && (
                            <span className="ml-1.5 text-blue-500 text-xs">(контакт)</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 font-mono">{t.passport ?? '—'}</td>
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{t.phone ?? '—'}</td>
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                          {ROOM_TYPE_LABELS[t.room_type]}
                        </td>
                        <td className="px-3 py-2.5">
                          {t.seat_number ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-medium text-xs">
                              {t.seat_number}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          {t.birth_date && (
                            <span className="text-slate-400">
                              {fmtDate(t.birth_date)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Місця в автобусі — зведений рядок */}
                {tourists.some((t) => t.seat_number) && (
                  <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 flex items-center gap-2">
                    <Bus size={11} />
                    Місця в автобусі:&nbsp;
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {tourists.filter((t) => t.seat_number).map((t) => t.seat_number).join(', ')}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="text-slate-400">Повна схема автобуса — в Operations</span>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* ── 3. Коментарі ── */}
          <CommentsSection
            bookingId={bookingId}
            authorName={user?.full_name ?? 'Користувач'}
          />
        </div>

        {/* RIGHT 5/12 */}
        <div className="lg:col-span-5 flex flex-col gap-5">

          {/* ── 4. Оплата ── */}
          <PaymentSection booking={booking} />

          {/* ── 5. Комісія ── */}
          {showCommission && <CommissionSection booking={booking} />}

          {/* ── 6. Статус інфолиста ── */}
          <Section title="Статус інфолиста" icon={<Info size={14} />}>
            <div className="p-4">
              {/* TODO: підключити реальний статус інфолиста */}
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                  <Clock size={11} />
                  Не відправлено
                </span>
                <button className="text-xs text-blue-500 hover:underline">
                  Надіслати →
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Інфолист з деталями туру та пам'ятками
              </p>
            </div>
          </Section>

          {/* ── 7. Доступність місць ── */}
          <Section title="Місця у турі" icon={<Users size={14} />}>
            <div className="p-4">
              {availLoading ? (
                <div className="h-12 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
              ) : avail ? (
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {avail.availableSeats === 0
                        ? <span className="text-red-500">Немає місць</span>
                        : `${avail.availableSeats} вільних`}
                    </span>
                    <span className="text-xs text-slate-400">
                      {avail.bookedSeats} / {avail.totalSeats}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full ${avail.barColorClass}`}
                      style={{ width: `${avail.occupancyPct}%` }}
                    />
                  </div>
                  {/* Структура кімнат */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    {Object.entries(avail.roomStructure).map(([type, count]) => (
                      <div key={type} className="bg-slate-50 dark:bg-slate-800 rounded-lg py-2">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{count}</p>
                        <p className="text-slate-400 uppercase text-[10px]">{type}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Інформація про місця недоступна</p>
              )}
            </div>
          </Section>

          {/* ── 8. Скасування (якщо є) ── */}
          {(booking.status === 'cancelled_client' || booking.status === 'cancelled_operator' || booking.status === 'refund') && booking.cancel_reason && (
            <Section title="Скасування" icon={<AlertTriangle size={14} />}>
              <div className="p-4">
                <DataRow label="Причина"    value={booking.cancel_reason} />
                {booking.cancelled_at && <DataRow label="Дата скасування" value={fmtDate(booking.cancelled_at)} />}
                <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  {booking.status === 'cancelled_operator'
                    ? 'BR-08: Повернення 100% оплаченої суми клієнту'
                    : 'BR-08: Штраф розраховується за cancellation_policy туру'}
                </p>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingDetail;
