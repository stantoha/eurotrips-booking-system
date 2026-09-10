-- =============================================================================
-- Ідентичність туриста: паспорт + дата народження замість email
--
-- Було:  Tourist.email @unique
-- Стало: @@unique([passportNumber, dateOfBirth]), email лишається індексом
--
-- Чому:
--   1. У кабінеті агента email туриста не гарантований — агент вводить ім'я
--      латиницею, ІПН і паспорт, а email часто свій власний. Перше ж
--      агентське бронювання на двох осіб падало з 409 на unique.
--   2. Етап 5 — міграція ~91 860 контактів із Zoho, де email не unique.
--      Колізії гарантовані.
--
-- Tourist.email уже був nullable (String?) — змінювати тип не потрібно.
--
-- ПРИМІТКА про авторизацію: логін працює через User.email, це ІНША таблиця,
-- і там @unique лишається. Tourist.email ніде не бере участі в автентифікації
-- (перевірено: auth.service.ts звертається лише до prisma.user; механізму
-- відновлення пароля в проєкті немає).
-- =============================================================================

-- ── 0. Запобіжник: дублі за парою паспорт + дата народження ─────────────────
DO $$
DECLARE
  dup_count INTEGER;
  sample    TEXT;
BEGIN
  SELECT count(*), COALESCE(string_agg(t.info, '; '), '')
    INTO dup_count, sample
  FROM (
    SELECT passport_number || ' / ' || date_of_birth::text
             || ' (' || count(*)::text || ' записів)' AS info
    FROM tourists
    WHERE passport_number IS NOT NULL
      AND date_of_birth IS NOT NULL
    GROUP BY passport_number, date_of_birth
    HAVING count(*) > 1
    LIMIT 20
  ) t;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Міграція зупинена: % пар (паспорт, дата народження) мають дублі. Приклади: %. Обʼєднайте записи вручну перед накатом.',
      dup_count, sample;
  END IF;
END $$;

-- ── 1. Знімаємо унікальність email ──────────────────────────────────────────
-- Індекс @@index([email]) вже існує окремо і лишається — пошук по email
-- не сповільнюється.
DROP INDEX IF EXISTS "tourists_email_key";

-- ── 2. Нова ідентичність ────────────────────────────────────────────────────
-- Обидві колонки nullable; NULL у PostgreSQL не конфліктує, тож туристи без
-- паспорта (типовий стан на момент заявки) не заважають одне одному.
CREATE UNIQUE INDEX "tourists_passport_number_date_of_birth_key"
  ON "tourists"("passport_number", "date_of_birth");
