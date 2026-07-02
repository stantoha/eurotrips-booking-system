// ============================================================
// EUROTRIPS — pages/BookingNew.tsx
// Маршрут: /bookings/new   Ролі: admin, manager, agent (як POST /bookings)
// Мінімальна форма створення бронювання.
// Приймає ?tour=<id> для попереднього вибору туру.
// ============================================================

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, UserPlus, AlertCircle } from 'lucide-react';
import { useTours } from '../hooks/useTours';
import { useTouristSearch, useCreateTourist } from '../hooks/useTourists';
import { useAgents } from '../hooks/useAgents';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import type { Tourist, BookingType } from '../types';

const BOOKING_TYPES: { value: BookingType; label: string }[] = [
  { value: 'direct',     label: 'Пряме' },
  { value: 'agent',      label: 'Через агента' },
  { value: 'corporate',  label: 'Корпоративне' },
  { value: 'group',      label: 'Групове' },
];

const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';

const BookingNewPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { isAgent, user } = useAuth();

  const { data: toursData } = useTours();
  const bookableStatuses = new Set(['open', 'active', 'almost_full']);
  const tours = (toursData?.data ?? []).filter(
    (t) => bookableStatuses.has(t.status) && t.available_seats > 0,
  );

  const [tourId, setTourId] = useState(params.get('tour') ?? '');
  const [personsCount, setPersonsCount] = useState(1);
  const [bookingType, setBookingType] = useState<BookingType>(isAgent ? 'agent' : 'direct');
  const [agentId, setAgentId] = useState('');
  const [comment, setComment] = useState('');

  // ── Турист: пошук існуючого або створення нового ────────────
  const [touristQuery, setTouristQuery] = useState('');
  const [selectedTourist, setSelectedTourist] = useState<Tourist | null>(null);
  const [showNewTourist, setShowNewTourist] = useState(false);
  const [newTourist, setNewTourist] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  const { data: touristResults, isLoading: searchingTourists } = useTouristSearch(touristQuery);
  const createTourist = useCreateTourist();
  const { data: agents } = useAgents();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTour = useMemo(() => tours.find((t) => t.id === tourId), [tours, tourId]);

  // Авто-підстановка суми при виборі туру/кількості осіб
  const [totalAmount, setTotalAmount] = useState<number | ''>('');
  const [depositAmount, setDepositAmount] = useState<number | ''>('');

  useEffect(() => {
    if (selectedTour) {
      setTotalAmount(selectedTour.base_price * personsCount);
      setDepositAmount((selectedTour.deposit_amount ?? selectedTour.base_price * 0.2) * personsCount);
    }
  }, [selectedTour, personsCount]);

  const handleCreateTourist = async () => {
    if (!newTourist.firstName || !newTourist.lastName) return;
    try {
      const created = await createTourist.mutateAsync({
        firstName: newTourist.firstName,
        lastName:  newTourist.lastName,
        email:     newTourist.email || undefined,
        phone:     newTourist.phone || undefined,
      });
      setSelectedTourist(created);
      setShowNewTourist(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося створити туриста');
    }
  };

  const canSubmit = tourId && selectedTourist && personsCount > 0 && totalAmount && depositAmount
    && (bookingType !== 'agent' || agentId || isAgent);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post('/bookings', {
        tourId,
        bookingType,
        contactTouristId: selectedTourist!.id,
        agentId: bookingType === 'agent' ? (isAgent ? user?.agent_id : agentId) || undefined : undefined,
        personsCount,
        totalAmount: Number(totalAmount),
        depositAmount: Number(depositAmount),
        comment: comment || undefined,
      });
      const created = data as { data: { id: string } };
      navigate(`/bookings/${created.data.id}`);
    } catch (err) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr.response?.data?.error?.message ?? 'Не вдалося створити бронювання');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/bookings')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-4"
      >
        <ArrowLeft size={15} aria-hidden="true" /> До бронювань
      </button>

      <h1 className="text-xl font-medium text-slate-900 dark:text-slate-100 mb-6">Нове бронювання</h1>

      {error && (
        <div className="flex items-start gap-2 p-3 mb-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          <AlertCircle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="space-y-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">

        {/* Тур */}
        <div>
          <label className={labelClass}>Тур</label>
          <select value={tourId} onChange={(e) => setTourId(e.target.value)} className={inputClass}>
            <option value="">Оберіть тур…</option>
            {tours.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.name} ({new Date(t.departure_date).toLocaleDateString('uk-UA')}) · {t.available_seats} місць
              </option>
            ))}
          </select>
        </div>

        {/* Кількість осіб */}
        <div>
          <label className={labelClass}>Кількість осіб</label>
          <input
            type="number" min={1} max={selectedTour?.available_seats ?? 200}
            value={personsCount}
            onChange={(e) => setPersonsCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className={inputClass}
          />
          {selectedTour && personsCount > selectedTour.available_seats && (
            <p className="text-xs text-brand-red mt-1">Доступно лише {selectedTour.available_seats} місць</p>
          )}
        </div>

        {/* Турист (контактна особа) */}
        <div>
          <label className={labelClass}>Турист (контактна особа)</label>
          {selectedTourist ? (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <span className="text-sm text-slate-800 dark:text-slate-200">
                {selectedTourist.first_name} {selectedTourist.last_name}
                {selectedTourist.phone && <span className="text-slate-400"> · {selectedTourist.phone}</span>}
              </span>
              <button onClick={() => setSelectedTourist(null)} className="text-xs text-blue-500 hover:underline">Змінити</button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  type="text" value={touristQuery}
                  onChange={(e) => setTouristQuery(e.target.value)}
                  placeholder="Ім'я, email або телефон (мін. 2 символи)…"
                  className={`${inputClass} pl-9`}
                />
              </div>
              {searchingTourists && <p className="text-xs text-slate-400 mt-1">Пошук…</p>}
              {touristResults && touristResults.length > 0 && (
                <div className="mt-1 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  {touristResults.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTourist(t); setTouristQuery(''); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-700 last:border-0"
                    >
                      {t.first_name} {t.last_name} {t.phone && <span className="text-slate-400">· {t.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
              {touristQuery.trim().length >= 2 && touristResults?.length === 0 && !searchingTourists && (
                <p className="text-xs text-slate-400 mt-1">Нічого не знайдено.</p>
              )}

              <button
                type="button"
                onClick={() => setShowNewTourist((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-blue-500 hover:underline mt-2"
              >
                <UserPlus size={12} aria-hidden="true" /> Новий турист
              </button>

              {showNewTourist && (
                <div className="mt-2 grid grid-cols-2 gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <input placeholder="Ім'я" value={newTourist.firstName}
                    onChange={(e) => setNewTourist((s) => ({ ...s, firstName: e.target.value }))} className={inputClass} />
                  <input placeholder="Прізвище" value={newTourist.lastName}
                    onChange={(e) => setNewTourist((s) => ({ ...s, lastName: e.target.value }))} className={inputClass} />
                  <input placeholder="Телефон" value={newTourist.phone}
                    onChange={(e) => setNewTourist((s) => ({ ...s, phone: e.target.value }))} className={inputClass} />
                  <input placeholder="Email" value={newTourist.email}
                    onChange={(e) => setNewTourist((s) => ({ ...s, email: e.target.value }))} className={inputClass} />
                  <button
                    type="button"
                    onClick={handleCreateTourist}
                    disabled={!newTourist.firstName || !newTourist.lastName || createTourist.isPending}
                    className="col-span-2 py-2 rounded-pill text-xs font-semibold bg-brand-red text-white hover:bg-brand-red-dark disabled:opacity-40 transition-colors"
                  >
                    {createTourist.isPending ? 'Створюємо…' : 'Створити туриста'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Тип бронювання */}
        {!isAgent && (
          <div>
            <label className={labelClass}>Тип бронювання</label>
            <select value={bookingType} onChange={(e) => setBookingType(e.target.value as BookingType)} className={inputClass}>
              {BOOKING_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}

        {bookingType === 'agent' && !isAgent && (
          <div>
            <label className={labelClass}>Агент</label>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className={inputClass}>
              <option value="">Оберіть агента…</option>
              {agents?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.agency_name} — {a.user.first_name} {a.user.last_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Суми */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Загальна сума (EUR)</label>
            <input
              type="number" min={0} step={1}
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value === '' ? '' : Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Депозит (EUR)</label>
            <input
              type="number" min={0} step={1}
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value === '' ? '' : Number(e.target.value))}
              className={inputClass}
            />
          </div>
        </div>

        {/* Коментар */}
        <div>
          <label className={labelClass}>Коментар</label>
          <textarea
            value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
            className={inputClass}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full py-2.5 rounded-pill text-sm font-semibold bg-brand-red text-white hover:bg-brand-red-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Створюємо…' : 'Створити бронювання'}
        </button>
      </div>
    </div>
  );
};

export default BookingNewPage;
