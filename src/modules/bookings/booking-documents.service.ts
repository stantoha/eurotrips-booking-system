// =============================================================================
// EUROTRIPS — Booking Documents Service (Реліз 1: «документи»)
// Генерація PDF ваучера та договору для бронювання. Переюзає PDF-інфру
// tours/documents (renderHtmlToPdf, локальний storage — див. примітку там
// про ephemeral filesystem на Railway).
// =============================================================================

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { DocumentType, DocumentFor, UserRole } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { Errors } from '../../shared/utils/errors';
import { renderHtmlToPdf } from '../tours/documents/pdf.util';
import { voucherHtml, contractHtml, type BookingDocData } from './booking-documents.templates';
import type { JwtPayload } from '../auth/auth.types';

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'documents');

export class BookingDocumentsService {

  async listDocuments(bookingId: string, user: JwtPayload) {
    await this.getBookingChecked(bookingId, user);

    return prisma.document.findMany({
      where: { bookingId, docType: { in: [DocumentType.voucher, DocumentType.contract] } },
      orderBy: { generatedAt: 'desc' },
    });
  }

  async generateVoucher(bookingId: string, user: JwtPayload) {
    const data = await this.collectBookingData(bookingId, user);
    return this.renderAndSave(bookingId, DocumentType.voucher,
      `Ваучер ${data.bookingNumber}`, voucherHtml(data), user.sub);
  }

  async generateContract(bookingId: string, user: JwtPayload) {
    const data = await this.collectBookingData(bookingId, user);
    return this.renderAndSave(bookingId, DocumentType.contract,
      `Договір ${data.bookingNumber}`, contractHtml(data), user.sub);
  }

  async getDocumentFile(bookingId: string, documentId: string, user: JwtPayload): Promise<{ buffer: Buffer; title: string }> {
    await this.getBookingChecked(bookingId, user);

    const doc = await prisma.document.findFirst({ where: { id: documentId, bookingId } });
    if (!doc || !doc.filePath) throw Errors.notFound('Документ', documentId);

    const buffer = await readFile(doc.filePath).catch(() => {
      throw Errors.notFound('Файл документа (можливо втрачено між деплоями)', documentId);
    });
    return { buffer, title: doc.title };
  }

  /** IDOR-захист: агент бачить тільки свої бронювання (BR, той самий патерн що в bookings.service) */
  private async getBookingChecked(bookingId: string, user: JwtPayload) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw Errors.notFound('Бронювання', bookingId);
    if (user.role === UserRole.agent && booking.agentId !== user.agentId) {
      throw Errors.forbidden('Доступ до чужого бронювання заборонено');
    }
    return booking;
  }

  private async collectBookingData(bookingId: string, user: JwtPayload): Promise<BookingDocData> {
    await this.getBookingChecked(bookingId, user);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        tour: true,
        contactTourist: true,
        participants: { include: { tourist: true } },
      },
    });
    if (!booking) throw Errors.notFound('Бронювання', bookingId);

    return {
      bookingNumber: booking.bookingNumber,
      createdAt: booking.createdAt,
      status: booking.status,
      totalAmount: Number(booking.totalAmount),
      depositPaid: Number(booking.depositPaid ?? 0),
      balancePaid: Number(booking.balancePaid ?? 0),
      currency: booking.currency,
      contactName: `${booking.contactTourist.lastName} ${booking.contactTourist.firstName}`,
      contactPhone: booking.contactTourist.phone,
      contactEmail: booking.contactTourist.email,
      tourCode: booking.tour.code,
      tourName: booking.tour.name,
      direction: booking.tour.direction,
      departureDate: booking.tour.departureDate,
      returnDate: booking.tour.returnDate,
      departureCity: booking.tour.departureCity,
      included: booking.tour.included,
      tourists: booking.participants.map((bt) => ({
        lastName: bt.tourist.lastName,
        firstName: bt.tourist.firstName,
        dateOfBirth: bt.tourist.dateOfBirth,
        passportNumber: bt.tourist.passportNumber,
      })),
    };
  }

  private async renderAndSave(bookingId: string, docType: DocumentType, title: string, html: string, userId: string) {
    const pdfBuffer = await renderHtmlToPdf(html);

    await mkdir(STORAGE_DIR, { recursive: true });
    const fileName = `${docType}-${bookingId}-${randomUUID()}.pdf`;
    const filePath = path.join(STORAGE_DIR, fileName);
    await writeFile(filePath, pdfBuffer);

    return prisma.document.create({
      data: {
        bookingId,
        docType,
        docFor: DocumentFor.tourist,
        title,
        filePath,
        fileSizeKb: Math.round(pdfBuffer.length / 1024),
        mimeType: 'application/pdf',
        generatedById: userId,
      },
    });
  }
}
