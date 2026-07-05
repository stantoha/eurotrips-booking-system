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

// Маршрути
import { authRoutes }         from './modules/auth/auth.routes';
import { tourRoutes }         from './modules/tours/tours.routes';
import { roomStructureRoutes } from './modules/tours/room-structure.routes';
import { checklistRoutes }     from './modules/tours/checklist.routes';
import { activitiesRoutes }    from './modules/tours/activities.routes';
import { touristsRoutes }      from './modules/tours/tourists.routes';
import { tourSeatMapRoutes }   from './modules/tours/tour-seat-map.routes';
import { transportRoutes }     from './modules/tours/transport.routes';
import { bookingRoutes }      from './modules/bookings/bookings.routes';
import { seatMapRoutes }      from './modules/bookings/seat-map.routes';
import { financeRoutes }      from './modules/finance/finance.routes';
import { leadRoutes }         from './modules/leads/leads.routes';
import { agentRoutes }        from './modules/agents/agents.routes';
import { touristRoutes }      from './modules/tourists/tourists.routes';
// import { zohoWebhookRoutes }  from './modules/integrations/zoho/zoho.webhook';
// import { liqPayRoutes }       from './modules/payments/liqpay.routes';

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
      if (allowed.some(u => origin.startsWith(u))) {
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
  app.get('/health', { schema: { hide: true } }, async (_req, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;

      let redisStatus: string = config.REDIS_URL ? 'ok' : 'disabled';
      if (app.redis) {
        await app.redis.ping();
      }

      return reply.code(200).send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: { database: 'ok', redis: redisStatus },
      });
    } catch (err) {
      return reply.code(503).send({
        status: 'error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get('/api/v1/health', { schema: { hide: true } }, async () => ({
    status: 'ok',
    db: 'connected',
    redis: config.REDIS_URL ? 'connected' : 'disabled',
    ts: new Date().toISOString(),
  }));

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
    },
    { prefix: '/api/v1' }
  );

  // ── 8b. Публічні вебхуки (без JWT) — disabled for MVP ──────────────────
  // await app.register(zohoWebhookRoutes, { prefix: '/webhooks/zoho' });
  // await app.register(liqPayRoutes,      { prefix: '/webhooks/liqpay' });

  // ── 9. Prisma — декоруємо app для використання в хуках ─────────────────
  app.decorate('prisma', (await import('./shared/database/prisma')).default);

  app.addHook('onClose', async () => {
    await app.prisma.$disconnect();
  });

  app.log.info('✅ Fastify application побудовано');
}

// Декларація розширення FastifyInstance
declare module 'fastify' {
  interface FastifyInstance {
    prisma: import('@prisma/client').PrismaClient;
  }
}
