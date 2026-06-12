// =============================================================================
// EUROTRIPS — Bookings Service
// BR-01: бронювання місць тільки через транзакцію
// BR-02: комісія від basePrice × personsCount
// BR-06: статусна машина — тільки дозволені переходи
// BR-08: скасування оператором → повне повернення
//        скасування клієнтом → штрафи з cancellation_policy
// =============================================================================

import { BookingStatus, BookingPaymentStatus, BookingType, Prisma, UserRole } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { AppError, Errors } from '../../shared/utils/errors';
import { generateBookingNumber } from '../../shared/utils/booking-number';
import {
  isValidStatusTransition,
  isCancelledStatus,
  isTerminalStatus,
} from '../../shared/utils/booking-status-machine';
import { calculateCommission } from '../../shared/utils/commission';
import type { JwtPayload } from '../auth/auth.types';
import type {
  CreateBookingDto,
  ChangeStatusDto,
  AddPaymentDto,
  CancelBookingDto,
  BookingListQueryDto,
} from './bookings.schema';

export class BookingsService {

  // ── LIST ─────────────────────────────────────────────────────────────────
  async listBookings(query: BookingListQueryDto, user: JwtPayload) {
    const { status, tourId, agentId, managerId, dateFrom, dateTo, search,
            page, limit, sortBy, sortOrder } = query;

    // RBAC: агент бачить тільки свої (TC-RBAC-009)
    const rbacFilter: Prisma.BookingWhereInput =
      user.role === UserRole.agent && user.agentId
        ? { agentId: user.agentId }
        : {};

    const where: Prisma.BookingWhereInput = {
      ...rbacFilter,
      ...(status    && { status }),
      ...(tourId    && { tourId }),
      ...(agentId   && user.role !== UserRole.agent && { agentId }),
      ...(managerId && { managerId }),
      ...(dateFrom  && { tour: { departureDate: { gte: new Date(dateFrom) } } }),
      ...(dateTo    && { tour: { departureDate: { lte: new Date(dateTo) } } }),
      ...(search    && {
        OR: [
          { bookingNumber: { contains: search, mode: 'insensitive' } },
          { contactTourist: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName:  { contains: search, mode: 'insensitive' } },
            ],
          }},
        ],
      }),
    };

    const orderBy = this.buildOrderBy(sortBy, sortOrder);
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where, orderBy, skip, take: limit,
        select: {
          id: true, bookingNumber: true, bookingType: true,
          personsCount: true, totalAmount: true,
          depositPaid: true, balancePaid: true,
          paymentStatus: true, status: true,
          agentId: true, managerId: true,
          createdAt: true, updatedAt: true,
          tour: { select: { id: true, code: true, name: true, departureDate: true } },
          contactTourist: { select: { id: true, firstName: true, lastName: true, phone: true } },
          agent: { select: { id: true, agencyName: true } },
        },
      }),
      prisma.booking.count({ where }),
    ]);

    return {
      data: bookings,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ── GET BY ID ─────────────────────────────────────────────────────────────
  async getBookingById(id: string, user: JwtPayload) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        tour: { select: { id: true, code: true, name: true, departureDate: true,
                          returnDate: true, basePrice: true, status: true,
                          cancelPolicyId: true } },
        contactTourist: { select: { id: true, firstName: true, lastName: true,
                                    phone: true, email: true, passportNumber: true } },
        participants: {
          include: {
            tourist: { select: { id: true, firstName: true, lastName: true,
                                 passportNumber: true, passportExpiry: true } },
          },
        },
        payments: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, amount: true, paymentType: true, paymentMethod: true,
                    status: true, paidAt: true, reference: true },
        },
        agent:   { select: { id: true, agencyName: true, agentType: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
        commissions: { select: { id: true, grossAmount: true, agentAmount: true, status: true } },
      },
    });

    if (!booking) throw Errors.notFound('Бронювання', id);

    // IDOR: агент бачить тільки своє (TC-RBAC-011)
    if (user.role === UserRole.agent && booking.agentId !== user.agentId) {
      throw Errors.forbidden('Доступ до чужого бронювання заборонено');
    }

    return booking;
  }

  // ── CREATE ────────────────────────────────────────────────────────────────
  // BR-01: транзакція з SELECT + UPDATE available_seats
  async createBooking(dto: CreateBookingDto, user: JwtPayload) {
    // Якщо агент — перевіряємо чи він може бронювати для вказаного agentId
    const effectiveAgentId = this.resolveAgentId(dto, user);

    return await prisma.$transaction(async (tx) => {
      // 1. Тур існує та має місця (BR-01 — atomic check)
      const tour = await tx.tour.findFirst({
        where: {
          id: dto.tourId,
          isArchived: false,
          availableSeats: { gte: dto.personsCount },
          status: { in: ['open', 'active', 'almost_full'] },
        },
        include: { cancelPolicy: true },
      });

      if (!tour) {
        // Перевіряємо чи тур взагалі існує
        const exists = await tx.tour.findUnique({ where: { id: dto.tourId } });
        if (!exists) throw Errors.notFound('Тур', dto.tourId);
        throw Errors.seatsUnavailable();
      }

      // 2. Знімаємо місця (BR-01)
      await tx.tour.update({
        where: { id: dto.tourId },
        data:  { availableSeats: { decrement: dto.personsCount } },
      });

      // 3. Генеруємо номер бронювання
      const bookingNumber = await generateBookingNumber();

      // 4. Розраховуємо балансові суми
      const balanceAmount = Number(dto.totalAmount) - Number(dto.depositAmount);

      // 5. Визначаємо ефективного менеджера
      const managerId = user.role === UserRole.manager || user.role === UserRole.admin
        ? user.sub
        : (await tx.agent.findUnique({ where: { id: effectiveAgentId ?? '' }, select: { userId: true } }))?.userId
          ?? user.sub;

      // 6. Створюємо бронювання
      const booking = await tx.booking.create({
        data: {
          bookingNumber,
          tourId:            dto.tourId,
          leadId:            dto.leadId,
          bookingType:       dto.bookingType,
          contactTouristId:  dto.contactTouristId,
          managerId,
          agentId:           effectiveAgentId,
          personsCount:      dto.personsCount,
          totalAmount:       dto.totalAmount,
          depositAmount:     dto.depositAmount,
          balanceAmount,
          depositDeadline:   dto.depositDeadline ? new Date(dto.depositDeadline) : undefined,
          balanceDeadline:   dto.balanceDeadline ? new Date(dto.balanceDeadline) : undefined,
          sourceChannel:     dto.sourceChannel,
          comment:           dto.comment,
          status:            BookingStatus.new,
          paymentStatus:     BookingPaymentStatus.unpaid,
          // Комісія розрахується окремо після підтвердження
        },
      });

      // 7. Учасники бронювання
      if (dto.participants?.length) {
        await tx.bookingTourist.createMany({
          data: dto.participants.map((p) => ({
            bookingId:            booking.id,
            touristId:            p.touristId,
            role:                 p.role,
            roomType:             p.roomType,
            preferredRoomType:    p.preferredRoomType,
            price:                p.price,
            seatNumber:           p.seatNumber,
            specialNotes:         p.specialNotes,
            specialRequirements:  p.specialRequirements,
          })),
          skipDuplicates: true,
        });
      } else {
        // Мінімум — контактний турист як учасник
        await tx.bookingTourist.create({
          data: {
            bookingId: booking.id,
            touristId: dto.contactTouristId,
            role:      'contact',
          },
        });
      }

      // 8. Якщо є агент — попередньо розраховуємо комісію (BR-02)
      if (effectiveAgentId) {
        const agent = await tx.agent.findUnique({
          where: { id: effectiveAgentId },
          select: { commissionPct: true, coCommissionPct: true,
                    royaltyPct: true, agentType: true },
        });

        if (agent) {
          const commResult = calculateCommission(
            Number(tour.basePrice), dto.personsCount, agent as any
          );

          await tx.booking.update({
            where: { id: booking.id },
            data: {
              agentCommissionRate:   agent.commissionPct,
              agentCommissionAmount: commResult.grossAmount,
              commissionStatus:      'pending',
            },
          });

          await tx.agentCommission.create({
            data: {
              bookingId:      booking.id,
              agentId:        effectiveAgentId,
              grossAmount:    commResult.grossAmount,
              agentAmount:    commResult.agentAmount,
              coAmount:       commResult.coAmount,
              royaltyAmount:  commResult.royaltyAmount,
              commissionRate: Number(agent.commissionPct),
              status:         'pending',
            },
          });
        }
      }

      // 9. Audit log
      await this.audit(tx, user.sub, 'CREATE', booking.id, null, {
        bookingNumber, tourId: dto.tourId, personsCount: dto.personsCount,
      });

      return booking;
    });
  }

  // ── CHANGE STATUS (BR-06) ─────────────────────────────────────────────────
  async changeStatus(id: string, dto: ChangeStatusDto, user: JwtPayload) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, status: true, agentId: true, paymentStatus: true },
    });

    if (!booking) throw Errors.notFound('Бронювання', id);
    this.assertOwnership(booking, user);

    // BR-06: перевірка дозволеного переходу
    if (!isValidStatusTransition(booking.status, dto.status)) {
      throw Errors.invalidStatusTransition(booking.status, dto.status);
    }

    // Агент може скасовувати тільки до статусу awaiting_payment
    if (user.role === UserRole.agent) {
      const agentCancellableStatuses: BookingStatus[] = [
        BookingStatus.new,
        BookingStatus.in_work,
        BookingStatus.pre_booked,
        BookingStatus.awaiting_payment,
      ];
      if (dto.status === BookingStatus.cancelled_client &&
          !agentCancellableStatuses.includes(booking.status)) {
        throw new AppError(
          'AGENT_CANCEL_FORBIDDEN',
          'Агент може скасовувати бронювання тільки до отримання підтвердження',
          403
        );
      }
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        status: dto.status,
        ...(isCancelledStatus(dto.status) && { cancelReason: dto.reason, cancelledAt: new Date() }),
      },
    });

    await this.audit(prisma, user.sub, 'STATUS_CHANGE', id,
      { status: booking.status }, { status: dto.status, reason: dto.reason });

    return updated;
  }

  // ── PAYMENT ───────────────────────────────────────────────────────────────
  async addPayment(id: string, dto: AddPaymentDto, user: JwtPayload) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true, status: true, agentId: true,
        depositAmount: true, depositPaid: true,
        balanceAmount: true, balancePaid: true,
        totalAmount: true,
      },
    });

    if (!booking) throw Errors.notFound('Бронювання', id);

    // Платіж тільки для неTerminal статусів
    if (isTerminalStatus(booking.status) &&
        booking.status !== BookingStatus.completed) {
      throw new AppError(
        'BOOKING_TERMINAL',
        'Неможливо додати платіж до завершеного або скасованого бронювання',
        422
      );
    }

    return await prisma.$transaction(async (tx) => {
      // Записуємо платіж
      const payment = await tx.payment.create({
        data: {
          bookingId:     id,
          amount:        dto.amount,
          paymentType:   dto.paymentType,
          paymentMethod: dto.paymentMethod,
          paidAt:        dto.paidAt ? new Date(dto.paidAt) : new Date(),
          reference:     dto.reference,
          notes:         dto.notes,
          status:        'confirmed',
          confirmedById: user.sub,
        },
      });

      // Оновлюємо depositPaid / balancePaid
      let depositPaid = Number(booking.depositPaid);
      let balancePaid = Number(booking.balancePaid);

      if (dto.paymentType === 'deposit') {
        depositPaid = Math.min(
          depositPaid + dto.amount,
          Number(booking.depositAmount)
        );
      } else if (dto.paymentType === 'balance') {
        balancePaid = Math.min(
          balancePaid + dto.amount,
          Number(booking.balanceAmount)
        );
      }

      // Розраховуємо новий paymentStatus
      const newPaymentStatus = this.computePaymentStatus(
        depositPaid, Number(booking.depositAmount),
        balancePaid, Number(booking.balanceAmount)
      );

      // Автоматичний перехід статусу бронювання
      let newBookingStatus = booking.status;
      if (newPaymentStatus === BookingPaymentStatus.deposit_paid &&
          booking.status === BookingStatus.awaiting_payment) {
        newBookingStatus = BookingStatus.pre_booked;
      } else if (newPaymentStatus === BookingPaymentStatus.fully_paid &&
                 isValidStatusTransition(booking.status, BookingStatus.confirmed)) {
        newBookingStatus = BookingStatus.confirmed;
      }

      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          depositPaid,
          balancePaid,
          paymentStatus: newPaymentStatus,
          status:        newBookingStatus,
        },
      });

      await this.audit(tx, user.sub, 'PAYMENT', id,
        { depositPaid: booking.depositPaid, balancePaid: booking.balancePaid },
        { amount: dto.amount, type: dto.paymentType, paymentStatus: newPaymentStatus });

      return { payment, booking: updatedBooking };
    });
  }

  // ── CANCEL (BR-08) ────────────────────────────────────────────────────────
  async cancelBooking(id: string, dto: CancelBookingDto, user: JwtPayload) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        tour: {
          include: { cancelPolicy: true },
        },
      },
    });

    if (!booking) throw Errors.notFound('Бронювання', id);
    this.assertOwnership(booking, user);

    const newStatus = dto.cancelType === 'operator'
      ? BookingStatus.cancelled_operator
      : BookingStatus.cancelled_client;

    if (!isValidStatusTransition(booking.status, newStatus)) {
      throw Errors.invalidStatusTransition(booking.status, newStatus);
    }

    // Розраховуємо штраф (BR-08)
    const { penaltyAmount, refundAmount } = this.calculatePenalty(booking);

    return await prisma.$transaction(async (tx) => {
      // Оновлюємо статус бронювання
      const updated = await tx.booking.update({
        where: { id },
        data: {
          status:      newStatus,
          cancelReason: dto.reason,
          cancelledAt:  new Date(),
        },
      });

      // Повертаємо місця в тур
      await tx.tour.update({
        where: { id: booking.tourId },
        data:  { availableSeats: { increment: booking.personsCount } },
      });

      // BR-08: скасування оператором → повне повернення без штрафів
      if (dto.cancelType === 'operator') {
        const totalPaid = Number(booking.depositPaid) + Number(booking.balancePaid);
        if (totalPaid > 0) {
          await tx.payment.create({
            data: {
              bookingId:     id,
              amount:        totalPaid,
              paymentType:   'refund',
              paidAt:        new Date(),
              notes:         `Повне повернення: скасування оператором. ${dto.reason}`,
              status:        'confirmed',
              confirmedById: user.sub,
            },
          });
        }
      } else if (refundAmount > 0) {
        // Клієнт скасовує — повертаємо суму мінус штраф
        await tx.payment.create({
          data: {
            bookingId:     id,
            amount:        refundAmount,
            paymentType:   'refund',
            paidAt:        new Date(),
            notes:         `Повернення після скасування клієнтом. Штраф: ${penaltyAmount} EUR`,
            status:        'confirmed',
            confirmedById: user.sub,
          },
        });
      }

      // Скасовуємо комісію агента
      await tx.agentCommission.updateMany({
        where: { bookingId: id, status: { in: ['pending', 'frozen'] } },
        data:  { status: 'cancelled' },
      });

      // Оновлюємо commissionStatus на booking
      await tx.booking.update({
        where: { id },
        data:  { commissionStatus: 'cancelled' },
      });

      await this.audit(tx, user.sub, 'CANCEL', id,
        { status: booking.status },
        { newStatus, reason: dto.reason, penaltyAmount, refundAmount });

      return {
        booking: updated,
        penaltyAmount,
        refundAmount,
      };
    });
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────────────────────

  private resolveAgentId(dto: CreateBookingDto, user: JwtPayload): string | undefined {
    if (user.role === UserRole.agent) {
      // Агент може бронювати тільки від свого імені
      if (dto.agentId && dto.agentId !== user.agentId) {
        throw Errors.forbidden('Агент не може бронювати від імені іншого агента');
      }
      return user.agentId ?? undefined;
    }
    return dto.agentId;
  }

  private assertOwnership(booking: { agentId: string | null }, user: JwtPayload) {
    if (user.role === UserRole.agent && booking.agentId !== user.agentId) {
      throw Errors.forbidden('Доступ до чужого бронювання заборонено');
    }
  }

  private computePaymentStatus(
    depositPaid: number, depositAmount: number,
    balancePaid: number, balanceAmount: number
  ): BookingPaymentStatus {
    const totalPaid  = depositPaid + balancePaid;
    const totalDue   = depositAmount + balanceAmount;

    if (totalPaid >= totalDue)               return BookingPaymentStatus.fully_paid;
    if (depositPaid >= depositAmount &&
        balancePaid > 0)                     return BookingPaymentStatus.partially_paid;
    if (depositPaid >= depositAmount)        return BookingPaymentStatus.deposit_paid;
    if (depositPaid > 0)                     return BookingPaymentStatus.partially_paid;
    return BookingPaymentStatus.unpaid;
  }

  private calculatePenalty(booking: any): { penaltyAmount: number; refundAmount: number } {
    const totalPaid = Number(booking.depositPaid) + Number(booking.balancePaid);
    if (totalPaid === 0) return { penaltyAmount: 0, refundAmount: 0 };

    const policy = booking.tour?.cancelPolicy;
    if (!policy?.rules) {
      // Без полісі — повне повернення
      return { penaltyAmount: 0, refundAmount: totalPaid };
    }

    // Кількість днів до виїзду
    const departureDate   = new Date(booking.tour.departureDate);
    const today           = new Date();
    const daysBeforeDep   = Math.max(
      0,
      Math.ceil((departureDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Знаходимо правило з найбільшим days_before ≤ daysBeforeDep
    const rules = (policy.rules as Array<{ days_before: number; penalty_pct: number }>)
      .sort((a, b) => b.days_before - a.days_before);

    const rule = rules.find(r => daysBeforeDep >= r.days_before);
    const penaltyPct = rule?.penalty_pct ?? 1.0; // якщо нема правила — повний штраф

    const penaltyAmount = Math.round(Number(booking.totalAmount) * penaltyPct * 100) / 100;
    const refundAmount  = Math.max(0, totalPaid - penaltyAmount);

    return { penaltyAmount, refundAmount };
  }

  private buildOrderBy(
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Prisma.BookingOrderByWithRelationInput {
    if (sortBy === 'departureDate') return { tour: { departureDate: sortOrder } };
    return { [sortBy]: sortOrder };
  }

  private async audit(
    tx: any, userId: string, action: string,
    recordId: string, oldData: unknown, newData: unknown
  ) {
    await tx.auditLog.create({
      data: {
        userId, action, tableName: 'bookings', recordId,
        oldData: oldData as Prisma.InputJsonValue,
        newData: newData as Prisma.InputJsonValue,
      },
    }).catch(() => {});
  }
}
