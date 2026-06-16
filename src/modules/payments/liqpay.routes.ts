// =============================================================
// EUROTRIPS — LiqPay Routes
// POST /webhooks/liqpay  — публічний endpoint (без JWT!)
//
// ВАЖЛИВО:
//   - endpoint НЕ потребує Authorization header (LiqPay не передає токен)
//   - безпека забезпечується SHA1-підписом у самому сервісі
//   - завжди повертає HTTP 200 (LiqPay ретраїть при non-2xx)
// =============================================================

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { LiqPayService } from './liqpay.service';

// Zod-схема для вхідних даних webhook
const LiqPayWebhookSchema = z.object({
  data:      z.string().min(1, 'data є обов\'язковим'),
  signature: z.string().min(1, 'signature є обов\'язковим'),
});

export async function liqPayRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions,
): Promise<void> {
  const service = new LiqPayService(fastify.prisma, fastify.log);

  /**
   * POST /webhooks/liqpay
   *
   * LiqPay надсилає form-encoded body: data=...&signature=...
   * Content-Type: application/x-www-form-urlencoded
   *
   * Відповідь: завжди 200 OK (порожнє тіло).
   * Якщо повернути non-200 — LiqPay буде ретраїти протягом 24 годин.
   */
  fastify.post(
    '/webhooks/liqpay',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        description: 'LiqPay payment callback webhook',
        tags: ['webhooks'],
        body: {
          type: 'object',
          required: ['data', 'signature'],
          properties: {
            data:      { type: 'string' },
            signature: { type: 'string' },
          },
        },
        response: {
          200: { type: 'null', description: 'OK — LiqPay вимагає порожній 200' },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // 1. Валідація структури payload
      const parse = LiqPayWebhookSchema.safeParse(request.body);
      if (!parse.success) {
        request.log.warn({ errors: parse.error.issues }, 'LiqPay webhook: невалідне тіло запиту');
        // Повертаємо 200, щоб LiqPay не ретраїв — але нічого не обробляємо
        return reply.code(200).send(null);
      }

      // 2. Обробка (всі помилки всередині перехоплюються і логуються)
      try {
        await service.handleWebhook(parse.data);
      } catch (err) {
        // Логуємо, але все одно повертаємо 200
        request.log.error({ err }, 'LiqPay webhook: необроблена помилка (повертаємо 200)');
      }

      // 3. Завжди 200 (LiqPay requirement)
      return reply.code(200).send(null);
    },
  );

  /**
   * POST /api/v1/bookings/:bookingId/payment/liqpay
   *
   * Ініціює платіж: генерує data + signature для LiqPay checkout.
   * Захищений JWT + roles: tourist, manager, agent.
   *
   * Response: { data, signature } — вставляємо в LiqPay HTML-форму на фронтенді.
   */
  fastify.post<{
    Params: { bookingId: string };
    Body: { amount: number; type: 'deposit' | 'final_payment' };
  }>(
    '/api/v1/bookings/:bookingId/payment/liqpay',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'Ініціювати LiqPay платіж для бронювання',
        tags: ['payments', 'bookings'],
        params: {
          type: 'object',
          required: ['bookingId'],
          properties: {
            bookingId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['amount', 'type'],
          properties: {
            amount: { type: 'number', minimum: 1 },
            type:   { type: 'string', enum: ['deposit', 'final_payment'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  data:      { type: 'string' },
                  signature: { type: 'string' },
                  form_url:  { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { bookingId } = request.params;
      const { amount, type } = request.body;
      const user = request.user;

      // Завантажуємо бронювання з туром для опису
      const booking = await fastify.prisma.booking.findUnique({
        where: { id: bookingId },
        include: { tour: { select: { name: true } } },
      });

      if (!booking) {
        return reply.code(404).send({ error: { code: 'BOOKING_NOT_FOUND', message: 'Бронювання не знайдено' } });
      }

      // RBAC: tourist бачить тільки своє бронювання
      if (user.role === 'tourist' && booking.touristId !== user.touristId) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Доступ заборонено' } });
      }

      // Генеруємо order_id з суфіксом типу платежу
      const orderId = `${bookingId}-${type}`;

      const checkoutData = service.generateCheckout({
        orderId,
        amount,
        description: `Тур "${booking.tour.name}" — ${type === 'deposit' ? 'передоплата' : 'доплата'}`,
        resultUrl: `${process.env.APP_FRONTEND_URL}/bookings/${bookingId}/payment-result`,
        serverUrl: `${process.env.API_URL}/webhooks/liqpay`,
      });

      return reply.code(200).send({
        data: {
          ...checkoutData,
          // Зручне посилання для redirect (для mobile / universal checkout)
          form_url: `https://www.liqpay.ua/api/3/checkout?data=${checkoutData.data}&signature=${checkoutData.signature}`,
        },
      });
    },
  );
}
