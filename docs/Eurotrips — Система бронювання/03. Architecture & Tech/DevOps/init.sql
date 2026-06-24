-- scripts/init.sql
-- Виконується ОДИН РАЗ при першому старті postgres контейнера
-- (docker-entrypoint-initdb.d/00_init.sql)
--
-- ВАЖЛИВО: Prisma вимагає uuid-ossp для DEFAULT gen_random_uuid()
-- В PostgreSQL 16 gen_random_uuid() вбудований, але uuid-ossp
-- залишається для сумісності.

-- Розширення UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Розширення для повнотекстового пошуку (українська локаль)
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Розширення для шифрування (паролі, токени)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Статистика для моніторингу (Grafana / pg_stat_statements)
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
