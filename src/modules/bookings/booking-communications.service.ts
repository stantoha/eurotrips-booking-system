// =============================================================================
// EUROTRIPS — Booking Communications Service (Реліз 1: «базові повідомлення»)
// Лог комунікацій по бронюванню (Communication.bookingId). Автоматичні
// Telegram-нотифікації вже пишуться сюди telegram.service'ом; цей модуль
// відкриває перегляд логу + ручний запис (дзвінок/email/viber — фіксація
// менеджером, не реальна відправка).
// =============================================================================

import { UserRole, CommunicationChannel, CommunicationDirection } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { Errors } from '../../shared/utils/errors';
import type { JwtPayload } from '../auth/auth.types';

export interface CreateBookingCommunicationDto {
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  subject?: string;
  body?: string;
}

export class BookingCommunicationsService {

  async listCommunications(bookingId: string, user: JwtPayload) {
    await this.getBookingChecked(bookingId, user);

    return prisma.communication.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCommunication(bookingId: string, dto: CreateBookingCommunicationDto, user: JwtPayload) {
    const booking = await this.getBookingChecked(bookingId, user);

    return prisma.communication.create({
      data: {
        bookingId,
        touristId: booking.contactTouristId,
        channel: dto.channel,
        direction: dto.direction,
        subject: dto.subject,
        body: dto.body,
        status: 'sent',
        sentAt: new Date(),
      },
    });
  }

  /** IDOR-захист: агент бачить тільки свої бронювання */
  private async getBookingChecked(bookingId: string, user: JwtPayload) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw Errors.notFound('Бронювання', bookingId);
    if (user.role === UserRole.agent && booking.agentId !== user.agentId) {
      throw Errors.forbidden('Доступ до чужого бронювання заборонено');
    }
    return booking;
  }
}
