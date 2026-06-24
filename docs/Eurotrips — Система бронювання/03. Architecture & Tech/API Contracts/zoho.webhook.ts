// =============================================================================
// EUROTRIPS — Zoho CRM Webhook Handler
// Маршрут: POST /webhooks/zoho (публічний, без JWT)
// Верифікація: optional token via ZOHO_WEBHOOK_TOKEN env var
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const ZOHO_WEBHOOK_TOKEN = process.env.ZOHO_WEBHOOK_TOKEN ?? '';

interface ZohoWebhookBody {
  module?:    string;
  operation?: string;
  ids?:       string[];
  data?:      Record<string, unknown>[];
}

export async function zohoWebhookRoutes(app: FastifyInstance) {
  app.post<{ Body: ZohoWebhookBody }>('/', {
    schema: {
      hide: true,
      body: {
        type: 'object',
        additionalProperties: true,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    // Перевірка секретного токену (якщо налаштовано)
    if (ZOHO_WEBHOOK_TOKEN) {
      const token =
        (req.headers['x-zoho-webhook-token'] as string | undefined) ??
        (req.headers['x-webhook-token']       as string | undefined);

      if (token !== ZOHO_WEBHOOK_TOKEN) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Невірний токен вебхуку' },
        });
      }
    }

    const body = req.body as ZohoWebhookBody;

    app.log.info(
      { module: body?.module, operation: body?.operation, ids: body?.ids },
      'Zoho CRM webhook отримано'
    );

    // Обробка подій за модулем
    const { module: crmModule, operation, ids } = body;

    if (crmModule && operation) {
      app.log.info(
        { crmModule, operation, count: ids?.length ?? 0 },
        `Zoho webhook: ${crmModule} → ${operation}`
      );
      // Подальша обробка (re-sync конкретних записів) реалізується
      // через повторний виклик відповідних import* функцій з zoho-migration.ts
    }

    return reply.code(200).send({ received: true });
  });
}
