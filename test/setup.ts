// =============================================================================
// EUROTRIPS — Test Setup
// =============================================================================

import { vi } from 'vitest';

// Глобальний мок для змінних середовища
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://eurotrips:test@localhost:5432/eurotrips_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test_jwt_secret_minimum_32_characters_x';
process.env.JWT_REFRESH_SECRET = 'test_refresh_minimum_32_characters_xx';
process.env.JWT_ACCESS_EXPIRES = '15m';
process.env.JWT_REFRESH_EXPIRES = '30d';
process.env.BCRYPT_ROUNDS = '4'; // мінімум для швидкості тестів
process.env.BOOKING_NUMBER_PREFIX = 'ET';
process.env.BOOKING_NUMBER_PAD = '5';
process.env.EMAIL_FROM = 'test@eurotrips.ua';
process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_MAX = '1000';
process.env.RATE_LIMIT_WINDOW = '60000';
