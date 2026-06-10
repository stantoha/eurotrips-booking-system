// =============================================================================
// EUROTRIPS — AppError + глобальний error handler
// =============================================================================

import { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

// ── Custom AppError ──────────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ── Зручні фабрики ────────────────────────────────────────────────────────────

export const Errors = {
  notFound: (entity: string, id?: string) =>
    new AppError(
      'NOT_FOUND',
      id ? `${entity} з ID "${id}" не знайдено` : `${entity} не знайдено`,
      404
    ),

  forbidden: (message = 'Доступ заборонено') =>
    new AppError('FORBIDDEN', message, 403),

  unauthorized: (message = 'Необхідна авторизація') =>
    new AppError('UNAUTHORIZED', message, 401),

  conflict: (message: string) =>
    new AppError('CONFLICT', message, 409),

  badRequest: (message: string, details?: unknown) =>
    new AppError('BAD_REQUEST', message, 400, details),

  seatsUnavailable: () =>
    new AppError('SEATS_UNAVAILABLE', 'Недостатньо вільних місць у турі', 409),

  invalidStatusTransition: (from: string, to: string) =>
    new AppError(
      'INVALID_STATUS_TRANSITION',
      `Перехід зі статусу "${from}" до "${to}" неможливий`,
      422
    ),
};

// ── Глобальний error handler для Fastify ─────────────────────────────────────

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler(
    (error: FastifyError | AppError | ZodError | Error, req: FastifyRequest, reply: FastifyReply) => {
      // Zod validation error
      if (error instanceof ZodError) {
        return reply.code(422).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Помилка валідації даних',
            details: error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
        });
      }

      // AppError (наші бізнес-помилки)
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
          error: {
            code: error.code,
            message: error.message,
            ...(error.details ? { details: error.details } : {}),
          },
        });
      }

      // Fastify built-in помилки (404, 405, тощо)
      if ('statusCode' in error && error.statusCode) {
        return reply.code(error.statusCode).send({
          error: {
            code: error.code ?? 'HTTP_ERROR',
            message: error.message,
          },
        });
      }

      // Неочікувана помилка
      app.log.error({ err: error, url: req.url, method: req.method }, 'Неочікувана помилка');

      return reply.code(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Внутрішня помилка сервера',
        },
      });
    }
  );
}
