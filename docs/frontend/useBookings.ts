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
  total:    number;
  page:     number;
  per_page: number;
}

export interface BookingListResult {
  bookings: Booking[];
  meta:     BookingListMeta;
  total:    number;
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

// ─── FETCHER ──────────────────────────────────────────────────

async function fetchBookings(
  params?: BookingListQueryDto,
): Promise<{ data: Booking[]; meta: BookingListMeta }> {
  const { data } = await api.get<{ data: Booking[]; meta: BookingListMeta }>(
    '/bookings', { params },
  );
  return data;
}

/** Dev fallback — повертає відфільтровані MOCK_BOOKINGS коли API недоступний */

/** Тимчасовий in-memory фільтр поверх MOCK_BOOKINGS */
function filterMocks(params?: BookingListQueryDto): BookingListResult {
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
  return { bookings: result, meta: { total, page, per_page: limit }, total };
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
        const { data } = await api.get<{ data: Booking }>(`/bookings/${id}`);
        return data.data;
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
      // TODO: розкоментувати після появи API
      // const { data } = await api.patch<ApiResponse<Booking>>(
      //   `/bookings/${payload.bookingId}/status`,
      //   payload.dto,
      // );
      // return data.data;

      // Заглушка — повертаємо мок з оновленим статусом
      const found = MOCK_BOOKINGS.find((b) => b.id === payload.bookingId);
      if (!found) throw new Error('Booking not found');
      return { ...found, status: payload.dto.status };
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
      // TODO: розкоментувати після появи API
      // const { data } = await api.post<ApiResponse<CancelBookingResult>>(
      //   `/bookings/${payload.bookingId}/cancel`,
      //   payload.dto,
      // );
      // return data.data;

      // Заглушка для dev
      const found = MOCK_BOOKINGS.find((b) => b.id === payload.bookingId);
      if (!found) throw new Error('Booking not found');
      const penaltyPct = payload.dto.initiated_by === 'operator' ? 0 : 20;
      const penalty    = Math.round(found.total_price * penaltyPct / 100);
      return {
        booking:        { ...found, status: payload.dto.initiated_by === 'client' ? 'cancelled_client' : 'cancelled_operator' },
        penalty_amount: penalty,
        refund_amount:  found.amount_paid - penalty,
        penalty_pct:    penaltyPct,
        policy_applied: 'standard_30d',
      };
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
