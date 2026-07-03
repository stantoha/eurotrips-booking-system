// ============================================================
// EUROTRIPS BOOKING SYSTEM — Types
// Джерело: ADR-001, ТЗ-скелет, Gap Analysis, Фінансова модель
// ============================================================

// ─── TOUR ───────────────────────────────────────────────────

export type TourStatus =
  | 'draft'
  | 'open'
  | 'active'
  | 'almost_full'
  | 'closed'
  | 'on_tour'
  | 'completed'
  | 'cancelled';

export type TourType = 'bus' | 'avia' | 'combined';

export interface Tour {
  id: string;
  code: string;               // PN25102505, LP26010301
  name: string;
  direction: string;
  countries: string[];
  tour_type: TourType;
  departure_date: string;     // ISO date
  return_date: string;
  duration_days: number;
  departure_city: string;
  arrival_city?: string;
  base_price: number;         // EUR
  currency: string;           // 'EUR'
  deposit_amount?: number;
  deposit_deadline?: string;
  cancel_policy_id?: string;
  agent_commission_pct: number; // 0.10–0.30 (10%–30%)
  total_seats: number;
  available_seats: number;
  status: TourStatus;
  guide_id?: string;
  guide_name?: string;
  cost_price?: number;        // НЕ показується агентам (BR-04)
  included?: string;
  not_included?: string;
  tags: string[];
  audience?: string[];
  is_family?: boolean;
  is_premium?: boolean;
  is_corporate?: boolean;
  is_first_experience?: boolean;
  difficulty?: 'easy' | 'medium' | 'hard';
  asana_link?: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
}

// ─── TOURIST ────────────────────────────────────────────────

export interface Tourist {
  id: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  passport_number?: string;
  passport_expiry?: string;
  nationality?: string;
  source_channel?: LeadSource;
  is_repeat: boolean;
  notes?: string;
  allergies?: string;
  dietary_restrictions?: string;
  created_at: string;
  updated_at: string;
}

// ─── BOOKING ────────────────────────────────────────────────

/**
 * 15 статусів бронювання згідно ТЗ-скелету (розділ 5.1)
 * Порядок відповідає lifecycle туриста
 */
export type BookingStatus =
  | 'new'                  // Нова заявка
  | 'in_work'              // У роботі
  | 'needs_clarification'  // Потребує уточнення
  | 'pre_booked'           // Попередньо заброньовано
  | 'awaiting_payment'     // Очікує оплату
  | 'partially_paid'       // Частково оплачено
  | 'confirmed'            // Підтверджено
  | 'docs_collected'       // Документи зібрані
  | 'ready_to_depart'      // Готово до виїзду
  | 'on_trip'              // У поїздці
  | 'completed'            // Завершено
  | 'cancelled_client'     // Скасовано клієнтом
  | 'cancelled_operator'   // Скасовано оператором
  | 'no_show'              // No-show
  | 'refund';              // Refund

export type BookingType = 'direct' | 'agent' | 'corporate' | 'group';

export type PaymentStatus =
  | 'unpaid'
  | 'deposit_paid'
  | 'partially_paid'
  | 'fully_paid'
  | 'overdue';

export type CommissionStatus =
  | 'pending'    // Нараховано
  | 'frozen'     // Заморожено (до завершення туру)
  | 'to_pay'     // До виплати (тур завершено)
  | 'paid'       // Виплачено
  | 'cancelled'; // Скасовано

export interface Booking {
  id: string;
  booking_number: string;   // ET-YYYY-NNNNN
  tour_id: string;
  tour_name: string;
  tour_date: string;
  booking_type: BookingType;
  pax_count: number;
  contact_tourist_id: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  manager_id: string;
  manager_name: string;
  agent_id?: string;
  agent_name?: string;
  lead_id?: string;

  // Фінансові поля (Фінансова модель розділ 3.2)
  total_price: number;
  currency: string;
  prepayment_rate: number;      // 0.10–0.30
  prepayment_amount: number;
  amount_paid: number;
  balance_due: number;          // = total_price - amount_paid (computed)
  payment_deadline: string;
  payment_status: PaymentStatus;

  // Комісійні поля
  agent_commission_rate?: number;   // % з AGcomission.csv
  agent_commission_amount?: number; // = total_price × rate
  commission_status?: CommissionStatus;

  // Метадані
  status: BookingStatus;
  notes?: string;
  special_requests?: string;
  source?: LeadSource;
  created_at: string;
  updated_at: string;
  cancelled_at?: string;
  cancel_reason?: string;
}

// ─── PAYMENT ────────────────────────────────────────────────

export interface Payment {
  id: string;
  booking_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_date: string;
  payment_type: 'deposit' | 'balance' | 'surcharge' | 'refund';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  notes?: string;
  created_by: string;
  created_at: string;
}

/** Агрегована структура для PaymentBlock компонента */
export interface PaymentInfo {
  label: string;
  total_price: number;
  amount_paid: number;
  deposit_amount: number;
  balance_due: number;
  payment_deadline: string;
  payment_status: PaymentStatus;
  currency?: string;
  // Агентська комісія (видима тільки для ролей manager/admin/accountant)
  commission_amount?: number;
  commission_status?: CommissionStatus;
}

// ─── AGENT ──────────────────────────────────────────────────

export type AgentType = 'standard' | 'network';

export interface Agent {
  id: string;
  user_id: string;
  agency_name: string;
  agent_type: AgentType;       // CRITICAL: standard | network (ADR-001 §3.4)
  network_id?: string;         // NULL для standard; FK → agent_networks для network
  network_name?: string;
  commission_pct: number;      // Базова комісія (0.10–0.30)
  co_commission_pct?: number;  // % ЦО мережі (тільки network)
  royalty_pct?: number;        // % роялті від субагентів (тільки network)
  contract_number?: string;
  contract_date?: string;
  status: 'active' | 'suspended' | 'blocked';
  balance: number;
  city?: string;
  country?: string;
  email: string;
  phone?: string;
  notes?: string;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

/** Структура для CommissionBadge компонента */
export interface CommissionInfo {
  agent_id: string;
  agent_name: string;
  agent_type: AgentType;
  agency_name: string;
  network_name?: string;
  booking_id: string;
  tour_name: string;
  total_price: number;
  commission_rate: number;       // %
  commission_amount: number;     // EUR
  royalty_rate?: number;         // % (тільки network)
  royalty_amount?: number;       // EUR (тільки network)
  commission_status: CommissionStatus;
}

// ─── LEAD ───────────────────────────────────────────────────

export type LeadStatus =
  | 'new'
  | 'in_work'
  | 'needs_clarification'
  | 'proposal_sent'
  | 'waiting_decision'
  | 'won'
  | 'lost';

export type LeadSource =
  | 'site'
  | 'instagram'
  | 'facebook'
  | 'telegram'
  | 'viber'
  | 'phone'
  | 'email'
  | 'agent'
  | 'corporate'
  | 'repeat';

export interface Lead {
  id: string;
  source: LeadSource;
  source_detail?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  tour_id?: string;
  tour_date?: string;
  pax_count: number;
  budget_eur?: number;
  message?: string;
  status: LeadStatus;
  assigned_to?: string;
  lost_reason?: string;
  converted_at?: string;
  booking_id?: string;
  tourist_id?: string;
  next_contact_at?: string;
  created_at: string;
  updated_at: string;
}

// ─── AUTH / USERS ────────────────────────────────────────────

/**
 * 7 ролей згідно ТЗ-скелету (розділ 3) та ADR-001 (§6)
 */
export type UserRole =
  | 'admin'
  | 'director'
  | 'manager'
  | 'ops'
  | 'accountant'
  | 'agent'
  | 'tourist';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  agent_id?: string;        // Тільки для role='agent'
  agent_type?: AgentType;   // Тільки для role='agent'
  network_id?: string;      // Тільки для network agents
  tourist_id?: string;      // Тільки для role='tourist' (резолвиться за email)
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

// ─── TOURIST CABINET (BR-12 / OPS-03) ────────────────────────

export interface SeatMapSeat {
  seat_number: number;
  is_occupied: boolean;
  is_mine: boolean;
}

export interface SeatMap {
  total_seats: number;
  seats: SeatMapSeat[];
  my_seat: number | null;
}

export type TouristRoomType = 'twin' | 'double' | 'triple' | 'single' | 'no_preference';

/** PATCH request body — camelCase (бекенд Zod-схеми для body НЕ конвертуються, на відміну від відповідей) */
export interface TouristPreferencesDto {
  preferredRoomType?: TouristRoomType;
  busSeatNumber?: number | null;
  roommatePreference?: string;
  specialRequirements?: string;
}

export interface TouristPreferencesResult {
  updated: boolean;
  message?: string;
  preferences?: {
    id: string;
    booking_id: string;
    tourist_id: string;
    preferred_room_type: TouristRoomType | null;
    bus_seat_number: number | null;
    roommate_preference: string | null;
    special_requirements: string | null;
  };
}

export interface AuthToken {
  access_token: string;     // JWT, 15 хвилин
  refresh_token: string;    // HttpOnly Cookie, 30 днів
  user: User;
}
