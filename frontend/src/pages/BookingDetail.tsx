// ============================================================
// EUROTRIPS — pages/BookingDetail.tsx  v2.0
// Маршрут: /bookings/:id
//
// Лейаут (відтворює 1С-скрин):
//   ┌─ Шапка: номер | статус | дата | менеджер
//   ├─ 2-колонковий грід (8/12 + 4/12)
//   │  ├─ ЛІВО: тур, таблиця туристів, документи, коментарі
//   │  └─ ПРАВО: фінанси, страхування (ADR-003 INS-01/INS-03)
//   └─ BR-09: банер якщо авіа-тур без підтвердженої страховки
//
// ADR-003 Variant A: Tour = один виїзд (product_code для групування)
// BR-04: агент НЕ бачить cost_price/margin
// BR-09: авіа-тур → ready_to_depart вимагає Insurance.confirmed
// ============================================================

import React, { useState, useMemo, useCallback } from 'react';
import {
  ArrowLeft, Download, FileText, Shield, CheckCircle2,
  Bus, Calendar, MapPin, Users, CreditCard, Coins,
  MessageSquare, Send, Loader2, RefreshCw, AlertTriangle,
  Edit3, ChevronDown, Clock, X, BadgeCheck, FileCheck,
  Info, CircleDot,
} from 'lucide-react';

import { StatusBadge }          from '../components/ui/StatusBadge';
import { useAuth }               from '../hooks/useAuth';
import { useBooking, useUpdateBookingStatus } from '../hooks/useBookings';
import { useTourAvailability }   from '../hooks/useTourAvailability';
import {
  useBookingDocuments, useGenerateBookingDocument, openBookingDocument,
} from '../hooks/useBookingDocuments';
import {
  useBookingCommunications, useCreateBookingCommunication,
  type CommunicationChannel,
} from '../hooks/useBookingCommunications';
import {
  getAllowedTransitions,
  isTerminalStatus,
} from '../constants/bookingTransitions';
import { BOOKING_STATUS_CONFIG } from '../constants/statuses';
import { MOCK_BOOKINGS }         from '../mocks';
import type { BookingStatus }    from '../types';

// ─── TYPES ────────────────────────────────────────────────────

interface BookingTourist {
  id:           string;
  last_name:    string;
  first_name:   string;
  middle_name?: string;
  passport?:    string;
  phone?:       string;
  birth_date?:  string;
  room_type:    'twin' | 'dbl' | 'sngl' | 'triple';
  seat_number?: string;
  is_lead:      boolean;
  insurance?: {
    type:   'standard' | 'extended' | 'aviation' | 'premium';
    status: 'pending' | 'confirmed' | 'cancelled';
    policy_number?: string;
    coverage_end?:  string;
  };
}

interface BookingComment {
  id:         string;
  author:     string;
  role:       string;
  text:       string;
  created_at: string;
}

// ─── MOCK EXTENSION ───────────────────────────────────────────
// TODO: tourists[] повертатиметься у GET /bookings/:id після реалізації Backend

const MOCK_TOURISTS: Record<string, BookingTourist[]> = {
  'bk-0001': [
    { id:'tr-001', last_name:'Коваленко', first_name:'Марія',  middle_name:'Іванівна',   passport:'ФС 123456', phone:'+38 067 123 45 67', birth_date:'1985-03-12', room_type:'twin', seat_number:'15', is_lead:true,  insurance:{ type:'standard', status:'pending' } },
    { id:'tr-002', last_name:'Коваленко', first_name:'Петро',  middle_name:'Олексійович', passport:'ФС 789012', birth_date:'1983-07-24', room_type:'twin', seat_number:'16', is_lead:false, insurance:{ type:'standard', status:'pending' } },
  ],
  'bk-0002': [
    { id:'tr-003', last_name:'Петренко',  first_name:'Іван',   passport:'КА 345678', phone:'+38 050 987 65 43', birth_date:'1990-11-05', room_type:'sngl', seat_number:'7', is_lead:true, insurance:{ type:'aviation', status:'confirmed', policy_number:'POL-2025-0034' } },
  ],
  'bk-0003': [
    { id:'tr-004', last_name:'Ткаченко',  first_name:'Андрій', passport:'АБ 001122', room_type:'dbl',  seat_number:'1', is_lead:true  },
    { id:'tr-005', last_name:'Мороз',     first_name:'Оксана', passport:'АБ 003344', room_type:'dbl',  seat_number:'2', is_lead:false },
    { id:'tr-006', last_name:'Литвин',    first_name:'Степан', passport:'АБ 005566', room_type:'twin', seat_number:'3', is_lead:false },
    { id:'tr-007', last_name:'Кузьменко', first_name:'Наталя', passport:'АБ 007788', room_type:'twin', seat_number:'4', is_lead:false },
  ],
  'bk-0004': [
    { id:'tr-008', last_name:'Сидоренко', first_name:'Олена',  passport:'ВА 112233', phone:'+38 063 555 44 33', birth_date:'1992-08-30', room_type:'twin', seat_number:'22', is_lead:true  },
    { id:'tr-009', last_name:'Сидоренко', first_name:'Дмитро', passport:'ВА 445566', birth_date:'1990-02-14', room_type:'twin', seat_number:'23', is_lead:false },
  ],
};

const MOCK_COMMENTS: Record<string, BookingComment[]> = {
  'bk-0001': [
    { id:'c1', author:'Андрій Сич',    role:'Менеджер', text:'Клієнт підтвердив участь. Просить місця 15-16 (ряд 8, правий бік).', created_at:'2025-09-10T14:30:00Z' },
    { id:'c2', author:'ТА "Мрія"',    role:'Агент',    text:'Паспорти зняли копії, передамо завтра.', created_at:'2025-09-11T09:15:00Z' },
    { id:'c3', author:'Андрій Сич',    role:'Менеджер', text:'Передоплата 336 EUR надійшла на рахунок.', created_at:'2025-09-15T11:00:00Z' },
  ],
  'bk-0004': [
    { id:'c4', author:'Андрій Сич',    role:'Менеджер', text:'Клієнт повідомив про хворобу. Ініціює повернення.', created_at:'2025-10-14T16:00:00Z' },
    { id:'c5', author:'ТА "Галичина"', role:'Агент',    text:'Підтверджуємо — форс-мажор, документи надамо.', created_at:'2025-10-14T17:30:00Z' },
  ],
};

const ROOM_LABELS: Record<string, string> = {
  twin:   'TWIN', dbl: 'DBL', sngl: 'SNGL', triple: 'TRIPLE',
};

const INS_TYPE_LABELS: Record<string, string> = {
  standard: 'Базова', extended: 'Розширена', aviation: 'Авіа+багаж', premium: 'Преміум',
};

// ─── HELPERS ──────────────────────────────────────────────────

const fmtEur = (n: number) =>
  n.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (s?: string | null): string => {
  if (!s) return '—';
  const d = new Date(s.includes('T') ? s : s + 'T00:00:00Z');
  return d.toLocaleDateString('uk-UA', { day:'2-digit', month:'2-digit', year:'2-digit', timeZone:'UTC' });
};

const fmtDateTime = (s: string) => {
  const d = new Date(s);
  return `${d.toLocaleDateString('uk-UA', { day:'2-digit', month:'2-digit' })} ${d.toLocaleTimeString('uk-UA', { hour:'2-digit', minute:'2-digit' })}`;
};

const isOverdue = (date?: string | null) =>
  !!date && new Date(date) < new Date();

// ─── PAYMENT INDICATOR ────────────────────────────────────────

const PayIndicator: React.FC<{ paid: boolean; overdue?: boolean }> = ({ paid, overdue }) => {
  if (paid)    return <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium"><BadgeCheck size={13} /> Оплачено</span>;
  if (overdue) return <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium"><CircleDot   size={11} className="fill-red-500" /> Прострочено</span>;
  return       <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"><CircleDot   size={11} className="fill-amber-500" /> Не оплачено</span>;
};

// ─── STATUS CHANGER ───────────────────────────────────────────

const StatusChanger: React.FC<{ bookingId: string; current: BookingStatus; canChange: boolean }> =
  ({ bookingId, current, canChange }) => {
  const [open, setOpen] = useState(false);
  const mutation = useUpdateBookingStatus();
  const allowed  = useMemo(() => getAllowedTransitions(current), [current]);

  if (!canChange || isTerminalStatus(current) || allowed.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={mutation.isPending}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
      >
        {mutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Edit3 size={11} />}
        Статус
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 min-w-[210px]">
            {allowed.map(s => (
              <button
                key={s}
                onClick={() => { mutation.mutate({ bookingId, currentStatus: current, dto: { status: s } }); setOpen(false); }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <StatusBadge status={s} domain="booking" size="xs" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ─── COMMENTS ─────────────────────────────────────────────────

const CommentsBlock: React.FC<{ bookingId: string; author: string }> = ({ bookingId, author }) => {
  const [items, setItems] = useState<BookingComment[]>(MOCK_COMMENTS[bookingId] ?? []);
  const [draft, setDraft] = useState('');
  const [busy,  setBusy]  = useState(false);

  const send = useCallback(async () => {
    if (!draft.trim()) return;
    setBusy(true);
    await new Promise(r => setTimeout(r, 350)); // TODO: POST /bookings/:id/comments
    setItems(prev => [...prev, { id: `c-${Date.now()}`, author, role: 'Менеджер', text: draft.trim(), created_at: new Date().toISOString() }]);
    setDraft('');
    setBusy(false);
  }, [draft, author]);

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700">
        <MessageSquare size={13} className="text-slate-400" />
        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Коментарі до заявки</h3>
        <span className="ml-auto text-xs text-slate-400">{items.length}</span>
      </div>
      <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
        {items.length === 0
          ? <p className="px-4 py-5 text-sm text-center text-slate-400">Коментарів немає</p>
          : items.map(c => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{c.author}</span>
                  <span className="text-xs text-slate-400">{c.role}</span>
                  <span className="ml-auto text-xs text-slate-300 dark:text-slate-600">{fmtDateTime(c.created_at)}</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{c.text}</p>
              </div>
            ))
        }
      </div>
      <div className="flex gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-700">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Додати коментар… (Enter для надсилання)"
          className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={send}
          disabled={!draft.trim() || busy}
          className="px-3 py-2 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 disabled:opacity-40 hover:opacity-80 transition-opacity"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </button>
      </div>
    </div>
  );
};

// ─── SKELETON ─────────────────────────────────────────────────

// ─── ДОКУМЕНТИ БРОНЮВАННЯ (Реліз 1) ───────────────────────────

const DocumentsBlock: React.FC<{ bookingId: string; canGenerate: boolean }> = ({ bookingId, canGenerate }) => {
  const { data: docs, isLoading } = useBookingDocuments(bookingId);
  const generateDoc = useGenerateBookingDocument(bookingId);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (docType: 'voucher' | 'contract') => {
    setError(null);
    try {
      const doc = await generateDoc.mutateAsync(docType);
      await openBookingDocument(bookingId, doc.id);
    } catch {
      setError('Не вдалося згенерувати документ.');
    }
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Download size={13} className="text-slate-400" />
        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Документи</h3>
      </div>

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      {canGenerate && (
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => handleGenerate('voucher')}
            disabled={generateDoc.isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
          >
            <FileCheck size={13} /> Згенерувати ваучер (PDF)
          </button>
          <button
            onClick={() => handleGenerate('contract')}
            disabled={generateDoc.isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
          >
            <FileText size={13} /> Згенерувати договір (PDF)
          </button>
          {generateDoc.isPending && <Loader2 size={14} className="animate-spin text-slate-400 self-center" />}
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-slate-400">Завантаження…</p>
      ) : (docs?.length ?? 0) === 0 ? (
        <p className="text-xs text-slate-400">Документів ще не згенеровано.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {docs!.map((d) => (
            <button
              key={d.id}
              onClick={() => openBookingDocument(bookingId, d.id)}
              className="w-full flex items-center justify-between gap-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 truncate">
                <FileText size={13} className="text-slate-400 shrink-0" /> {d.title}
              </span>
              <span className="text-xs text-slate-400 font-mono shrink-0">
                {new Date(d.generated_at).toLocaleDateString('uk-UA')}{d.file_size_kb ? ` · ${d.file_size_kb} КБ` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── ПОВІДОМЛЕННЯ (Реліз 1: базові повідомлення) ──────────────

const CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  email: 'Email', sms: 'SMS', telegram: 'Telegram', viber: 'Viber', internal: 'Внутрішнє',
};

const CommunicationsBlock: React.FC<{ bookingId: string; canWrite: boolean }> = ({ bookingId, canWrite }) => {
  const { data: messages, isLoading } = useBookingCommunications(bookingId);
  const createMessage = useCreateBookingCommunication(bookingId);
  const [channel, setChannel] = useState<CommunicationChannel>('viber');
  const [body, setBody] = useState('');

  const handleSend = async () => {
    if (!body.trim()) return;
    await createMessage.mutateAsync({ channel, direction: 'outbound', body: body.trim() });
    setBody('');
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare size={13} className="text-slate-400" />
        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Повідомлення клієнту</h3>
      </div>

      {isLoading ? (
        <p className="text-xs text-slate-400">Завантаження…</p>
      ) : (messages?.length ?? 0) === 0 ? (
        <p className="text-xs text-slate-400 mb-3">Повідомлень ще немає. Автоматичні Telegram-нотифікації з'являться тут після підтвердження броні.</p>
      ) : (
        <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
          {messages!.map((m) => (
            <div key={m.id} className="text-xs bg-slate-50 dark:bg-slate-800/50 rounded-lg px-2.5 py-1.5">
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {CHANNEL_LABELS[m.channel] ?? m.channel} · {m.direction === 'outbound' ? 'вихідне' : 'вхідне'}
                </span>
                <span className="text-slate-400">{new Date(m.created_at).toLocaleString('uk-UA')}</span>
              </div>
              {m.subject && <p className="text-slate-600 dark:text-slate-400 font-medium">{m.subject}</p>}
              {m.body && <p className="text-slate-500">{m.body}</p>}
            </div>
          ))}
        </div>
      )}

      {canWrite && (
        <div className="flex items-end gap-2">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as CommunicationChannel)}
            className="px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
          >
            {(Object.keys(CHANNEL_LABELS) as CommunicationChannel[]).map((c) => (
              <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
            ))}
          </select>
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Зафіксувати повідомлення/контакт…"
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
          <button
            onClick={handleSend}
            disabled={createMessage.isPending || !body.trim()}
            aria-label="Надіслати"
            className="p-2 rounded-lg bg-brand-cyan text-white hover:bg-brand-cyan-dark disabled:opacity-40 transition-colors"
          >
            <Send size={13} />
          </button>
        </div>
      )}
    </div>
  );
};

const Skeleton: React.FC = () => (
  <div className="p-6 max-w-screen-xl mx-auto animate-pulse space-y-4">
    <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded-lg w-72" />
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-8 space-y-3">
        {[80,48,120,56].map(h => <div key={h} className={`h-${h === 120 ? 32 : h === 80 ? 20 : h === 48 ? 12 : 14} bg-slate-100 dark:bg-slate-800 rounded-xl`} style={{height: h}} />)}
      </div>
      <div className="col-span-4 space-y-3">
        <div className="h-56 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl" />
      </div>
    </div>
  </div>
);

// ─── MAIN PAGE ────────────────────────────────────────────────

export interface BookingDetailProps {
  bookingId: string;
  onBack:    () => void;
}

const BookingDetail: React.FC<BookingDetailProps> = ({ bookingId, onBack }) => {
  const { user, isAdmin, isManager, isOpsManager, isAgent, canSeeMargin } = useAuth();

  // ── Data ──────────────────────────────────────────────────
  const { data: booking, isLoading, isError, refetch } = useBooking(bookingId);

  const tourists = useMemo(() => MOCK_TOURISTS[bookingId] ?? [], [bookingId]);

  const hasUnconfirmedInsurance = useMemo(() =>
    tourists.some(t => t.insurance?.status !== 'confirmed'),
    [tourists]);

  // Availability для авіа-турів (BR-09)
  const { data: avail } = useTourAvailability(booking?.tour_id, {
    enabled: !!booking?.tour_id,
  });

  // ── RBAC ──────────────────────────────────────────────────
  const canChangeStatus = isAdmin || isManager || isOpsManager;
  const showCommission  = !!booking?.agent_id && (isAdmin || isManager || isAgent);
  const isTourAvia      = false; // TODO: join tour.tour_type from booking response

  // ── Loading / Error ────────────────────────────────────────
  if (isLoading) return <Skeleton />;

  if (isError || !booking) return (
    <div className="p-6 flex flex-col items-center py-20 text-slate-400">
      <AlertTriangle size={36} className="opacity-50 mb-3 text-red-400" />
      <p className="text-sm mb-3">Бронювання не знайдено.</p>
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

  const depositPaid = booking.amount_paid >= booking.prepayment_amount;
  const balancePaid = booking.balance_due === 0;
  const depOverdue  = isOverdue(booking.payment_deadline) && !depositPaid;
  const balOverdue  = isOverdue(booking.payment_deadline) && !balancePaid;

  return (
    <div className="p-6 max-w-screen-xl mx-auto">

      {/* ── BR-09 BANNER — авіа + незастраховані ── */}
      {isTourAvia && hasUnconfirmedInsurance && (
        <div className="flex items-start gap-3 mb-4 px-4 py-3 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          <div>
            <strong>BR-09:</strong> Авіа-тур — перехід у "Готово до виїзду" неможливий.
            {' '}Не всі туристи мають підтверджену страховку.
            <a href="#insurance" className="ml-2 underline">Перейти до страхування →</a>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-500"
            aria-label="Назад"
          >
            <ArrowLeft size={15} />
          </button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-semibold font-mono text-blue-600 dark:text-blue-400 tracking-wide">
                {booking.booking_number}
              </h1>
              <StatusBadge status={booking.status} domain="booking" size="sm" />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {fmtDate(booking.created_at)}
              {booking.manager_name && <> &middot; Менеджер: <strong>{booking.manager_name}</strong></>}
              {booking.agent_name   && <> &middot; Агент: <strong>{booking.agent_name}</strong></>}
            </p>
          </div>
        </div>
        <StatusChanger bookingId={booking.id} current={booking.status} canChange={canChangeStatus} />
      </div>

      {/* ── MAIN 2-COLUMN GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* ───── LEFT 8/12 ───── */}
        <div className="lg:col-span-8 flex flex-col gap-5">

          {/* ── ТУР ── */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Bus size={18} className="text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-base leading-tight">
                  {booking.tour_name}
                </h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5"><Calendar size={13} />{booking.tour_date}</span>
                  <span className="flex items-center gap-1.5"><MapPin   size={13} />Місто відправлення</span>
                  <span className="flex items-center gap-1.5"><Users    size={13} />{booking.pax_count} туристів</span>
                  <span className="px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    {{ direct:'Прямий', agent:'Через агента', corporate:'Корпоративний', group:'Груповий' }[booking.booking_type] ?? booking.booking_type}
                  </span>
                </div>
                {booking.notes && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                    <Info size={12} className="mt-0.5 flex-shrink-0 text-slate-400" />
                    {booking.notes}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── ТАБЛИЦЯ ТУРИСТІВ ── */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700">
              <Users size={13} className="text-slate-400" />
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Туристи ({tourists.length})
              </h3>
            </div>
            {tourists.length === 0 ? (
              <p className="px-4 py-6 text-sm text-center text-slate-400">Туристів ще не внесено</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/40">
                      {['ПІБ', 'Місце', 'Вид номера', 'Паспорт', 'Страховка'].map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tourists.map(t => (
                      <tr key={t.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {t.last_name} {t.first_name}
                          {t.middle_name && ` ${t.middle_name.charAt(0)}.`}
                          {t.is_lead && <span className="ml-1.5 text-xs text-blue-500">(контакт)</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {t.seat_number
                            ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-medium">{t.seat_number}</span>
                            : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap">
                          {ROOM_LABELS[t.room_type]}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 font-mono text-xs">
                          {t.passport ?? '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          {t.insurance ? (
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${
                              t.insurance.status === 'confirmed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                : t.insurance.status === 'cancelled'
                                  ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800'
                                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800'
                            }`}>
                              {t.insurance.status === 'confirmed'
                                ? <><CheckCircle2 size={10} />{INS_TYPE_LABELS[t.insurance.type]}</>
                                : <><Clock size={10} />{INS_TYPE_LABELS[t.insurance.type]}</>}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Не оформлено</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── ДОКУМЕНТИ (Реліз 1: PDF ваучер/договір) ── */}
          <DocumentsBlock bookingId={bookingId} canGenerate={isAdmin || isManager || isAgent} />

          {/* ── ПОВІДОМЛЕННЯ (Реліз 1: базові повідомлення) ── */}
          <CommunicationsBlock bookingId={bookingId} canWrite={isAdmin || isManager || isAgent} />

          {/* ── КОМЕНТАРІ ── */}
          <CommentsBlock bookingId={bookingId} author={user?.full_name ?? 'Менеджер'} />
        </div>

        {/* ───── RIGHT 4/12 ───── */}
        <div className="lg:col-span-4 flex flex-col gap-4">

          {/* ── ФІНАНСИ ── */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700">
              <CreditCard size={13} className="text-slate-400" />
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Фінанси</h3>
            </div>
            <div className="px-4 py-3 space-y-3 text-sm">

              {/* Ціна */}
              <div className="flex justify-between items-baseline">
                <span className="text-slate-500 dark:text-slate-400">Ціна туру:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                  {fmtEur(booking.total_price)} EUR
                </span>
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-700" />

              {/* Передоплата */}
              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-slate-500 dark:text-slate-400">
                    Передоплата:
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {fmtEur(booking.prepayment_amount)} EUR
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-400">
                  {booking.payment_deadline && (
                    <span className={depOverdue ? 'text-red-500' : ''}>
                      до {fmtDate(booking.payment_deadline)}
                    </span>
                  )}
                  <PayIndicator paid={depositPaid} overdue={depOverdue} />
                </div>
              </div>

              {/* Залишок */}
              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-slate-500 dark:text-slate-400">Залишок:</span>
                  <span className={`font-medium ${booking.balance_due > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {fmtEur(booking.balance_due)} EUR
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-400">
                  {booking.payment_deadline && (
                    <span className={balOverdue ? 'text-red-500' : ''}>
                      до {fmtDate(booking.payment_deadline)}
                    </span>
                  )}
                  <PayIndicator paid={balancePaid} overdue={balOverdue} />
                </div>
              </div>

              {/* Оплачено */}
              <div className="flex justify-between items-baseline pt-1 border-t border-slate-100 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Оплачено:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {fmtEur(booking.amount_paid)} EUR
                </span>
              </div>

              {/* Прогрес-бар */}
              {(() => {
                const pct = booking.total_price > 0
                  ? Math.round((booking.amount_paid / booking.total_price) * 100) : 0;
                return (
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1"><span>Оплата</span><span>{pct}%</span></div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-200'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })()}

              {/* Комісія — BR-04: тільки якщо є і user може бачити */}
              {showCommission && booking.agent_commission_amount !== undefined && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Coins size={12} /> Комісія:
                    </span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {fmtEur(booking.agent_commission_amount)} EUR
                      <span className="text-xs text-slate-400 ml-1">
                        / {Math.round((booking.agent_commission_rate ?? 0) * 100)}%
                      </span>
                    </span>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={booking.commission_status ?? 'pending'} domain="commission" size="xs" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── СТРАХУВАННЯ (ADR-003 Part 3, INS-01/INS-03) ── */}
          {tourists.some(t => t.insurance) && (
            <div id="insurance" className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700">
                <Shield size={13} className="text-slate-400" />
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Страхування</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {tourists.filter(t => t.insurance).map(t => (
                  <div key={t.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {t.last_name} {t.first_name}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {INS_TYPE_LABELS[t.insurance!.type]}
                          {t.insurance!.policy_number && ` · ${t.insurance!.policy_number}`}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${
                        t.insurance!.status === 'confirmed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800'
                      }`}>
                        {t.insurance!.status === 'confirmed'
                          ? <><CheckCircle2 size={10} /> Підтверджено</>
                          : <><Clock        size={10} /> Очікує</>}
                      </span>
                    </div>
                  </div>
                ))}
                {/* Незастраховані туристи */}
                {tourists.filter(t => !t.insurance).map(t => (
                  <div key={t.id} className="px-4 py-2.5 flex items-center gap-2">
                    <p className="text-xs text-slate-500 flex-1">{t.last_name} {t.first_name}</p>
                    <button className="text-xs text-blue-500 hover:underline">+ Додати</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── МІСЦЯ У ТУРІ ── */}
          {avail && (
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                <Users size={12} /> Місця в турі
              </p>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {avail.availableSeats === 0
                    ? <span className="text-red-500">Заповнено</span>
                    : `${avail.availableSeats} вільних`}
                </span>
                <span className="text-xs text-slate-400">{avail.bookedSeats}/{avail.totalSeats}</span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${avail.barColorClass}`} style={{ width: `${avail.occupancyPct}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingDetail;
