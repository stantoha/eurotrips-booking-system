-- =============================================================================
-- EUROTRIPS — DB Initialization
-- Виконується автоматично при першому запуску postgres контейнера
-- =============================================================================

-- Необхідно для UUID генерації в Prisma (uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Оптимальні налаштування PostgreSQL для продуктивності
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '768MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = '0.9';
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = '100';
