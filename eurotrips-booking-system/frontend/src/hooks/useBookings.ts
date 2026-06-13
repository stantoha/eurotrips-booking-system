import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import type { Booking, BookingStatus } from '../types'
import { MOCK_BOOKINGS } from '../mocks'

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

export const bookingKeys = {
  all:   ()                         => ['bookings']              as const,
  lists: ()                         => ['bookings', 'list']      as const,
  list:  (f?: BookingListQueryDto)  => ['bookings', 'list', f ?? {}] as const,
  detail: (id: string)              => ['bookings', id]          as const,
}

export function useBookings(filters?: BookingListQueryDto) {
  return useQuery({
    queryKey: bookingKeys.list(filters),
    queryFn:  async (): Promise<BookingListResult> => {
      try {
        const res = await api.get<{ data: Booking[]; meta: BookingListResult['meta'] }>(
          '/bookings',
          { params: filters }
        )
        return {
          bookings: res.data.data,
          meta:     res.data.meta,
        }
      } catch {
        // Mock fallback для розробки UI без backend
        return {
          bookings: MOCK_BOOKINGS as Booking[],
          meta:     { total: 0, page: 1, limit: filters?.limit ?? 20 },
        }
      }
    },
    staleTime: 2 * 60 * 1000,
  })
}
