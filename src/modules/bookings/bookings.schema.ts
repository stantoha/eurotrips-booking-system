// =============================================================================
// EUROTRIPS — Bookings Schemas (Zod)
// =============================================================================

import { z } from 'zod';
import { BookingStatus, BookingType, PaymentMethod, PaymentType, RoomType } from '@prisma/client';

// ── Список ───────────────────────────────────────────────────────────────────

export const BookingListQuerySchema = z.object({
  status:     z.nativeEnum(BookingStatus).optional(),
  tourId:     z.string().uuid().optional(),
  agentId:    z.string().uuid().optional(),
  managerId:  z.string().uuid().optional(),
  dateFrom:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search:     z.string().max(100).optional(), // пошук по bookingNumber або імені
  page:       z.string().optional().transform(v => v ? parseInt(v, 10) : 1).pipe(z.number().int().min(1)),
  limit:      z.string().optional().transform(v => v ? parseInt(v, 10) : 20).pipe(z.number().int().min(1).max(100)),
  sortBy:     z.enum(['createdAt', 'departureDate', 'totalAmount', 'status']).optional().default('createdAt'),
  sortOrder:  z.enum(['asc', 'desc']).optional().default('desc'),
});

// ── Учасник бронювання ────────────────────────────────────────────────────────

export const ParticipantSchema = z.object({
  touristId:         z.string().uuid(),
  role:              z.enum(['contact', 'participant']).default('participant'),
  roomType:          z.nativeEnum(RoomType).optional(),
  preferredRoomType: z.nativeEnum(RoomType).optional(),
  price:             z.number().positive().optional(),
  seatNumber:        z.string().max(20).optional(),
  specialNotes:      z.string().max(500).optional(),
  specialRequirements: z.string().max(500).optional(),
});

// ── Створити бронювання ──────────────────────────────────────────────────────

export const CreateBookingSchema = z.object({
  tourId:            z.string().uuid({ message: 'Вкажіть ID туру' }),
  bookingType:       z.nativeEnum(BookingType),
  contactTouristId:  z.string().uuid({ message: 'Вкажіть контактного туриста' }),
  agentId:           z.string().uuid().optional(),
  personsCount:      z.number().int().min(1, 'Мінімум 1 особа').max(200),
  totalAmount:       z.number().positive('Сума має бути > 0'),
  depositAmount:     z.number().positive('Депозит має бути > 0'),
  depositDeadline:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  balanceDeadline:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cancelPolicyId:    z.string().uuid().optional(),
  sourceChannel:     z.string().max(100).optional(),
  comment:           z.string().max(2000).optional(),
  leadId:            z.string().uuid().optional(),
  participants:      z.array(ParticipantSchema).optional(),
});

// ── Змінити статус (BR-06) ────────────────────────────────────────────────────

export const ChangeBookingStatusSchema = z.object({
  status:  z.nativeEnum(BookingStatus),
  reason:  z.string().max(500).optional(),
});

// ── Прийняти платіж ──────────────────────────────────────────────────────────

export const AddPaymentSchema = z.object({
  amount:        z.number().positive('Сума платежу має бути > 0'),
  paymentType:   z.nativeEnum(PaymentType),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  paidAt:        z.string().datetime().optional(),
  reference:     z.string().max(100).optional(),
  notes:         z.string().max(500).optional(),
});

// ── Скасування (BR-08) ────────────────────────────────────────────────────────

export const CancelBookingSchema = z.object({
  cancelType: z.enum(['client', 'operator'], {
    required_error: 'Вкажіть ініціатора скасування',
  }),
  reason: z.string().min(3, 'Вкажіть причину скасування').max(1000),
});

// ── Побажання туриста (BR-12 / OPS-03 self-service) ───────────────────────────

export const UpdateTouristPreferencesSchema = z.object({
  preferredRoomType:   z.nativeEnum(RoomType).optional(),
  /** Номер місця в автобусі. null — скинути вибір. */
  busSeatNumber:       z.number().int().min(1).max(200).nullable().optional(),
  roommatePreference:  z.string().max(500).optional(),
  specialRequirements: z.string().max(1000).optional(),
});

export type BookingListQueryDto  = z.infer<typeof BookingListQuerySchema>;
export type CreateBookingDto     = z.infer<typeof CreateBookingSchema>;
export type ChangeStatusDto      = z.infer<typeof ChangeBookingStatusSchema>;
export type AddPaymentDto        = z.infer<typeof AddPaymentSchema>;
export type CancelBookingDto     = z.infer<typeof CancelBookingSchema>;
export type UpdateTouristPreferencesDto = z.infer<typeof UpdateTouristPreferencesSchema>;
