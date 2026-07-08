// ============================================================
// EUROTRIPS — pages/TourDetail.tsx
// Маршрут: /tours/:id   Ролі: admin, director, manager, ops, accountant
// Мінімальна версія: інфо про тур + перехід до створення бронювання.
// cost_price/margin — тільки якщо canSeeMargin (BR-04).
// ============================================================

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, Users, Tag, Plus, Lock, CheckCircle2, Search } from 'lucide-react';
import { useTour } from '../hooks/useTours';
import { useAuth } from '../hooks/useAuth';
import { TOUR_STATUS_CONFIG, STATUS_COLOR_CLASSES } from '../constants/statuses';
import { ProgressChecklist } from '../components/ops/ProgressChecklist';
import { useTourChecklist, usePatchChecklistItem, type ChecklistItemKey } from '../hooks/useTourChecklist';
import {
  useRoomStructure, useSetRoomStructure, useApproveRoomStructure, useFinalizeRoomStructure,
  type HotelBookingStructure,
} from '../hooks/useRoomStructure';
import { TimelineView } from '../components/ops/TimelineView';
import { useTourActivities, useCreateActivity, usePatchActivity } from '../hooks/useTourActivities';
import { BusSeatMap } from '../components/ops/BusSeatMap';
import { useTourSeatMap, useAssignSeat } from '../hooks/useTourSeatMap';
import { useTourTourists } from '../hooks/useTourTourists';
import { useTourTransport, useCreateTransport, usePatchTransport, type TourTransport } from '../hooks/useTourTransport';
import { useTourHotels, useCreateHotel, usePatchHotel, type TourHotelBooking } from '../hooks/useTourHotels';
import { HotelStatusBadge } from '../components/ui/HotelStatusBadge';
import { DeadlineIndicator } from '../components/ui/DeadlineIndicator';
import { useAssignRoom, useFinalizeRooming } from '../hooks/useRooming';
import { useChangeTourStatus } from '../hooks/useTours';
import { ScreenStateBanner } from '../components/ops/ScreenStateBanner';
import { RoomingBoard } from '../components/ops/RoomingBoard';
import { DocumentCard, type OpsDocument } from '../components/ops/DocumentCard';
import {
  useTourDocuments, useGenerateRoomingPdf, useGeneratePassengerList, openTourDocument,
  type TourDocument,
} from '../hooks/useTourDocuments';

const TOUR_TYPE_LABELS: Record<string, string> = {
  bus: 'Автобусний', avia: 'Авіатур', combined: 'Комбінований',
};

/** Дістає message з AppError-відповіді бекенду ({error:{code,message}}) */
function apiErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
  return anyErr?.response?.data?.error?.message ?? fallback;
}

// ─── TAB: ЧЕКЛІСТ (OPS-18) ──────────────────────────────────────

const CHECKLIST_TOTAL = 9;

const ChecklistTab: React.FC<{
  tourId: string; departureDate: string; canEdit: boolean; tourStatus: string; canChangeStatus: boolean;
}> = ({
  tourId, departureDate, canEdit, tourStatus, canChangeStatus,
}) => {
  const { data: checklist, isLoading } = useTourChecklist(tourId);
  const patchItem = usePatchChecklistItem(tourId);
  const changeStatus = useChangeTourStatus(tourId);

  if (isLoading || !checklist) {
    return <p className="text-sm text-slate-400 py-6">Завантаження чекліста…</p>;
  }

  const done = Math.round((checklist.readiness_percent / 100) * CHECKLIST_TOTAL);
  const daysToDeparture = Math.ceil((new Date(departureDate).getTime() - Date.now()) / 86_400_000);

  const banner = (() => {
    if (tourStatus === 'completed' || tourStatus === 'on_tour') {
      return {
        state: 'post-tour' as const,
        title: 'Виїзд завершено.' + (tourStatus === 'on_tour' ? ' Триває.' : ' Чекліст закрито.'),
        subtitle: `Дата: ${new Date(departureDate).toLocaleDateString('uk-UA')}.`,
      };
    }
    if (checklist.readiness_percent === 0) {
      return { state: 'empty' as const, title: `Виїзд щойно створено. 0/${CHECKLIST_TOTAL} пунктів.`, subtitle: 'Почніть підготовку.' };
    }
    if (checklist.readiness_percent === 100) {
      return { state: 'ready' as const, title: `${CHECKLIST_TOTAL}/${CHECKLIST_TOTAL} ✅ 100% готово.`, subtitle: 'Можна розпочинати виїзд.' };
    }
    return {
      state: 'partial' as const,
      title: `${done}/${CHECKLIST_TOTAL} ✅. ${daysToDeparture >= 0 ? `${daysToDeparture} дн. до виїзду.` : 'Виїзд вже мав відбутися.'}`,
      subtitle: !checklist.guides_all_confirmed ? 'Критично: гіди ще не підтверджені.' : undefined,
    };
  })();

  const canStartTour = canChangeStatus && checklist.readiness_percent === 100 && tourStatus === 'closed';

  return (
    <div>
      <ScreenStateBanner
        state={banner.state}
        title={banner.title}
        subtitle={banner.subtitle}
        action={canStartTour ? {
          label: '✈️ Розпочати виїзд',
          onClick: () => changeStatus.mutate({ status: 'on_tour' }),
          disabled: changeStatus.isPending,
        } : undefined}
      />
      <ProgressChecklist
        checklist={checklist}
        departureDate={departureDate}
        canEdit={canEdit}
        onToggle={(item: ChecklistItemKey, value: boolean) => patchItem.mutate({ item, value })}
      />
      {patchItem.isError && (
        <p className="text-xs text-brand-red mt-2">{apiErrorMessage(patchItem.error, 'Не вдалося оновити пункт чекліста.')}</p>
      )}
      {changeStatus.isError && (
        <p className="text-xs text-brand-red mt-2">{apiErrorMessage(changeStatus.error, 'Не вдалося розпочати виїзд.')}</p>
      )}
    </div>
  );
};

// ─── TAB: ПРОГРАМА (TimelineView) ──────────────────────────────

const NewActivityForm: React.FC<{ tourId: string; onDone: () => void }> = ({ tourId, onDone }) => {
  const createActivity = useCreateActivity(tourId);
  const [form, setForm] = useState({
    city: '', programType: 'Основна', activityDate: '', activityName: '', startTime: '', costEur: '',
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = () => {
    if (!form.city || !form.activityDate || !form.activityName) return;
    createActivity.mutate(
      {
        city: form.city,
        programType: form.programType,
        activityDate: form.activityDate,
        activityName: form.activityName,
        startTime: form.startTime || undefined,
        costEur: form.costEur ? Number(form.costEur) : undefined,
      },
      { onSuccess: onDone }
    );
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 mb-4 flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] text-slate-400 uppercase">Місто</span>
        <input value={form.city} onChange={set('city')} className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900 w-28" />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] text-slate-400 uppercase">Тип</span>
        <select value={form.programType} onChange={set('programType')} className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900">
          <option value="Основна">Основна</option>
          <option value="ДОП">ДОП</option>
        </select>
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] text-slate-400 uppercase">Дата</span>
        <input type="date" value={form.activityDate} onChange={set('activityDate')} className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900" />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] text-slate-400 uppercase">Час</span>
        <input type="time" value={form.startTime} onChange={set('startTime')} className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900" />
      </label>
      <label className="flex flex-col gap-0.5 flex-1 min-w-[160px]">
        <span className="text-[10px] text-slate-400 uppercase">Назва активності</span>
        <input value={form.activityName} onChange={set('activityName')} className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900 w-full" />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] text-slate-400 uppercase">Вартість €</span>
        <input type="number" min={0} value={form.costEur} onChange={set('costEur')} className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900 w-20" />
      </label>
      <button
        onClick={submit}
        disabled={createActivity.isPending}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-cyan text-white hover:bg-brand-cyan-dark disabled:opacity-40"
      >
        Додати
      </button>
      <button onClick={onDone} className="text-xs text-slate-400 hover:text-slate-600">Скасувати</button>
      {createActivity.isError && (
        <p className="w-full text-xs text-brand-red">{apiErrorMessage(createActivity.error, 'Не вдалося додати активність.')}</p>
      )}
    </div>
  );
};

const ActivitiesTab: React.FC<{ tourId: string; canEdit: boolean }> = ({ tourId, canEdit }) => {
  const { data: activities, isLoading, isError } = useTourActivities(tourId);
  const patchActivity = usePatchActivity(tourId);
  const [showForm, setShowForm] = useState(false);

  if (isLoading) return <p className="text-sm text-slate-400 py-6">Завантаження програми…</p>;
  if (isError || !activities) return <p className="text-sm text-brand-red py-6">Не вдалося завантажити програму туру.</p>;

  return (
    <div>
      {canEdit && (
        showForm ? (
          <NewActivityForm tourId={tourId} onDone={() => setShowForm(false)} />
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="mb-4 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-cyan text-white hover:bg-brand-cyan-dark"
          >
            + Додати активність
          </button>
        )
      )}
      <TimelineView
        activities={activities}
        canEdit={canEdit}
        onAssignGuide={(activityId, guideName, guidePhone) =>
          patchActivity.mutate({ activityId, payload: { guideName, guidePhone } })
        }
        onConfirm={(activityId) => patchActivity.mutate({ activityId, payload: { status: 'затверджено' } })}
      />
      {patchActivity.isError && (
        <p className="text-xs text-brand-red mt-2">{apiErrorMessage(patchActivity.error, 'Не вдалося оновити активність.')}</p>
      )}
    </div>
  );
};

// ─── TAB: ТУРИСТИ (зведений список виїзду) ──────────────────────

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Не оплачено', deposit_paid: 'Депозит', partially_paid: 'Частково',
  fully_paid: 'Оплачено', overdue: 'Прострочено',
};

const TouristsTab: React.FC<{ tourId: string }> = ({ tourId }) => {
  const [filters, setFilters] = useState({ missingPassport: false, hasDebt: false, noRoom: false });
  const [search, setSearch] = useState('');
  const { data, isLoading, isError } = useTourTourists(tourId, filters);

  if (isLoading) return <p className="text-sm text-slate-400 py-6">Завантаження туристів…</p>;
  if (isError || !data) return <p className="text-sm text-brand-red py-6">Не вдалося завантажити список туристів.</p>;

  const q = search.trim().toLowerCase();
  const rows = q
    ? data.tourists.filter((t) => `${t.last_name} ${t.first_name}`.toLowerCase().includes(q))
    : data.tourists;

  const toggle = (key: keyof typeof filters) => setFilters((f) => ({ ...f, [key]: !f[key] }));

  const filterBtn = (key: keyof typeof filters, label: string) => (
    <button
      onClick={() => toggle(key)}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
        filters[key]
          ? 'bg-brand-cyan text-white border-brand-cyan'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-cyan'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {filterBtn('missingPassport', 'Без паспорта')}
        {filterBtn('hasDebt', 'З боргом')}
        {filterBtn('noRoom', 'Без кімнати')}
        <div className="relative flex-1 min-w-[160px] max-w-xs ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук за іменем…"
            className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg pl-7 pr-3 py-1.5 bg-white dark:bg-slate-900"
          />
        </div>
      </div>

      <p className="text-xs text-slate-400 mb-2">
        {rows.length} з {data.total_confirmed} підтверджених туристів
      </p>

      {rows.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">Туристів за обраними фільтрами не знайдено.</div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 px-3">Турист</th>
                <th className="py-2 px-3">Паспорт</th>
                <th className="py-2 px-3">Дата народж.</th>
                <th className="py-2 px-3">Телефон</th>
                <th className="py-2 px-3">Бронювання</th>
                <th className="py-2 px-3">Оплата</th>
                <th className="py-2 px-3">Борг</th>
                <th className="py-2 px-3">Місце</th>
                <th className="py-2 px-3">Кімната</th>
                <th className="py-2 px-3">Харчування</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.tourist_id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">{t.last_name} {t.first_name}</td>
                  <td className={`py-2 px-3 whitespace-nowrap ${!t.passport_number ? 'text-brand-red' : 'text-slate-600 dark:text-slate-300'}`}>
                    {t.passport_number ?? 'немає'}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                    {t.date_of_birth ? new Date(t.date_of_birth).toLocaleDateString('uk-UA') : '—'}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400">{t.phone ?? '—'}</td>
                  <td className="py-2 px-3 whitespace-nowrap font-mono text-xs text-slate-400">{t.booking_number}</td>
                  <td className="py-2 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                    {PAYMENT_STATUS_LABELS[t.payment_status] ?? t.payment_status}
                  </td>
                  <td className={`py-2 px-3 whitespace-nowrap font-medium ${t.balance_due > 0 ? 'text-brand-red' : 'text-emerald-600'}`}>
                    {t.balance_due > 0 ? `${t.balance_due.toLocaleString('uk-UA')} €` : '—'}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400">{t.bus_sea_number ?? '—'}</td>
                  <td className={`py-2 px-3 whitespace-nowrap ${!t.actual_room_number ? 'text-brand-red' : 'text-slate-500 dark:text-slate-400'}`}>
                    {t.actual_room_number ?? 'немає'}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400">{t.meal_type ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── TAB: ДОКУМЕНТИ (OPS-18/19) ──────────────────────────────────

const DOC_TYPE_LABELS: Record<TourDocument['doc_type'], string> = {
  rooming_hotel: 'Румінг для готелю',
  passenger_list: 'Пасенджер-ліст',
};

const DocumentsTab: React.FC<{ tourId: string; canEdit: boolean }> = ({ tourId, canEdit }) => {
  const { data: documents, isLoading: loadingDocs } = useTourDocuments(tourId);
  const { data: hotels } = useTourHotels(tourId);
  const generateRooming = useGenerateRoomingPdf(tourId);
  const generatePassengerList = useGeneratePassengerList(tourId);

  if (loadingDocs) return <p className="text-sm text-slate-400 py-6">Завантаження документів…</p>;

  const toOpsDocument = (d: TourDocument): OpsDocument => ({
    id: d.id,
    title: d.title,
    subtitle: DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type,
    status: d.is_sent ? 'sent' : 'ready',
    generatedAt: d.generated_at,
  });

  return (
    <div>
      {canEdit && (
        <div className="flex flex-wrap gap-2 mb-4">
          {(hotels ?? []).map((hb) => (
            <button
              key={hb.id}
              onClick={() => generateRooming.mutate(hb.id)}
              disabled={generateRooming.isPending}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-brand-cyan hover:text-brand-cyan-dark disabled:opacity-40"
            >
              📄 Румінг PDF — {hb.hotel.name}
            </button>
          ))}
          <button
            onClick={() => generatePassengerList.mutate()}
            disabled={generatePassengerList.isPending}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-brand-cyan hover:text-brand-cyan-dark disabled:opacity-40"
          >
            👥 Пасенджер-ліст
          </button>
        </div>
      )}

      {(generateRooming.isError || generatePassengerList.isError) && (
        <p className="text-xs text-brand-red mb-3">
          {apiErrorMessage(generateRooming.error ?? generatePassengerList.error, 'Не вдалося згенерувати документ.')}
        </p>
      )}

      {!documents || documents.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">Документи ще не згенеровано.</div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          {documents.map((d) => (
            <DocumentCard
              key={d.id}
              document={toOpsDocument(d)}
              onView={() => openTourDocument(tourId, d.id, 'view', d.title)}
              onDownload={() => openTourDocument(tourId, d.id, 'download', d.title)}
              onSend={() => alert('Надсилання email для цього типу документа ще не реалізовано.')}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── TAB: РОЗСЕЛЕННЯ / ФАКТ-РУМІНГ (OPS-14/15/16) ────────────────

const MEAL_TYPE_OPTIONS = ['RO', 'BB', 'HB', 'FB'] as const;
const ROOM_TYPE_OPTIONS = [
  { value: 'twin', label: 'Twin' }, { value: 'double', label: 'Double' },
  { value: 'triple', label: 'Triple' }, { value: 'single', label: 'Single' },
];

const RoomingTab: React.FC<{ tourId: string; canEdit: boolean }> = ({ tourId, canEdit }) => {
  const { data: touristsData, isLoading: loadingTourists } = useTourTourists(tourId);
  const { data: hotels, isLoading: loadingHotels } = useTourHotels(tourId);
  const assignRoom = useAssignRoom(tourId);
  const finalizeRooming = useFinalizeRooming(tourId);
  const [boardView, setBoardView] = useState<'table' | 'board'>('table');

  if (loadingTourists || loadingHotels) return <p className="text-sm text-slate-400 py-6">Завантаження розселення…</p>;
  if (!touristsData || !hotels) return <p className="text-sm text-brand-red py-6">Не вдалося завантажити дані розселення.</p>;

  const alreadyFinalized = hotels.length > 0 && hotels.every((hb) => hb.final_rooming_done);
  const editable = canEdit && !alreadyFinalized;
  const withoutRoom = touristsData.tourists.filter((t) => !t.actual_room_number).length;
  const totalTourists = touristsData.tourists.length;

  const banner = (() => {
    if (totalTourists === 0) {
      return { state: 'empty' as const, title: 'Туристів ще немає.', subtitle: 'Чекайте підтверджених бронювань.' };
    }
    if (alreadyFinalized) {
      return {
        state: 'ready' as const,
        title: `${totalTourists}/${totalTourists} призначено. final_rooming_done ✅`,
        subtitle: 'Румінг зафіксовано, готель повідомлено окремо через вкладку «Документи».',
      };
    }
    if (withoutRoom > 0) {
      return {
        state: 'partial' as const,
        title: `${totalTourists - withoutRoom} з ${totalTourists} туристів призначено, ${withoutRoom} без кімнати.`,
        subtitle: '⚠️ Розселення ще не фіналізовано',
      };
    }
    return { state: 'ready' as const, title: `${totalTourists}/${totalTourists} призначено.`, subtitle: 'Можна фіналізувати розселення.' };
  })();

  return (
    <div>
      <ScreenStateBanner state={banner.state} title={banner.title} subtitle={banner.subtitle} />

      {hotels.length > 0 && totalTourists > 0 && (
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5 mb-4 w-fit">
          <button
            onClick={() => setBoardView('table')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${boardView === 'table' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500'}`}
          >
            Таблиця
          </button>
          <button
            onClick={() => setBoardView('board')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${boardView === 'board' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500'}`}
          >
            Дошка
          </button>
        </div>
      )}

      {boardView === 'board' && hotels.length > 0 && totalTourists > 0 ? (
        <RoomingBoard tourId={tourId} canEdit={editable} />
      ) : (
      <>
      {hotels.length === 0 ? (
        <p className="text-sm text-slate-400 mb-4">Додайте готель у вкладці "Готелі", щоб розпочати розселення.</p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          {hotels.map((hb) => (
            <div key={hb.id} className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5">
              <span className="text-xs text-slate-600 dark:text-slate-300">{hb.hotel.name}</span>
              {hb.final_rooming_done ? (
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle2 size={12} /> Фіналізовано</span>
              ) : canEdit ? (
                <button
                  onClick={() => finalizeRooming.mutate(hb.id)}
                  disabled={withoutRoom > 0 || finalizeRooming.isPending}
                  title={withoutRoom > 0 ? `Є ${withoutRoom} турист(ів) без кімнати` : undefined}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  <Lock size={11} /> Фіналізувати
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {withoutRoom > 0 && (
        <p className="text-xs text-brand-red mb-2">⚠ {withoutRoom} турист(ів) без призначеної кімнати</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="py-1.5 pr-2">Турист</th>
              <th className="py-1.5 pr-2">Кімната</th>
              <th className="py-1.5 pr-2">Тип</th>
              <th className="py-1.5 pr-2">Харчування</th>
            </tr>
          </thead>
          <tbody>
            {touristsData.tourists.map((t) => (
              <tr key={t.tourist_id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-1.5 pr-2 whitespace-nowrap">{t.last_name} {t.first_name}</td>
                <td className="py-1.5 pr-2">
                  <input
                    type="text"
                    disabled={!editable}
                    defaultValue={t.actual_room_number ?? ''}
                    onBlur={(e) => assignRoom.mutate({ touristId: t.tourist_id, payload: { actualRoomNumber: e.target.value || null } })}
                    className="text-sm border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 bg-white dark:bg-slate-900 disabled:opacity-50 w-20"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <select
                    disabled={!editable}
                    defaultValue={t.actual_room_type ?? ''}
                    onChange={(e) => assignRoom.mutate({ touristId: t.tourist_id, payload: { actualRoomNumber: t.actual_room_number, actualRoomType: (e.target.value || null) as any } })}
                    className="text-sm border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 bg-white dark:bg-slate-900 disabled:opacity-50"
                  >
                    <option value="">—</option>
                    {ROOM_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td className="py-1.5 pr-2">
                  <select
                    disabled={!editable}
                    defaultValue={t.meal_type ?? ''}
                    onChange={(e) => assignRoom.mutate({ touristId: t.tourist_id, payload: { actualRoomNumber: t.actual_room_number, mealType: (e.target.value || null) as any } })}
                    className="text-sm border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 bg-white dark:bg-slate-900 disabled:opacity-50"
                  >
                    <option value="">—</option>
                    {MEAL_TYPE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(assignRoom.isError || finalizeRooming.isError) && (
        <p className="text-xs text-brand-red mt-2">
          {apiErrorMessage(assignRoom.error ?? finalizeRooming.error, 'Не вдалося оновити розселення.')}
        </p>
      )}
      </>
      )}
    </div>
  );
};

// ─── TAB: ГОТЕЛІ (OPS-04/05/06) ──────────────────────────────────

const HotelRow: React.FC<{ tourId: string; hb: TourHotelBooking; canEdit: boolean }> = ({ tourId, hb, canEdit }) => {
  const patchHotel = usePatchHotel(tourId);

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{hb.hotel.name}</p>
          <p className="text-xs text-slate-400">{hb.city} · {new Date(hb.check_in_date).toLocaleDateString('uk-UA')} · {hb.nights_count} ноч.</p>
        </div>
        <HotelStatusBadge status={hb.ui_status} />
      </div>

      {hb.option_deadline && hb.ui_status === 'searching' && (
        <DeadlineIndicator date={hb.option_deadline} label="Дедлайн опції" />
      )}

      {canEdit && (
        <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {hb.ui_status === 'searching' && (
            <button
              onClick={() => patchHotel.mutate({ hotelBookingId: hb.id, payload: { confirmationStatus: 'option' } })}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-gold text-white hover:bg-brand-gold-dark"
            >
              Є опція
            </button>
          )}
          {(hb.ui_status === 'searching' || hb.ui_status === 'option') && (
            <button
              onClick={() => patchHotel.mutate({ hotelBookingId: hb.id, payload: { confirmationStatus: 'confirmed' } })}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-blue text-white hover:bg-brand-blue-dark"
            >
              Підтвердити
            </button>
          )}
          {hb.ui_status === 'confirmed' && (
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-400 uppercase">Депозит, €</span>
              <div className="flex gap-1">
                <input
                  type="number" min={0} defaultValue={hb.deposit_amount ?? 0}
                  onBlur={(e) => patchHotel.mutate({ hotelBookingId: hb.id, payload: { depositAmount: Number(e.target.value) } })}
                  className="text-sm border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 bg-white dark:bg-slate-900 w-24"
                />
                <button
                  onClick={() => patchHotel.mutate({ hotelBookingId: hb.id, payload: { depositStatus: 'paid' } })}
                  className="px-2 py-1 rounded-lg text-xs font-semibold bg-brand-cyan text-white hover:bg-brand-cyan-dark"
                >
                  Оплачено
                </button>
              </div>
            </label>
          )}
          {hb.ui_status === 'deposit_paid' && (
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-400 uppercase">Фінальна сума, €</span>
              <div className="flex gap-1">
                <input
                  type="number" min={0} id={`final-${hb.id}`}
                  className="text-sm border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 bg-white dark:bg-slate-900 w-24"
                />
                <button
                  onClick={() => {
                    const el = document.getElementById(`final-${hb.id}`) as HTMLInputElement;
                    patchHotel.mutate({ hotelBookingId: hb.id, payload: { factAmountEur: Number(el.value || 0) } });
                  }}
                  className="px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Закрити оплату
                </button>
              </div>
            </label>
          )}
        </div>
      )}
      {patchHotel.isError && (
        <p className="text-xs text-brand-red">{apiErrorMessage(patchHotel.error, 'Не вдалося оновити готель.')}</p>
      )}
    </div>
  );
};

const NewHotelForm: React.FC<{ tourId: string; onDone: () => void }> = ({ tourId, onDone }) => {
  const createHotel = useCreateHotel(tourId);
  const [form, setForm] = useState({ hotelName: '', city: '', checkInDate: '', nightsCount: '7', optionDeadline: '' });

  const submit = () => {
    if (!form.hotelName || !form.city || !form.checkInDate) return;
    createHotel.mutate(
      {
        hotelName: form.hotelName, city: form.city, checkInDate: form.checkInDate,
        nightsCount: Number(form.nightsCount) || 1,
        optionDeadline: form.optionDeadline || undefined,
      },
      { onSuccess: onDone }
    );
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 mb-4 flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] text-slate-400 uppercase">Готель</span>
        <input value={form.hotelName} onChange={(e) => setForm((f) => ({ ...f, hotelName: e.target.value }))} className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900" />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] text-slate-400 uppercase">Місто</span>
        <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900" />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] text-slate-400 uppercase">Заїзд</span>
        <input type="date" value={form.checkInDate} onChange={(e) => setForm((f) => ({ ...f, checkInDate: e.target.value }))} className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900" />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] text-slate-400 uppercase">Ночей</span>
        <input type="number" min={1} value={form.nightsCount} onChange={(e) => setForm((f) => ({ ...f, nightsCount: e.target.value }))} className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900 w-16" />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] text-slate-400 uppercase">Дедлайн опції</span>
        <input type="date" value={form.optionDeadline} onChange={(e) => setForm((f) => ({ ...f, optionDeadline: e.target.value }))} className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900" />
      </label>
      <button onClick={submit} disabled={createHotel.isPending} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-cyan text-white hover:bg-brand-cyan-dark disabled:opacity-40">
        Додати
      </button>
      <button onClick={onDone} className="text-xs text-slate-400 hover:text-slate-600">Скасувати</button>
      {createHotel.isError && (
        <p className="w-full text-xs text-brand-red">{apiErrorMessage(createHotel.error, 'Не вдалося додати готель.')}</p>
      )}
    </div>
  );
};

const HotelsTab: React.FC<{ tourId: string; canEdit: boolean; tourStatus: string }> = ({ tourId, canEdit, tourStatus }) => {
  const { data: items, isLoading, isError } = useTourHotels(tourId);
  const [showForm, setShowForm] = useState(false);

  if (isLoading) return <p className="text-sm text-slate-400 py-6">Завантаження готелів…</p>;
  if (isError || !items) return <p className="text-sm text-brand-red py-6">Не вдалося завантажити готелі.</p>;

  const confirmedCount = items.filter((hb) => hb.ui_status !== 'searching').length;
  const finalPaidCount = items.filter((hb) => hb.ui_status === 'final_paid').length;
  const urgentDeadline = items.find((hb) => {
    if (hb.ui_status !== 'searching' || !hb.option_deadline) return false;
    const days = Math.ceil((new Date(hb.option_deadline).getTime() - Date.now()) / 86_400_000);
    return days <= 3;
  });

  const banner = (() => {
    if (items.length === 0) {
      return { state: 'empty' as const, title: 'Готелі не додані.', subtitle: canEdit ? 'Додайте перший готель нижче.' : undefined };
    }
    if (tourStatus === 'completed' && finalPaidCount === items.length) {
      return { state: 'post-tour' as const, title: 'Всі готелі оплачено.', subtitle: 'Рахунки в архіві.' };
    }
    if (finalPaidCount === items.length) {
      return { state: 'ready' as const, title: `${items.length}/${items.length} готелів final_paid.`, subtitle: 'Румінг-файл можна надсилати.' };
    }
    return {
      state: 'partial' as const,
      title: `${confirmedCount} з ${items.length} підтверджено.`,
      subtitle: urgentDeadline
        ? `⚠️ Дедлайн опції «${urgentDeadline.hotel.name}» — найближчим часом!`
        : undefined,
    };
  })();

  return (
    <div>
      <ScreenStateBanner state={banner.state} title={banner.title} subtitle={banner.subtitle} />
      {canEdit && (
        showForm
          ? <NewHotelForm tourId={tourId} onDone={() => setShowForm(false)} />
          : (
            <button onClick={() => setShowForm(true)} className="mb-4 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-cyan text-white hover:bg-brand-cyan-dark">
              + Додати готель
            </button>
          )
      )}
      {items.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">Готелі для цього туру ще не додані.</div>
      ) : (
        <div className="space-y-3">
          {items.map((hb) => <HotelRow key={hb.id} tourId={tourId} hb={hb} canEdit={canEdit} />)}
        </div>
      )}
    </div>
  );
};

// ─── TAB: ТРАНСПОРТ (OPS-08/09/10) ──────────────────────────────

const TransportRow: React.FC<{ tourId: string; tb: TourTransport; canEdit: boolean }> = ({ tourId, tb, canEdit }) => {
  const patchTransport = usePatchTransport(tourId);
  const [draft, setDraft] = useState({
    carrierName: tb.carrier_name ?? '', busBrand: tb.bus_brand ?? '',
    kmGoogle: tb.km_google ?? 0, kmExtras: tb.km_extras ?? 0, ratePerKm: tb.rate_per_km ?? 0,
    fuelSurcharge: tb.fuel_surcharge ?? 0,
  });
  const editable = canEdit && tb.status === 'planned';

  const field = (key: keyof typeof draft, label: string, isText = false) => (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-400 uppercase">{label}</span>
      <input
        type={isText ? 'text' : 'number'}
        min={isText ? undefined : 0}
        disabled={!editable}
        value={draft[key]}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: isText ? e.target.value : Math.max(0, Number(e.target.value)) }))}
        className="text-sm border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 bg-white dark:bg-slate-900 disabled:opacity-50 w-24"
      />
    </label>
  );

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        {field('carrierName', 'Перевізник', true)}
        {field('busBrand', 'Марка авто', true)}
        {field('kmGoogle', 'Км (Google)')}
        {field('kmExtras', 'Км (допи)')}
        {field('ratePerKm', 'Тариф €/км')}
        {field('fuelSurcharge', 'Пальне €')}
        {editable && (
          <button
            onClick={() => patchTransport.mutate({ transportId: tb.id, payload: draft })}
            disabled={patchTransport.isPending}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-cyan text-white hover:bg-brand-cyan-dark disabled:opacity-40"
          >
            Зберегти
          </button>
        )}
        {canEdit && tb.status === 'planned' && (
          <button
            onClick={() => patchTransport.mutate({ transportId: tb.id, payload: { status: 'confirmed' } })}
            disabled={patchTransport.isPending}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-blue text-white hover:bg-brand-blue-dark disabled:opacity-40"
          >
            Підтвердити
          </button>
        )}
        {tb.status !== 'planned' && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 size={14} /> {tb.status === 'confirmed' ? 'Підтверджено' : tb.status}
          </span>
        )}
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
        <span>Базова вартість: <strong className="text-slate-700 dark:text-slate-300">{tb.base_transport_cost.toLocaleString('uk-UA')} €</strong></span>
        <span>Всього: <strong className="text-slate-700 dark:text-slate-300">{tb.total_transport_cost.toLocaleString('uk-UA')} €</strong></span>
        <span>На особу: <strong className="text-slate-700 dark:text-slate-300">{tb.cost_per_person != null ? `${tb.cost_per_person.toLocaleString('uk-UA')} €` : 'н/д'}</strong></span>
        <span>Залишок до сплати: <strong className={tb.remaining_amount > 0 ? 'text-brand-red' : 'text-emerald-600'}>{tb.remaining_amount.toLocaleString('uk-UA')} €</strong></span>
      </div>

      {canEdit && tb.status === 'confirmed' && (
        <div className="flex items-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-slate-400 uppercase">Аванс, €</span>
            <input
              type="number" min={0} defaultValue={tb.paid_advance_eur ?? 0}
              onBlur={(e) => patchTransport.mutate({ transportId: tb.id, payload: { paidAdvanceEur: Number(e.target.value) } })}
              className="text-sm border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 bg-white dark:bg-slate-900 w-24"
            />
          </label>
        </div>
      )}
    </div>
  );
};

const NewTransportForm: React.FC<{ tourId: string; onDone: () => void }> = ({ tourId, onDone }) => {
  const createTransport = useCreateTransport(tourId);
  const [form, setForm] = useState({ carrierName: '', busBrand: '', kmGoogle: '', ratePerKm: '' });

  const submit = () => {
    createTransport.mutate(
      {
        transportType: 'bus',
        carrierName: form.carrierName || undefined,
        busBrand: form.busBrand || undefined,
        kmGoogle: form.kmGoogle ? Number(form.kmGoogle) : undefined,
        ratePerKm: form.ratePerKm ? Number(form.ratePerKm) : undefined,
      },
      { onSuccess: onDone }
    );
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 mb-4 flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] text-slate-400 uppercase">Перевізник</span>
        <input value={form.carrierName} onChange={(e) => setForm((f) => ({ ...f, carrierName: e.target.value }))} className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900" />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] text-slate-400 uppercase">Марка авто</span>
        <input value={form.busBrand} onChange={(e) => setForm((f) => ({ ...f, busBrand: e.target.value }))} className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900" />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] text-slate-400 uppercase">Км (Google)</span>
        <input type="number" min={0} value={form.kmGoogle} onChange={(e) => setForm((f) => ({ ...f, kmGoogle: e.target.value }))} className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900 w-24" />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] text-slate-400 uppercase">Тариф €/км</span>
        <input type="number" min={0} value={form.ratePerKm} onChange={(e) => setForm((f) => ({ ...f, ratePerKm: e.target.value }))} className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900 w-24" />
      </label>
      <button onClick={submit} disabled={createTransport.isPending} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-cyan text-white hover:bg-brand-cyan-dark disabled:opacity-40">
        Додати
      </button>
      <button onClick={onDone} className="text-xs text-slate-400 hover:text-slate-600">Скасувати</button>
      {createTransport.isError && (
        <p className="w-full text-xs text-brand-red">{apiErrorMessage(createTransport.error, 'Не вдалося додати транспорт.')}</p>
      )}
    </div>
  );
};

const TransportTab: React.FC<{ tourId: string; canEdit: boolean }> = ({ tourId, canEdit }) => {
  const { data: items, isLoading, isError } = useTourTransport(tourId);
  const [showForm, setShowForm] = useState(false);

  if (isLoading) return <p className="text-sm text-slate-400 py-6">Завантаження транспорту…</p>;
  if (isError || !items) return <p className="text-sm text-brand-red py-6">Не вдалося завантажити транспорт.</p>;

  return (
    <div>
      {canEdit && (
        showForm
          ? <NewTransportForm tourId={tourId} onDone={() => setShowForm(false)} />
          : (
            <button onClick={() => setShowForm(true)} className="mb-4 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-cyan text-white hover:bg-brand-cyan-dark">
              + Додати перевізника
            </button>
          )
      )}
      {items.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">Транспорт для цього туру ще не додано.</div>
      ) : (
        <div className="space-y-3">
          {items.map((tb) => <TransportRow key={tb.id} tourId={tourId} tb={tb} canEdit={canEdit} />)}
        </div>
      )}
    </div>
  );
};

// ─── TAB: РОЗСАДКА (OPS-17) ─────────────────────────────────────

const SeatingTab: React.FC<{ tourId: string; canEdit: boolean }> = ({ tourId, canEdit }) => {
  const { data: seatMap, isLoading, isError } = useTourSeatMap(tourId);
  const { data: touristsData } = useTourTourists(tourId);
  const assignSeat = useAssignSeat(tourId);
  const [selectedTouristId, setSelectedTouristId] = useState<string>('');

  if (isLoading) return <p className="text-sm text-slate-400 py-6">Завантаження розсадки…</p>;
  if (isError || !seatMap) return <p className="text-sm text-brand-red py-6">Не вдалося завантажити розсадку.</p>;

  const unassigned = (touristsData?.tourists ?? []).filter((t) => !t.bus_sea_number);

  return (
    <div>
      {canEdit && (
        <div className="flex items-center gap-2 mb-4">
          <select
            value={selectedTouristId}
            onChange={(e) => setSelectedTouristId(e.target.value)}
            className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900"
          >
            <option value="">— Оберіть туриста без місця ({unassigned.length}) —</option>
            {unassigned.map((t) => (
              <option key={t.tourist_id} value={t.tourist_id}>{t.last_name} {t.first_name}</option>
            ))}
          </select>
          <span className="text-xs text-slate-400">Оберіть туриста, потім клікніть вільне місце</span>
        </div>
      )}

      <BusSeatMap
        seats={seatMap.seats.map((s) => ({
          seatNumber: s.seat_number,
          isOccupied: s.is_occupied,
          touristName: s.tourist_name,
        }))}
        onSeatClick={(seatNumber) => {
          if (!canEdit || !selectedTouristId) return;
          assignSeat.mutate({ touristId: selectedTouristId, seatNumber }, { onSuccess: () => setSelectedTouristId('') });
        }}
      />
      {assignSeat.isError && (
        <p className="text-xs text-brand-red mt-2">{apiErrorMessage(assignSeat.error, 'Не вдалося призначити місце.')}</p>
      )}
    </div>
  );
};

// ─── TAB: СТРУКТУРА НОМЕРІВ (BR-09/10/OPS-01) ──────────────────

const STRUCTURE_STATUS_LABELS: Record<HotelBookingStructure['structure_status'], string> = {
  draft: 'Чернетка', approved: 'Затверджено', final: 'Фінал',
};

const RoomStructureRow: React.FC<{
  hb: HotelBookingStructure;
  totalSeats: number;
  canEdit: boolean;
  canApprove: boolean;
  canFinalize: boolean;
}> = ({ hb, totalSeats, canEdit, canApprove, canFinalize }) => {
  const { id: tourId } = useParams<{ id: string }>();
  const [draft, setDraft] = useState({
    plannedTwin: hb.planned_twin, plannedDouble: hb.planned_double,
    plannedTriple: hb.planned_triple, plannedSingle: hb.planned_single,
  });
  const setStructure = useSetRoomStructure(tourId ?? '');
  const approve = useApproveRoomStructure(tourId ?? '');
  const finalize = useFinalizeRoomStructure(tourId ?? '');

  const editable = canEdit && hb.structure_status === 'draft';
  const capacity = draft.plannedTwin * 2 + draft.plannedDouble * 2 + draft.plannedTriple * 3 + draft.plannedSingle;
  const overCapacity = capacity > totalSeats;

  const field = (key: keyof typeof draft, label: string) => (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-400 uppercase">{label}</span>
      <input
        type="number"
        min={0}
        disabled={!editable}
        value={draft[key]}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: Math.max(0, Number(e.target.value)) }))}
        className="w-16 text-sm border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 bg-white dark:bg-slate-900 disabled:opacity-50"
      />
    </label>
  );

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 flex flex-wrap items-end gap-3">
      <div className="min-w-[140px] flex-1">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{hb.hotel_name}</p>
        <p className="text-xs text-slate-400">{hb.city} · {new Date(hb.check_in_date).toLocaleDateString('uk-UA')}</p>
        <p className="text-xs mt-1">
          <span className={overCapacity ? 'text-brand-red font-medium' : 'text-slate-500'}>
            Місткість: {capacity} / {totalSeats}
          </span>
          {' · '}
          <span className="text-slate-400">{STRUCTURE_STATUS_LABELS[hb.structure_status]}</span>
        </p>
      </div>

      {field('plannedTwin', 'Twin')}
      {field('plannedDouble', 'Double')}
      {field('plannedTriple', 'Triple')}
      {field('plannedSingle', 'Single')}

      <div className="flex items-center gap-2">
        {editable && (
          <button
            onClick={() => setStructure.mutate({ hotelBookingId: hb.id, ...draft })}
            disabled={setStructure.isPending || overCapacity}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-cyan text-white hover:bg-brand-cyan-dark disabled:opacity-40 transition-colors"
          >
            Зберегти
          </button>
        )}
        {canApprove && hb.structure_status === 'draft' && (
          <button
            onClick={() => approve.mutate(hb.id)}
            disabled={approve.isPending}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-blue text-white hover:bg-brand-blue-dark disabled:opacity-40 transition-colors"
          >
            Затвердити
          </button>
        )}
        {canFinalize && hb.structure_status === 'approved' && (
          <button
            onClick={() => finalize.mutate(hb.id)}
            disabled={finalize.isPending}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors"
          >
            <Lock size={12} /> Фіналізувати
          </button>
        )}
        {hb.structure_status === 'final' && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 size={14} /> Закрито
          </span>
        )}
      </div>

      {(setStructure.isError || approve.isError || finalize.isError) && (
        <p className="w-full text-xs text-brand-red">
          {apiErrorMessage(setStructure.error ?? approve.error ?? finalize.error, 'Помилка збереження структури.')}
        </p>
      )}
    </div>
  );
};

const RoomStructureTab: React.FC<{ tourId: string; canEdit: boolean; canApprove: boolean }> = ({
  tourId, canEdit, canApprove,
}) => {
  const { data, isLoading, isError } = useRoomStructure(tourId);

  if (isLoading) return <p className="text-sm text-slate-400 py-6">Завантаження структури…</p>;
  if (isError || !data) return <p className="text-sm text-brand-red py-6">Не вдалося завантажити структуру номерів.</p>;

  if (data.hotel_bookings.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400 text-sm">
        Готелі для цього туру ще не додані. Структуру номерів можна внести після додавання готелю.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.hotel_bookings.map((hb) => (
        <RoomStructureRow
          key={hb.id}
          hb={hb}
          totalSeats={data.total_seats}
          canEdit={canEdit}
          canApprove={canApprove}
          canFinalize={canEdit}
        />
      ))}
    </div>
  );
};

const TourDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canSeeMargin, isOpsManager, isAdmin, isDirector, isManager, isAccountant } = useAuth();
  const { data: tour, isLoading, isError } = useTour(id ?? '');
  const [tab, setTab] = useState<'info' | 'checklist' | 'rooming' | 'roomAssignment' | 'activities' | 'seating' | 'transport' | 'hotels' | 'documents' | 'tourists'>('info');

  const isInternal = isOpsManager || isAdmin || isDirector || isManager || isAccountant;
  const canEditStructure = isOpsManager || isAdmin;
  const canApproveStructure = isAdmin || isDirector;
  const canChangeStatus = isOpsManager || isAdmin || isDirector;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-brand-cyan">
        <div className="h-8 w-8 rounded-full border-2 border-brand-cyan border-t-transparent animate-spin mr-3" />
        <span className="text-sm text-slate-500 dark:text-slate-400">Завантаження туру…</span>
      </div>
    );
  }

  if (isError || !tour) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-sm text-brand-red">Тур не знайдено.</p>
        <button
          onClick={() => navigate('/tours')}
          className="px-4 py-2 rounded-pill text-sm font-semibold bg-brand-red text-white hover:bg-brand-red-dark transition-colors"
        >
          До каталогу турів
        </button>
      </div>
    );
  }

  const cfg = TOUR_STATUS_CONFIG[tour.status];
  const cc  = cfg ? STATUS_COLOR_CLASSES[cfg.colorVariant] : undefined;
  const occupied = tour.total_seats - tour.available_seats;
  const occPct   = tour.total_seats > 0 ? Math.round((occupied / tour.total_seats) * 100) : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/tours')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-4"
      >
        <ArrowLeft size={15} aria-hidden="true" /> До каталогу турів
      </button>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <code className="text-xs text-slate-400 font-mono">{tour.code}</code>
            {cfg && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cc?.badge} ${cfg.isPulsing ? 'animate-pulse' : ''}`}>
                {cfg.label}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{tour.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
            <MapPin size={13} aria-hidden="true" /> {tour.direction}
            {tour.countries?.length > 0 && ` · ${tour.countries.join(', ')}`}
          </p>
        </div>

        {isInternal && (
          <div className="flex border-b border-slate-100 dark:border-slate-700 px-6">
            {([
              { key: 'info' as const, label: 'Інфо' },
              { key: 'checklist' as const, label: 'Чекліст' },
              { key: 'tourists' as const, label: 'Туристи' },
              { key: 'rooming' as const, label: 'Структура номерів' },
              { key: 'roomAssignment' as const, label: 'Розселення' },
              { key: 'activities' as const, label: 'Програма' },
              { key: 'seating' as const, label: 'Розсадка' },
              { key: 'transport' as const, label: 'Транспорт' },
              { key: 'hotels' as const, label: 'Готелі' },
              { key: 'documents' as const, label: 'Документи' },
            ]).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-brand-cyan text-brand-cyan-dark dark:text-brand-cyan'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {tab === 'checklist' && (
          <div className="p-6">
            <ChecklistTab
              tourId={tour.id}
              departureDate={tour.departure_date}
              canEdit={canEditStructure}
              tourStatus={tour.status}
              canChangeStatus={canChangeStatus}
            />
          </div>
        )}

        {tab === 'tourists' && (
          <div className="p-6">
            <TouristsTab tourId={tour.id} />
          </div>
        )}

        {tab === 'rooming' && (
          <div className="p-6">
            <RoomStructureTab tourId={tour.id} canEdit={canEditStructure} canApprove={canApproveStructure} />
          </div>
        )}

        {tab === 'roomAssignment' && (
          <div className="p-6">
            <RoomingTab tourId={tour.id} canEdit={canEditStructure} />
          </div>
        )}

        {tab === 'activities' && (
          <div className="p-6">
            <ActivitiesTab tourId={tour.id} canEdit={canEditStructure} />
          </div>
        )}

        {tab === 'seating' && (
          <div className="p-6">
            <SeatingTab tourId={tour.id} canEdit={canEditStructure} />
          </div>
        )}

        {tab === 'transport' && (
          <div className="p-6">
            <TransportTab tourId={tour.id} canEdit={canEditStructure} />
          </div>
        )}

        {tab === 'hotels' && (
          <div className="p-6">
            <HotelsTab tourId={tour.id} canEdit={canEditStructure} tourStatus={tour.status} />
          </div>
        )}

        {tab === 'documents' && (
          <div className="p-6">
            <DocumentsTab tourId={tour.id} canEdit={canEditStructure} />
          </div>
        )}

        {tab === 'info' && (
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Calendar size={12} aria-hidden="true" /> Дати</p>
            <p className="text-sm text-slate-800 dark:text-slate-200">
              {new Date(tour.departure_date).toLocaleDateString('uk-UA')} — {new Date(tour.return_date).toLocaleDateString('uk-UA')}
              {' '}({tour.duration_days} д.)
            </p>
            <p className="text-xs text-slate-400 mt-1">{tour.departure_city} → {tour.arrival_city ?? tour.departure_city}</p>
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-1">Тип туру</p>
            <p className="text-sm text-slate-800 dark:text-slate-200">{TOUR_TYPE_LABELS[tour.tour_type] ?? tour.tour_type}</p>
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Users size={12} aria-hidden="true" /> Місця</p>
            <p className="text-sm text-slate-800 dark:text-slate-200">{tour.available_seats} вільно з {tour.total_seats}</p>
            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-1.5 max-w-[160px]">
              <div
                className={`h-full rounded-full ${occPct >= 95 ? 'bg-brand-red' : occPct >= 80 ? 'bg-brand-gold' : 'bg-brand-cyan'}`}
                style={{ width: `${occPct}%` }}
              />
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-1">Ціна</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {tour.base_price.toLocaleString('uk-UA')} {tour.currency}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              {(tour.agent_commission_pct * 100).toFixed(0)}% комісія агента
            </p>
            {canSeeMargin && tour.cost_price != null && (
              <p className="text-xs text-slate-400 mt-0.5">
                Собівартість: {tour.cost_price.toLocaleString('uk-UA')} {tour.currency}
                {' '}· Маржа: {(tour.base_price - tour.cost_price).toLocaleString('uk-UA')} {tour.currency}
              </p>
            )}
          </div>

          {tour.included && (
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-400 mb-1">Включено</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{tour.included}</p>
            </div>
          )}

          {tour.not_included && (
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-400 mb-1">Не включено</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{tour.not_included}</p>
            </div>
          )}

          {tour.tags?.length > 0 && (
            <div className="sm:col-span-2 flex items-center gap-1.5 flex-wrap">
              <Tag size={12} className="text-slate-400" aria-hidden="true" />
              {tour.tags.map((t) => (
                <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        )}

        <div className="p-6 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={() => navigate(`/bookings/new?tour=${tour.id}`)}
            disabled={tour.available_seats === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-pill text-sm font-semibold bg-brand-red text-white hover:bg-brand-red-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={15} aria-hidden="true" />
            {tour.available_seats === 0 ? 'Місць немає' : 'Забронювати'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TourDetailPage;
