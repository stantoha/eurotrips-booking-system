// =============================================================================
// EUROTRIPS — Telegram Service Unit Tests (C5)
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const configMock = vi.hoisted(() => ({
  TELEGRAM_BOT_TOKEN: undefined as string | undefined,
  TELEGRAM_OPS_CHAT_ID: undefined as string | undefined,
}));
vi.mock('../../config', () => ({ config: configMock }));

import { sendTelegramMessage, notifyBookingConfirmed, notifyRoomingRequired } from './telegram.service';

function mockPrisma() {
  return {
    booking: { findUnique: vi.fn() },
    communication: { create: vi.fn().mockResolvedValue({}) },
  };
}

const logger = { info: vi.fn(), warn: vi.fn() };

beforeEach(() => {
  configMock.TELEGRAM_BOT_TOKEN = undefined;
  configMock.TELEGRAM_OPS_CHAT_ID = undefined;
  logger.info.mockClear();
  logger.warn.mockClear();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sendTelegramMessage', () => {
  it('без TELEGRAM_BOT_TOKEN — не викликає fetch, повертає success:false', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendTelegramMessage('123', 'test');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/TELEGRAM_BOT_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('успішна відповідь Telegram API → success:true', async () => {
    configMock.TELEGRAM_BOT_TOKEN = 'test-token';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    }));

    const result = await sendTelegramMessage('123', 'hello');
    expect(result.success).toBe(true);
  });

  it('Telegram API повертає ok:false → success:false з описом помилки', async () => {
    configMock.TELEGRAM_BOT_TOKEN = 'test-token';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ ok: false, description: 'chat not found' }),
    }));

    const result = await sendTelegramMessage('bad-chat', 'hello');
    expect(result.success).toBe(false);
    expect(result.error).toBe('chat not found');
  });

  it('мережева помилка (fetch throw) — не кидає, повертає success:false', async () => {
    configMock.TELEGRAM_BOT_TOKEN = 'test-token';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const result = await sendTelegramMessage('123', 'hello');
    expect(result.success).toBe(false);
    expect(result.error).toBe('ECONNREFUSED');
  });
});

describe('notifyBookingConfirmed', () => {
  it('бронювання не знайдено — не пише в communications', async () => {
    const prisma = mockPrisma();
    prisma.booking.findUnique.mockResolvedValue(null);

    await notifyBookingConfirmed(prisma as any, logger, 'missing-id');

    expect(prisma.communication.create).not.toHaveBeenCalled();
  });

  it('chat_id налаштований і відправка успішна — status:sent, sentAt задано', async () => {
    configMock.TELEGRAM_BOT_TOKEN = 'test-token';
    configMock.TELEGRAM_OPS_CHAT_ID = '-100500';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ ok: true }),
    }));

    const prisma = mockPrisma();
    prisma.booking.findUnique.mockResolvedValue({
      bookingNumber: 'ET-2025-00123',
      tour: { name: 'Адріатика', code: 'VD26070301' },
    });

    await notifyBookingConfirmed(prisma as any, logger, 'booking-1');

    expect(prisma.communication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId:  'booking-1',
        channel:    'telegram',
        direction:  'outbound',
        templateId: 'booking_confirmed',
        status:     'sent',
        errorMessage: null,
      }),
    });
    const call = prisma.communication.create.mock.calls[0][0];
    expect(call.data.sentAt).toBeInstanceOf(Date);
    expect(call.data.body).toContain('ET-2025-00123');
    expect(call.data.body).toContain('Адріатика');
  });

  it('TELEGRAM_OPS_CHAT_ID не налаштований — status:failed, все одно логує', async () => {
    const prisma = mockPrisma();
    prisma.booking.findUnique.mockResolvedValue({
      bookingNumber: 'ET-2025-00456',
      tour: { name: 'Швейцарія', code: 'SW26052401' },
    });

    await notifyBookingConfirmed(prisma as any, logger, 'booking-2');

    expect(prisma.communication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'failed', sentAt: null }),
    });
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('notifyRoomingRequired', () => {
  it('логує без bookingId (тригер не прив\'язаний до конкретного booking)', async () => {
    configMock.TELEGRAM_BOT_TOKEN = 'test-token';
    configMock.TELEGRAM_OPS_CHAT_ID = '-100500';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ ok: true }),
    }));

    const prisma = mockPrisma();

    await notifyRoomingRequired(prisma as any, logger, {
      tourCode: 'VD26070301',
      reason: 'confirmed_tourists',
      confirmedTourists: 31,
      daysToDeparture: 20,
    });

    expect(prisma.communication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: undefined,
        channel: 'telegram',
        templateId: 'rooming_required',
        status: 'sent',
      }),
    });
    const call = prisma.communication.create.mock.calls[0][0];
    expect(call.data.body).toContain('VD26070301');
    expect(call.data.body).toContain('31');
  });

  it('reason=departure_proximity формує правильний текст', async () => {
    configMock.TELEGRAM_BOT_TOKEN = 'test-token';
    configMock.TELEGRAM_OPS_CHAT_ID = '-100500';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ ok: true }),
    }));

    const prisma = mockPrisma();

    await notifyRoomingRequired(prisma as any, logger, {
      tourCode: 'PN26052301',
      reason: 'departure_proximity',
      confirmedTourists: 12,
      daysToDeparture: 10,
    });

    const call = prisma.communication.create.mock.calls[0][0];
    expect(call.data.body).toContain('10 дн. до виїзду');
  });
});
