// =============================================================================
// EUROTRIPS — Fastify Application Builder
// Реєстрація плагінів, маршрутів та middleware
// =============================================================================

import { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

import { config } from './config';
import redisPlugin from './shared/redis/redis.plugin';
import { registerErrorHandler } from './shared/utils/errors';
import { requireAuth } from './shared/guards/jwt.guard';
import { requireRoles } from './shared/guards/rbac.guard';
import { toSnakeCase } from './shared/utils/case-transform';
import { isOriginAllowed } from './shared/utils/cors';

// Маршрути
import { authRoutes }         from './modules/auth/auth.routes';
import { tourRoutes }         from './modules/tours/tours.routes';
import { roomStructureRoutes } from './modules/tours/room-structure.routes';
import { checklistRoutes }     from './modules/tours/checklist.routes';
import { activitiesRoutes }    from './modules/tours/activities.routes';
import { touristsRoutes }      from './modules/tours/tourists.routes';
import { tourSeatMapRoutes }   from './modules/tours/tour-seat-map.routes';
import { transportRoutes }     from './modules/tours/transport.routes';
import { hotelBookingsRoutes } from './modules/tours/hotel-bookings.routes';
import { roomingRoutes }       from './modules/tours/rooming.routes';
import { documentsRoutes }     from './modules/tours/documents.routes';
import { opsDashboardRoutes }  from './modules/ops/dashboard.routes';
import { bookingRoutes }      from './modules/bookings/bookings.routes';
import { seatMapRoutes }      from './modules/bookings/seat-map.routes';
import { financeRoutes }      from './modules/finance/finance.routes';
import { leadRoutes }         from './modules/leads/leads.routes';
import { agentRoutes }        from './modules/agents/agents.routes';
import { touristRoutes }      from './modules/tourists/tourists.routes';
import { hotelRoutes }        from './modules/hotels/hotels.routes';
import { analyticsRoutes }    from './modules/analytics/analytics.routes';
// import { zohoWebhookRoutes }  from './modules/integrations/zoho/zoho.webhook';
import { liqPayRoutes }       from './modules/payments/liqpay.routes';

export async function buildApp(app: FastifyInstance) {

  // ── 1. Security ────────────────────────────────────────────────────────
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: config.NODE_ENV === 'production',
  });

  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl, Postman, server-to-server
      const allowed = [
        'http://localhost:5173',
        'http://localhost:3000',
        config.FRONTEND_URL,
        process.env.CORS_ORIGIN,
      ].filter(Boolean) as string[];
      if (isOriginAllowed(origin, allowed)) {
        cb(null, true);
      } else {
        cb(new Error(`CORS blocked: ${origin}`), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(fastifyRateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
    errorResponseBuilder: () => ({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Забагато запитів. Спробуйте пізніше.',
      },
    }),
  });

  // ── 2. Cookies ──────────────────────────────────────────────────────────
  await app.register(fastifyCookie, {
    secret: config.JWT_SECRET, // підписує cookies
  });

  // ── 3. JWT ──────────────────────────────────────────────────────────────
  await app.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_ACCESS_EXPIRES },
    cookie: {
      cookieName: 'access_token',
      signed: false,
    },
  });

  // ── 4. Redis ────────────────────────────────────────────────────────────
  await app.register(redisPlugin);

  // ── 4b. Response case transform ──────────────────────────────────────────
  // Prisma/сервіси працюють у camelCase, весь frontend (ADR-001, types/index.ts)
  // побудований на snake_case — конвертуємо на межі серіалізації відповіді,
  // щоб не чіпати ні Prisma-моделі, ні типи фронтенду.
  app.addHook('preSerialization', async (_req, _reply, payload) => toSnakeCase(payload));

  // ── 5. Swagger (тільки не в production) ────────────────────────────────
  if (config.NODE_ENV !== 'production') {
    await app.register(fastifySwagger, {
      openapi: {
        info: {
          title: 'Eurotrips Booking API',
          description: 'Система бронювання та операційного управління Eurotrips',
          version: '1.0.0',
        },
        servers: [{ url: config.APP_URL }],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
        tags: [
          { name: 'Auth', description: 'Авторизація та управління сесіями' },
          { name: 'Tours', description: 'Каталог турів' },
          { name: 'Bookings', description: 'Бронювання' },
          { name: 'Agents', description: 'Агенти та комісії' },
          { name: 'Leads', description: 'CRM / Ліди' },
          { name: 'Finance', description: 'Фінанси та платежі' },
          { name: 'Documents', description: 'Документи та PDF' },
          { name: 'Analytics', description: 'Аналітика та звіти' },
        ],
      },
    });

    await app.register(fastifySwaggerUi, {
      routePrefix: '/documentation',
      uiConfig: { docExpansion: 'list', deepLinking: true },
      staticCSP: true,
    });
  }

  // ── 6. Global error handler ─────────────────────────────────────────────
  registerErrorHandler(app);

  // ── 7. Health check ─────────────────────────────────────────────────────
  // A4: /api/v1/health раніше завжди відповідав db:'connected' без реальної
  // перевірки (на відміну від /health) — обидва тепер ходять через один і
  // той самий реальний чек, просто зберігають свою історичну форму відповіді.
  const checkServicesHealth = async (): Promise<{ ok: boolean; db: boolean; redis: boolean }> => {
    let dbOk = false;
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    let redisOk = !config.REDIS_URL; // немає REDIS_URL → не задіяний, не рахуємо як збій
    if (app.redis) {
      try {
        await app.redis.ping();
        redisOk = true;
      } catch {
        redisOk = false;
      }
    }

    return { ok: dbOk && redisOk, db: dbOk, redis: redisOk };
  };

  app.get('/health', { schema: { hide: true } }, async (_req, reply) => {
    const { ok, db, redis } = await checkServicesHealth();
    return reply.code(ok ? 200 : 503).send({
      status: ok ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: db ? 'ok' : 'error',
        redis: !config.REDIS_URL ? 'disabled' : redis ? 'ok' : 'error',
      },
    });
  });

  app.get('/api/v1/health', { schema: { hide: true } }, async (_req, reply) => {
    const { ok, db, redis } = await checkServicesHealth();
    return reply.code(ok ? 200 : 503).send({
      status: ok ? 'ok' : 'error',
      db: db ? 'connected' : 'error',
      redis: !config.REDIS_URL ? 'disabled' : redis ? 'connected' : 'error',
      ts: new Date().toISOString(),
    });
  });

  // ── 8. API Routes ────────────────────────────────────────────────────────
  await app.register(
    async (api) => {
      // Auth
      await api.register(authRoutes,    { prefix: '/auth' });
      // Tours — каталог
      await api.register(tourRoutes,    { prefix: '/tours' });
      // Room structure — OPS-01/09/10 (той самий /tours префікс)
      await api.register(roomStructureRoutes, { prefix: '/tours' });
      // Operational checklist — OPS-18 (той самий /tours префікс)
      await api.register(checklistRoutes, { prefix: '/tours' });
      // Активності туру (read-only, для TimelineView)
      await api.register(activitiesRoutes, { prefix: '/tours' });
      // Список туристів виїзду
      await api.register(touristsRoutes, { prefix: '/tours' });
      // Розсадка в автобусі (tour-scoped, OPS-17)
      await api.register(tourSeatMapRoutes, { prefix: '/tours' });
      // Транспорт: перевізник, км×тариф, аванс (OPS-08/09/10)
      await api.register(transportRoutes, { prefix: '/tours' });
      // Готелі: додавання, дедлайни, депозит/фінал (OPS-04/05/06)
      await api.register(hotelBookingsRoutes, { prefix: '/tours' });
      // Факт-румінг: розселення + фіналізація (OPS-14/15/16)
      await api.register(roomingRoutes, { prefix: '/tours' });
      // Автогенерація PDF-документів (OPS-18/19)
      await api.register(documentsRoutes, { prefix: '/tours' });
      // Дашборд операційного менеджера (/ops)
      await api.register(opsDashboardRoutes, { prefix: '/ops' });
      // Bookings — повна реалізація (BR-01/06/08)
      await api.register(bookingRoutes, { prefix: '/bookings' });
      // Seat map + preferences — OPS-03/BR-12
      await api.register(seatMapRoutes, { prefix: '/bookings' });
      // Finance — RBAC (403 для агентів)
      await api.register(financeRoutes, { prefix: '/finance' });
      // Leads / CRM — включно з /convert
      await api.register(leadRoutes,   { prefix: '/leads' });
      // Agents — BR-04/05/07
      await api.register(agentRoutes,  { prefix: '/agents' });
      // Tourists — пошук/створення для форми бронювання
      await api.register(touristRoutes, { prefix: '/tourists' });
      // Hotels — каталог готелів (563+ з CSV), CLAUDE.md §6
      await api.register(hotelRoutes, { prefix: '/hotels' });
      // Analytics — базова аналітика MVP (CLAUDE.md §16, Реліз 1)
      await api.register(analyticsRoutes, { prefix: '/analytics' });
    },
    { prefix: '/api/v1' }
  );

  // ── 8b. Публічні вебхуки (без JWT) — zoho ще заблоковано ────────────────
  // await app.register(zohoWebhookRoutes, { prefix: '/webhooks/zoho' });

  // ── 9. Prisma — декоруємо app для використання в хуках ─────────────────
  app.decorate('prisma', (await import('./shared/database/prisma')).default);

  app.addHook('onClose', async () => {
    await app.prisma.$disconnect();
  });

  // ── 9b. LiqPay — реєструємо ПІСЛЯ декорації fastify.prisma (плагін
  // використовує її одразу при виклику). Без prefix — обидва маршрути
  // плагіна вже абсолютні (/webhooks/liqpay, /api/v1/bookings/.../liqpay);
  // { prefix: '/webhooks/liqpay' } подвоїло б перший шлях і зламало другий.
  await app.register(liqPayRoutes);

  app.log.info('✅ Fastify application побудовано');
}

// Декларація розширення FastifyInstance
declare module 'fastify' {
  interface FastifyInstance {
    prisma: import('@prisma/client').PrismaClient;
  }
}
