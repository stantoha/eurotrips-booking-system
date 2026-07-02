// =============================================================================
// EUROTRIPS — camelCase ↔ snake_case перетворення для API-контракту
// Backend/Prisma працює в camelCase, весь frontend (types/index.ts, ADR-001)
// побудований на snake_case — перетворюємо на межі серіалізації відповіді.
// =============================================================================

const CAMEL_TO_SNAKE = /([a-z0-9])([A-Z])/g;

function camelKeyToSnake(key: string): string {
  return key.replace(CAMEL_TO_SNAKE, '$1_$2').toLowerCase();
}

/** Рекурсивно перетворює ключі об'єкта/масиву з camelCase у snake_case. */
export function toSnakeCase<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((item) => toSnakeCase(item)) as unknown as T;
  }

  if (value instanceof Date) {
    return value as unknown as T;
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[camelKeyToSnake(key)] = toSnakeCase(val);
    }
    return result as unknown as T;
  }

  return value as T;
}
