import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import type { Tour, TourStatus, TourType } from '../types'

export interface TourListQueryDto {
  status?:   TourStatus | TourStatus[]
  type?:     TourType
  dateFrom?: string
  dateTo?:   string
  search?:   string
  page?:     number
  limit?:    number
}

export interface TourListResult {
  data: Tour[]
  meta: { total: number; page: number; per_page: number }
}

export const tourKeys = {
  all:    ()                      => ['tours']              as const,
  lists:  ()                      => ['tours', 'list']      as const,
  list:   (f?: TourListQueryDto)  => ['tours', 'list', f ?? {}] as const,
  detail: (id: string)            => ['tours', id]          as const,
}

export function useTours(filters?: TourListQueryDto) {
  return useQuery({
    queryKey: tourKeys.list(filters),
    queryFn:  async () => {
      const res = await api.get<TourListResult>('/tours', { params: filters })
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })
}
