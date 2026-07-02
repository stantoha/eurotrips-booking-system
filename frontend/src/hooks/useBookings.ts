// ============================================================
// EUROTRIPS — hooks/useBookings.ts  (skeleton v0.1)
//
// ⏸  API НЕ ГОТОВИЙ — цей хук використовує MOCK_BOOKINGS.
//    TODO: після появи GET /api/v1/bookings розкоментувати
//    fetchBookings() і видалити MOCK fallback.
//
// Підтверджені shapes від Backend/QA (2025-06-13):
//   • PATCH /bookings/:id/status → 422 якщо перехід не в BR-06
//   • POST  /bookings/:id/cancel → штраф з cancellation_policy (BR-08)
//
// Залежності:
//   • bookingTransitions.ts  — BR-06 клієнтська валідація
//   • invalidateTourAvailability — після зміни статусу
// ============================================================

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api }                from '../services/api';
import { MOCK_BOOKINGS }      from '../mocks';
import {
  isTransitionAllowed,
  getAllowedTransitions,
} from '../constants/bookingTransitions';
import { invalidateTourAvailability } from './useTourAvailability';
import type { Booking, BookingStatus } from '../types';

// ─── DTOs ─────────────────────────────────────────────────────

export interface BookingListQueryDto {
  status?:      BookingStatus | BookingStatus[];
  agent_id?:    string;
  manager_id?:  string;
  tour_id?:     string;
  /** ISO date — бронювання від цієї дати */
  date_from?:   string;
  date_to?:     string;
  search?:      string;     // booking_number або contact_name
  page?:        number;
  limit?:       number;
}

export interface BookingListMeta {
  total: number;
  page:  number;
  limit: number;
  pages: number;
}

// PATCH /bookings/:id/status
export interface UpdateBookingStatusDto {
  status:  BookingStatus;
  comment?: string;
}

// POST /bookings/:id/cancel  (BR-08)
export interface CancelBookingDto {
  reason:       string;
  initiated_by: 'client' | 'operator';  // впливає на штраф BR-08
  comment?:     string;
}

export interface CancelBookingResult {
  booking:          Booking;
  penalty_amount:   number;    // EUR — штраф відповідно до cancellation_policy
  refund_amount:    number;    // EUR — сума до повернення клієнту
  penalty_pct:      number;    // % від total_price
  policy_applied:   string;    // назва cancellation_policy
}

// ─── QUERY KEYS ───────────────────────────────────────────────

export const bookingKeys = {
  all:    ()            => ['bookings']                as const,
  lists:  ()            => ['bookings', 'list']        as const,
  list:   (f?: BookingListQueryDto) =>
            ['bookings', 'list', f ?? {}]              as const,
  detail: (id: string)  => ['bookings', 'detail', id] as const,
};

// ─── RAW API SHAPES ───────────────────────────────────────────
// Реальна відповідь бекенду відрізняється від Booking (вкладені
// tour/contact_tourist/agent, інші назви полів) — мапимо в одному місці.

interface RawBookingListItem {
  id:              string;
  booking_number:  string;
  booking_type:    string;
  persons_count:   number;
  total_amount:    number;
  deposit_paid:    number;
  balance_paid:    number;
  payment_status:  string;
  status:          string;
  agent_id:        string | null;
  manager_id:      string;
  created_at:      string;
  updated_at:      string;
  tour:            { id: string; code: string; name: string; departure_date: string };
  contact_tourist: { id: string; first_name: string; last_name: string; phone?: string };
  agent:           { id: string; agency_name: string } | null;
}

interface RawBookingDetail extends RawBookingListItem {
  deposit_amount?:          number;
  balance_amount?:          number;
  balance_deadline?:        string;
  deposit_deadline?:        string;
  currency?:                string;
  agent_commission_rate?:   number;
  agent_commission_amount?: number;
  commission_status?:       string;
  comment?:                 string;
  manager?: { id: string; first_name: string; last_name: string };
}

function mapListItem(raw: RawBookingListItem): Booking {
  const amountPaid = raw.deposit_paid + raw.balance_paid;
  return {
    id:                  raw.id,
    booking_number:      raw.booking_number,
    tour_id:             raw.tour.id,
    tour_name:           raw.tour.name,
    tour_date:           raw.tour.departure_date,
    booking_type:        raw.booking_type as Booking['booking_type'],
    pax_count:           raw.persons_count,
    contact_tourist_id:  raw.contact_tourist.id,
    contact_name:        `${raw.contact_tourist.first_name} ${raw.contact_tourist.last_name}`,
    contact_phone:       raw.contact_tourist.phone,
    manager_id:          raw.manager_id,
    manager_name:        '—', // список не повертає ім'я менеджера, лише manager_id
    agent_id:            raw.agent_id ?? undefined,
    agent_name:          raw.agent?.agency_name,
    total_price:         raw.total_amount,
    currency:            'EUR',
    prepayment_rate:     0,
    prepayment_amount:   raw.deposit_paid,
    amount_paid:         amountPaid,
    balance_due:         raw.total_amount - amountPaid,
    payment_deadline:    '',
    payment_status:      raw.payment_status as Booking['payment_status'],
    status:              raw.status as BookingStatus,
    created_at:          raw.created_at,
    updated_at:          raw.updated_at,
  };
}

function mapDetail(raw: RawBookingDetail): Booking {
  const amountPaid = raw.deposit_paid + raw.balance_paid;
  return {
    ...mapListItem(raw),
    manager_name:             raw.manager ? `${raw.manager.first_name} ${raw.manager.last_name}` : '—',
    currency:                 raw.currency ?? 'EUR',
    prepayment_amount:        raw.deposit_paid,
    amount_paid:              amountPaid,
    balance_due:              (raw.balance_amount ?? raw.total_amount) - amountPaid,
    payment_deadline:         raw.balance_deadline ?? raw.deposit_deadline ?? '',
    agent_commission_rate:    raw.agent_commission_rate,
    agent_commission_amount:  raw.agent_commission_amount,
    commission_status:        raw.commission_status as Booking['commission_status'],
    notes:                    raw.comment,
  };
}

// ─── FETCHER ──────────────────────────────────────────────────

async function fetchBookings(
  params?: BookingListQueryDto,
): Promise<{ data: Booking[]; meta: BookingListMeta }> {
  const { data } = await api.get<{ data: RawBookingListItem[]; meta: BookingListMeta }>(
    '/bookings', { params },
  );
  return { data: data.data.map(mapListItem), meta: data.meta };
}

/** Dev fallback — повертає відфільтровані MOCK_BOOKINGS коли API недоступний */

/** Тимчасовий in-memory фільтр поверх MOCK_BOOKINGS */
function filterMocks(params?: BookingListQueryDto): { data: Booking[]; meta: BookingListMeta } {
  const q = params?.search?.toLowerCase().trim() ?? '';
  let result = MOCK_BOOKINGS.filter((b: Booking) => {
    if (params?.status) {
      const statuses = Array.isArray(params.status)
        ? params.status : [params.status];
      if (!statuses.includes(b.status)) return false;
    }
    if (params?.agent_id && b.agent_id !== params.agent_id) return false;
    if (q && !b.booking_number.toLowerCase().includes(q)
          && !b.contact_name.toLowerCase().includes(q)
          && !b.tour_name.toLowerCase().includes(q)) return false;
    return true;
  });
  const page  = params?.page  ?? 1;
  const limit = params?.limit ?? 10;
  const total = result.length;
  result = result.slice((page - 1) * limit, page * limit);
  return { data: result, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
}

// ─── HOOKS ────────────────────────────────────────────────────

/**
 * Список бронювань з фільтрами.
 *
 * ⏸ Поки API не готовий — повертає дані з MOCK_BOOKINGS.
 *    Коли API з'явиться: замінити queryFn на fetchBookings(filters).
 *
 * @example
 * // Всі бронювання в очікуванні оплати
 * const { data } = useBookings({ status: 'awaiting_payment' });
 *
 * @example
 * // Бронювання конкретного агента з пошуком
 * const { data } = useBookings({ agent_id: user.agent_id, search: 'ET-2025' });
 */
export function useBookings(
  filters?: BookingListQueryDto,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey:        bookingKeys.list(filters),
    // ✅ Реальний API. При помилці — тихий fallback на моки (тільки в DEV).
    queryFn: async () => {
      try {
        return await fetchBookings(filters);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[useBookings] API unavailable → mock fallback', err);
          return filterMocks(filters);
        }
        throw err;
      }
    },
    enabled:         options?.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime:       30_000,
  });
}

/**
 * Одне бронювання за ID.
 *
 * @example
 * const { data: booking } = useBooking(bookingId);
 */
export function useBooking(
  id: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: bookingKeys.detail(id ?? ''),
    queryFn: async () => {
      try {
        const { data } = await api.get<{ data: RawBookingDetail }>(`/bookings/${id}`);
        return mapDetail(data.data);
      } catch (err) {
        if (import.meta.env.DEV) {
          const found = MOCK_BOOKINGS.find(b => b.id === id);
          if (found) return found;
        }
        throw err;
      }
    },
    enabled:   !!id && (options?.enabled ?? true),
    staleTime: 60_000,
  });
}

// ─── MUTATIONS ────────────────────────────────────────────────

/**
 * Змінити статус бронювання.
 *
 * Клієнтська валідація BR-06 перед відправкою на сервер:
 * → якщо перехід неможливий — кидаємо помилку без мережевого запиту.
 * Сервер все одно перевіряє і повертає 422 при неможливому переході.
 *
 * @example
 * const mutation = useUpdateBookingStatus();
 * mutation.mutate({ bookingId, status: 'confirmed' });
 */
export function useUpdateBookingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      bookingId:    string;
      currentStatus: BookingStatus;
      dto:           UpdateBookingStatusDto;
    }) => {
      // BR-06 клієнтська перевірка (уникнути зайвого roundtrip)
      if (!isTransitionAllowed(payload.currentStatus, payload.dto.status)) {
        const allowed = getAllowedTransitions(payload.currentStatus);
        throw new Error(
          `Перехід ${payload.currentStatus} → ${payload.dto.status} неможливий. ` +
          `Дозволені: ${allowed.join(', ')}`
        );
      }
      const { data } = await api.patch<{ data: Booking }>(
        `/bookings/${payload.bookingId}/status`,
        payload.dto,
      );
      return data.data;
    },
    onSuccess: (updated) => {
      // Оновлюємо кеш бронювання
      qc.setQueryData(bookingKeys.detail(updated.id), updated);
      // Інвалідуємо список (кількість в статусах змінилась)
      qc.invalidateQueries({ queryKey: bookingKeys.lists() });
      // Інвалідуємо availability туру (available_seats міг змінитись)
      if (updated.tour_id) {
        invalidateTourAvailability(updated.tour_id);
      }
    },
  });
}

/**
 * Скасувати бронювання (BR-08: штрафна шкала).
 *
 * Сервер розраховує штраф на основі cancellation_policy туру
 * і кількості днів до виїзду.
 *
 * Ініціатор = 'operator' → ОБОВ'ЯЗКОВЕ повне повернення клієнту.
 * Ініціатор = 'client'   → штраф згідно шкали cancellation_policy.
 *
 * @example
 * const cancel = useCancelBooking();
 * const result = await cancel.mutateAsync({
 *   bookingId,
 *   dto: { reason: 'client_request', initiated_by: 'client' }
 * });
 * toast(`Повернення: ${result.refund_amount} EUR`);
 */
export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      bookingId: string;
      dto:       CancelBookingDto;
    }): Promise<CancelBookingResult> => {
      const { data } = await api.post<{ data: CancelBookingResult }>(
        `/bookings/${payload.bookingId}/cancel`,
        payload.dto,
      );
      return data.data;
    },
    onSuccess: (result) => {
      qc.setQueryData(bookingKeys.detail(result.booking.id), result.booking);
      qc.invalidateQueries({ queryKey: bookingKeys.lists() });
      if (result.booking.tour_id) {
        invalidateTourAvailability(result.booking.tour_id);
      }
    },
  });
}

// ─── HELPERS ──────────────────────────────────────────────────

/**
 * Ре-експорт для зручності у компонентах — не треба імпортувати
 * bookingTransitions окремо.
 */
export { isTransitionAllowed, getAllowedTransitions } from '../constants/bookingTransitions';
