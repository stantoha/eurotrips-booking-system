// ============================================================
// EUROTRIPS — useBookings hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { Booking, BookingStatus } from '../types'

// ─── QUERY DTOs ───────────────────────────────────────────────

export interface BookingListQueryDto {
  agent_id?:  string
  status?:    BookingStatus
  tour_id?:   string
  date_from?: string
  date_to?:   string
  search?:    string
  page?:      number
  limit?:     number
}

export interface BookingListResult {
  bookings: Booking[]
  meta: { total: number; page: number; limit: number }
}

// ─── DETAIL TYPES ─────────────────────────────────────────────

export interface BookingTourist {
  id:               string
  first_name:       string
  last_name:        string
  middle_name?:     string
  passport_number?: string
  phone?:           string
  birth_date?:      string
  room_type:        'twin' | 'dbl' | 'sngl' | 'triple'
  seat_number?:     string
  is_lead:          boolean
}

export interface BookingDetailData extends Booking {
  tourists?:         BookingTourist[]
  comment?:          string
  tour_code?:        string
  duration_days?:    number
  departure_city?:   string
  deposit_deadline?: string
  balance_deadline?: string
}

// ─── QUERY KEYS ───────────────────────────────────────────────

export const bookingKeys = {
  all:    ()                        => ['bookings']               as const,
  lists:  ()                        => ['bookings', 'list']       as const,
  list:   (f?: BookingListQueryDto) => ['bookings', 'list', f ?? {}] as const,
  detail: (id: string)              => ['bookings', id]           as const,
}

// ─── HOOKS ────────────────────────────────────────────────────

export function useBookings(
  filters?: BookingListQueryDto,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: bookingKeys.list(filters),
    queryFn:  async (): Promise<BookingListResult> => {
      const res = await api.get<{ data: Booking[]; meta: BookingListResult['meta'] }>(
        '/bookings',
        { params: filters },
      )
      return { bookings: res.data.data, meta: res.data.meta }
    },
    enabled:   options?.enabled ?? true,
    staleTime: 2 * 60 * 1000,
  })
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn:  async (): Promise<BookingDetailData> => {
      const res = await api.get<{ data: BookingDetailData }>(`/bookings/${id}`)
      return res.data.data
    },
    enabled:   !!id,
    staleTime: 60 * 1000,
  })
}

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      bookingId,
      dto,
    }: {
      bookingId:     string
      currentStatus: BookingStatus
      dto:           { status: BookingStatus }
    }): Promise<Booking> => {
      const res = await api.patch<{ data: Booking }>(`/bookings/${bookingId}/status`, dto)
      return res.data.data
    },
    onSuccess: (_, { bookingId }) => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(bookingId) })
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() })
    },
  })
}

export function useCancelBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      bookingId,
      reason,
      initiatedBy,
    }: {
      bookingId:   string
      reason?:     string
      initiatedBy: 'client' | 'operator'
    }): Promise<Booking> => {
      const res = await api.post<{ data: Booking }>(`/bookings/${bookingId}/cancel`, {
        reason,
        initiated_by: initiatedBy,
      })
      return res.data.data
    },
    onSuccess: (_, { bookingId }) => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(bookingId) })
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() })
    },
  })
}
