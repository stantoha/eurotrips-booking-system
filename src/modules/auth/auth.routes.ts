// =============================================================================
// EUROTRIPS — Auth Routes
// POST /api/v1/auth/login
// POST /api/v1/auth/register
// POST /api/v1/auth/refresh
// POST /api/v1/auth/logout
// GET  /api/v1/auth/me
// POST /api/v1/auth/change-password
// =============================================================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import {
  LoginSchema,
  RegisterSchema,
  ChangePasswordSchema,
  type LoginDto,
  type RegisterDto,
  type ChangePasswordDto,
} from './auth.schema';
import { requireAuth } from '../../shared/guards/jwt.guard';

const REFRESH_COOKIE = 'refresh_token';
// Frontend (vercel.app) і backend (railway.app) — різні сайти, тож cookie
// має бути SameSite=None (з Secure) в production, інакше браузер ніколи
// не надішле її на cross-site /auth/refresh. Локально (localhost:5173 →
// localhost:3000) обидва порти — той самий сайт, там 'strict' коректний.
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'strict') as 'none' | 'strict',
  path: '/api/v1/auth',
  maxAge: 30 * 24 * 60 * 60, // 30 днів у секундах
};

export async function authRoutes(app: FastifyInstance) {
  const service = new AuthService(app);

  // ── POST /auth/login ────────────────────────────────────────────────────
  // SEC-001: окремий, суворіший ліміт (10/15хв на IP) поверх глобального
  // rate-limit (config.RATE_LIMIT_MAX/WINDOW, app.ts) — захист від brute-force
  // підбору пароля, якого глобальний ліміт (200/хв) не покриває.
  app.post<{ Body: LoginDto }>(
    '/login',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '15 minutes',
          keyGenerator: (req) => req.ip ?? 'unknown',
          // @fastify/rate-limit робить `throw errorResponseBuilder(...)` — об'єкт
          // летить у app.setErrorHandler (shared/utils/errors.ts), який очікує
          // ПЛОску форму {statusCode, code, message}, а не {error:{code,message}}
          // (інакше потрапляє в catch-all і повертає 500 замість 429).
          errorResponseBuilder: () => ({
            statusCode: 429,
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Забагато спроб входу. Спробуйте через 15 хвилин.',
          }),
        },
      },
      schema: {
        summary: 'Вхід в систему',
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Body: LoginDto }>, reply: FastifyReply) => {
      const dto = LoginSchema.parse(req.body);
      const { user, tokens, refreshToken } = await service.login(dto);

      reply.setCookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);

      return reply.code(200).send({
        data: {
          user,
          access_token: tokens.accessToken,
          expires_in: tokens.expiresIn,
        },
      });
    }
  );

  // ── POST /auth/register ─────────────────────────────────────────────────
  app.post<{ Body: RegisterDto }>(
    '/register',
    {
      schema: {
        summary: 'Реєстрація нового користувача',
        tags: ['Auth'],
      },
    },
    async (req: FastifyRequest<{ Body: RegisterDto }>, reply: FastifyReply) => {
      const dto = RegisterSchema.parse(req.body);
      const { user, tokens, refreshToken } = await service.register(dto);

      reply.setCookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);

      return reply.code(201).send({
        data: {
          user,
          access_token: tokens.accessToken,
          expires_in: tokens.expiresIn,
        },
      });
    }
  );

  // ── POST /auth/refresh ──────────────────────────────────────────────────
  app.post(
    '/refresh',
    {
      schema: {
        summary: 'Оновити access token',
        tags: ['Auth'],
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const refreshToken = req.cookies?.[REFRESH_COOKIE];
      if (!refreshToken) {
        return reply.code(401).send({
          error: { code: 'NO_REFRESH_TOKEN', message: 'Refresh token відсутній' },
        });
      }

      const { tokens, newRefreshToken } = await service.refresh(refreshToken);

      reply.setCookie(REFRESH_COOKIE, newRefreshToken, COOKIE_OPTIONS);

      return reply.code(200).send({
        data: {
          access_token: tokens.accessToken,
          expires_in: tokens.expiresIn,
        },
      });
    }
  );

  // ── POST /auth/logout ───────────────────────────────────────────────────
  app.post(
    '/logout',
    {
      preHandler: [requireAuth],
      schema: {
        summary: 'Вихід з системи',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = (req.user as any).sub;
      await service.logout(userId);

      reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });

      return reply.code(200).send({
        data: { message: 'Вихід виконано успішно' },
      });
    }
  );

  // ── GET /auth/me ────────────────────────────────────────────────────────
  app.get(
    '/me',
    {
      preHandler: [requireAuth],
      schema: {
        summary: 'Отримати поточного користувача',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = (req.user as any).sub;
      const user = await service.getMe(userId);

      return reply.code(200).send({ data: user });
    }
  );

  // ── POST /auth/change-password ──────────────────────────────────────────
  app.post<{ Body: ChangePasswordDto }>(
    '/change-password',
    {
      preHandler: [requireAuth],
      schema: {
        summary: 'Змінити пароль',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (req: FastifyRequest<{ Body: ChangePasswordDto }>, reply: FastifyReply) => {
      const userId = (req.user as any).sub;
      const dto = ChangePasswordSchema.parse(req.body);

      await service.changePassword(userId, dto.currentPassword, dto.newPassword);

      return reply.code(200).send({
        data: { message: 'Пароль успішно змінено. Будь ласка, увійдіть знову.' },
      });
    }
  );
}
