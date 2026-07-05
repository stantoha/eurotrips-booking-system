// =============================================================================
// EUROTRIPS — OPS Documents Service (OPS-18/19)
// Автогенерація PDF: румінг для готелю, пасенджер-ліст для перевізника.
//
// ПРИМІТКА: файли зберігаються локально в storage/documents/ — не
// персистентно між деплоями на Railway (ephemeral filesystem). S3-
// креденшали (.env.production S3_*) не підключені в коді — потрібен
// окремий крок з реальними credentials, яких немає в цій сесії.
// =============================================================================

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { BookingStatus, DocumentType, DocumentFor } from '@prisma/client';
import prisma from '../../shared/database/prisma';
import { Errors } from '../../shared/utils/errors';
import { roomingHtml, passengerListHtml } from './documents/templates';
import { renderHtmlToPdf } from './documents/pdf.util';

const CONFIRMED_AND_BEYOND: BookingStatus[] = [
  BookingStatus.confirmed,
  BookingStatus.docs_collected,
  BookingStatus.ready_to_depart,
  BookingStatus.on_trip,
  BookingStatus.completed,
];

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'documents');

export class DocumentsService {

  async listDocuments(tourId: string) {
    const tour = await prisma.tour.findFirst({ where: { id: tourId, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', tourId);

    return prisma.document.findMany({
      where: { tourId, docType: { in: [DocumentType.rooming_hotel, DocumentType.passenger_list] } },
      orderBy: { generatedAt: 'desc' },
    });
  }

  // ── OPS-18: румінг для готелю ────────────────────────────────────────────────
  async generateRoomingPdf(tourId: string, hotelBookingId: string, userId: string) {
    const tour = await prisma.tour.findFirst({ where: { id: tourId, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', tourId);

    const hotelBooking = await prisma.hotelBooking.findFirst({
      where: { id: hotelBookingId, tourId },
      include: { hotel: { select: { name: true } } },
    });
    if (!hotelBooking) throw Errors.notFound('Готельне бронювання', hotelBookingId);

    const bookingTourists = await prisma.bookingTourist.findMany({
      where: { booking: { tourId, status: { in: CONFIRMED_AND_BEYOND } } },
      include: { tourist: true, booking: { select: { bookingNumber: true } } },
      orderBy: [{ tourist: { lastName: 'asc' } }],
    });

    const html = roomingHtml(
      tour.code, tour.name, hotelBooking.hotel.name,
      bookingTourists.map((bt) => ({
        bookingNumber: bt.booking.bookingNumber,
        lastName: bt.tourist.lastName,
        firstName: bt.tourist.firstName,
        passportNumber: bt.tourist.passportNumber,
        dateOfBirth: bt.tourist.dateOfBirth,
        actualRoomNumber: bt.actualRoomNumber,
        actualRoomType: bt.actualRoomType,
        mealType: bt.mealType,
        notes: bt.roommatePreference ?? bt.specialRequirements,
      }))
    );

    return this.renderAndSave(tour.id, DocumentType.rooming_hotel, DocumentFor.supplier,
      `Румінг для готелю — ${hotelBooking.hotel.name} (${tour.code})`, html, userId);
  }

  // ── OPS-19: пасенджер-ліст для перевізника ───────────────────────────────────
  async generatePassengerListPdf(tourId: string, userId: string) {
    const tour = await prisma.tour.findFirst({ where: { id: tourId, isArchived: false } });
    if (!tour) throw Errors.notFound('Тур', tourId);

    const bookingTourists = await prisma.bookingTourist.findMany({
      where: { booking: { tourId, status: { in: CONFIRMED_AND_BEYOND } } },
      include: { tourist: true },
    });

    const html = passengerListHtml(
      tour.code, tour.name,
      bookingTourists.map((bt) => ({
        lastName: bt.tourist.lastName,
        firstName: bt.tourist.firstName,
        passportNumber: bt.tourist.passportNumber,
        dateOfBirth: bt.tourist.dateOfBirth,
        busSeatNumber: bt.busSeaNumber,
        phone: bt.tourist.phone,
      }))
    );

    return this.renderAndSave(tour.id, DocumentType.passenger_list, DocumentFor.supplier,
      `Пасенджер-ліст (${tour.code})`, html, userId);
  }

  async getDocumentFile(documentId: string): Promise<{ buffer: Buffer; title: string }> {
    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (!doc || !doc.filePath) throw Errors.notFound('Документ', documentId);

    const buffer = await readFile(doc.filePath).catch(() => {
      throw Errors.notFound('Файл документа (можливо втрачено між деплоями)', documentId);
    });
    return { buffer, title: doc.title };
  }

  private async renderAndSave(
    tourId: string, docType: DocumentType, docFor: DocumentFor,
    title: string, html: string, userId: string
  ) {
    const pdfBuffer = await renderHtmlToPdf(html);

    await mkdir(STORAGE_DIR, { recursive: true });
    const fileName = `${docType}-${tourId}-${randomUUID()}.pdf`;
    const filePath = path.join(STORAGE_DIR, fileName);
    await writeFile(filePath, pdfBuffer);

    const document = await prisma.document.create({
      data: {
        tourId,
        docType,
        docFor,
        title,
        filePath,
        fileSizeKb: Math.round(pdfBuffer.length / 1024),
        mimeType: 'application/pdf',
        generatedById: userId,
      },
    });

    return document;
  }
}
