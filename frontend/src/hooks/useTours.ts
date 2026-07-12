import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

export function useTour(id: string) {
  return useQuery({
    queryKey: tourKeys.detail(id),
    queryFn:  async () => {
      const res = await api.get<{ data: Tour }>(`/tours/${id}`)
      return res.data.data
    },
    enabled: !!id,
  })
}

// Convenience hook returning Tour[] directly (used by AgentCabinet)
export function useTourList(filters?: TourListQueryDto) {
  return useQuery({
    queryKey: tourKeys.list(filters),
    queryFn:  async (): Promise<Tour[]> => {
      const res = await api.get<TourListResult>('/tours', { params: filters })
      return res.data.data
    },
    staleTime: 5 * 60 * 1000,
  })
}

// POST /tours — створити тур [admin, ops, product_manager]
// Тіло — camelCase (Zod-схема бекенду). Відповідь може містити meta.warnings (маржинальний ризик).
export function useCreateTour() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await api.post<{ data: Tour; meta?: { warnings: string[] } }>('/tours', payload)
      return res.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tourKeys.lists() }),
  })
}

// POST /tours/:id/departures — новий виїзд на базі туру [admin, ops, product_manager]
export interface CreateDeparturePayload {
  departureDate: string
  totalSeats?: number
  basePrice?: number
  costPrice?: number
  agentCommissionPct?: number
  guideId?: string
}

export function useCreateDeparture() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ tourId, payload }: { tourId: string; payload: CreateDeparturePayload }) => {
      const res = await api.post<{ data: Tour; meta?: { warnings: string[] } }>(`/tours/${tourId}/departures`, payload)
      return res.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tourKeys.lists() }),
  })
}

// PUT /tours/:id — редагувати тур [admin, ops, product_manager]
export function useUpdateTour(tourId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await api.put<{ data: Tour }>(`/tours/${tourId}`, payload)
      return res.data.data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(tourKeys.detail(tourId), data)
      queryClient.invalidateQueries({ queryKey: tourKeys.lists() })
    },
  })
}

// PATCH /tours/:id/status — зміна статусу туру [admin, ops, director]
export function useChangeTourStatus(tourId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { status: TourStatus; reason?: string }) => {
      const res = await api.patch<{ data: Tour }>(`/tours/${tourId}/status`, payload)
      return res.data.data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(tourKeys.detail(tourId), data)
      queryClient.invalidateQueries({ queryKey: tourKeys.lists() })
    },
  })
}
