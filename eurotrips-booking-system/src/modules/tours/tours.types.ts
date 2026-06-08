// =============================================================================
// EUROTRIPS — Tours Types
// BR-04: costPrice НІКОЛИ не повертається агентам/туристам
// =============================================================================

import { TourStatus, TourType, UserRole } from '@prisma/client';

// ── Query params ──────────────────────────────────────────────────────────────

export interface TourListQuery {
  status?: TourStatus;
  tourType?: TourType;
  departureDateFrom?: string; // YYYY-MM-DD
  departureDateTo?: string;
  product?: string;           // "Лапландія", "Париж + Нормандія"
  direction?: string;
  departureCity?: string;
  tags?: string;              // comma-separated
  availableOnly?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'departureDate' | 'basePrice' | 'availableSeats' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

/** Скорочений тур для списку (без costPrice — BR-04) */
export interface TourListItem {
  id: string;
  code: string;
  name: string;
  product: string | null;
  direction: string | null;
  countries: string[];
  tourType: TourType;
  departureDate: string;
  returnDate: string;
  durationDays: number;
  departureCity: string | null;
  basePrice: number;
  currency: string;
  depositAmount: number | null;
  agentCommissionPct: number;
  totalSeats: number;
  availableSeats: number;
  status: TourStatus;
  tags: string[];
  isFamily: boolean;
  isPremium: boolean;
}

/** Повний тур для менеджерів/адміна (з costPrice) */
export interface TourDetailAdmin extends TourListItem {
  format: string | null;
  arrivalCity: string | null;
  depositDeadline: string | null;
  costPrice: number | null;    // ТІЛЬКИ для admin/manager/director/ops/accountant
  included: string | null;
  notIncluded: string | null;
  audience: string | null;
  difficulty: string | null;
  isCorporate: boolean;
  isFirstExperience: boolean;
  asanaLink: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Публічний тур для агентів і туристів (БЕЗ costPrice — BR-04) */
export interface TourDetailPublic extends TourListItem {
  format: string | null;
  arrivalCity: string | null;
  depositDeadline: string | null;
  included: string | null;
  notIncluded: string | null;
  audience: string | null;
  difficulty: string | null;
  isCorporate: boolean;
  isFirstExperience: boolean;
}

/** Відповідь на GET /tours/:id/availability */
export interface TourAvailability {
  tourId: string;
  code: string;
  name: string;
  totalSeats: number;
  availableSeats: number;
  bookedSeats: number;
  occupancyPct: number;   // 0-100
  status: TourStatus;
  isAvailable: boolean;
}

// ── Roles що бачать costPrice ─────────────────────────────────────────────────
export const COST_PRICE_VISIBLE_ROLES: UserRole[] = [
  UserRole.admin,
  UserRole.director,
  UserRole.manager,
  UserRole.ops,
  UserRole.accountant,
];
