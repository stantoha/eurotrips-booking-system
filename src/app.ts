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

// Маршрути
import { authRoutes } from './modules/auth/auth.routes';
import { tourRoutes } from './modules/tours/tours.routes';
import { bookingRoutes } from './modules/bookings/bookings.routes';
import { financeRoutes } from './modules/finance/finance.routes';
// import { bookingRoutes } from './modules/bookings/booking.routes';
// import { agentRoutes } from './modules/agents/agent.routes';
// ...

export async function buildApp(app: FastifyInstance) {

  // ── 1. Security ────────────────────────────────────────────────────────
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: config.NODE_ENV === 'production',
  });

  await app.register(fastifyCors, {
    origin: [config.FRONTEND_URL, config.SITE_URL],
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
      // Перевіряємо БД
      await app.prisma.$queryRaw`SELECT 1`;
      // Перевіряємо Redis
      await app.redis.ping();

      return reply.code(200).send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: { database: 'ok', redis: 'ok' },
      });
    } catch (err) {
      return reply.code(503).send({
        status: 'error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ── 8. API Routes ────────────────────────────────────────────────────────
  await app.register(
    async (api) => {
      // Auth (завжди перший)
      await api.register(authRoutes, { prefix: '/auth' });
      // Tours — каталог (підключено)
      await api.register(tourRoutes, { prefix: '/tours' });
      // Bookings — з RBAC + IDOR захистом
      await api.register(bookingRoutes, { prefix: '/bookings' });
      // Finance — з RBAC (403 для агентів, 401 без токену)
      await api.register(financeRoutes, { prefix: '/finance' });
      // Agents placeholder — 401 без токену покривається requireAuth
      await api.register(async (agentsApi) => {
        agentsApi.get('/', { preHandler: [requireAuth, requireRoles('admin', 'director', 'manager')] },
          async (_req, reply) => reply.send({ data: [] }));
      }, { prefix: '/agents' });
      // await api.register(bookingRoutes,  { prefix: '/bookings' });
      // await api.register(touristRoutes,  { prefix: '/tourists' });
      // await api.register(agentRoutes,    { prefix: '/agents' });
      // await api.register(leadRoutes,     { prefix: '/leads' });
      // await api.register(paymentRoutes,  { prefix: '/payments' });
      // await api.register(hotelRoutes,    { prefix: '/hotels' });
      // await api.register(financeRoutes,  { prefix: '/finance' });
      // await api.register(documentRoutes, { prefix: '/documents' });
      // await api.register(analyticsRoutes,{ prefix: '/analytics' });
    },
    { prefix: '/api/v1' }
  );

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
