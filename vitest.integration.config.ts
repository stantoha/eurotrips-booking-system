// =============================================================================
// EUROTRIPS — конфіг для інтеграційних тестів (потрібна жива БД)
//
// Окремо від vitest.config.ts навмисно: основний `npm test` має лишатись
// швидким і працювати без Postgres. Базовий конфіг має
// include: ['src/**/*.test.ts'], тому test/integration ним не підхоплюється.
//
// Запуск:
//   DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npm run test:integration
//
// Без RUN_DB_TESTS набори пропускаються (describe.skipIf), тож у CI без БД
// команда лишається зеленою.
// =============================================================================

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    // Конкурентні тести б'ються за одні й ті самі рядки — послідовно.
    fileParallelism: false,
    // Мережа до Neon повільніша за локальний Postgres.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // setupFiles з базового конфігу НЕ підключаємо: він підмінює
    // DATABASE_URL на локальний, а тут потрібен справжній із оточення.
  },
  resolve: {
    alias: {
      '@modules': path.resolve(__dirname, 'src/modules'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@config': path.resolve(__dirname, 'src/config'),
    },
  },
});
