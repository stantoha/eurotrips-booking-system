-- =============================================================================
-- OPS-03: місце в автобусі унікальне в межах ВИЇЗДУ, а не бронювання
--
-- Було:  @@unique([bookingId, busSeaNumber])  — БД дозволяла двом різним
--        бронюванням одного туру зайняти те саме місце 14.
-- Стало: @@unique([tourId, busSeatNumber])
--
-- Для цього tour_id денормалізується в booking_tourists: без нього констрейнт
-- по виїзду виразити неможливо.
--
-- ПРИМІТКА: перейменування busSeaNumber -> busSeatNumber на БД не впливає —
-- колонка від початку звалась bus_seat_number, помилка була тільки в імені
-- поля Prisma-моделі. ALTER COLUMN ... RENAME тут не потрібен.
-- =============================================================================

-- ── 0. Запобіжник: чи немає вже дублів серед заповнених місць ────────────────
-- Якщо дублі є, міграція має впасти ЗАРАЗ із зрозумілим повідомленням,
-- а не пізніше на CREATE UNIQUE INDEX із невиразним 23505.
DO $$
DECLARE
  dup_count INTEGER;
  sample    TEXT;
BEGIN
  SELECT count(*), COALESCE(string_agg(t.info, '; '), '')
    INTO dup_count, sample
  FROM (
    SELECT b.tour_id::text || ' місце ' || bt.bus_seat_number::text
             || ' (' || count(*)::text || ' записів)' AS info
    FROM booking_tourists bt
    JOIN bookings b ON b.id = bt.booking_id
    WHERE bt.bus_seat_number IS NOT NULL
    GROUP BY b.tour_id, bt.bus_seat_number
    HAVING count(*) > 1
    LIMIT 20
  ) t;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Міграція зупинена: % пар (виїзд, місце) мають дублі. Приклади: %. Розберіть їх вручну перед накатом.',
      dup_count, sample;
  END IF;
END $$;

-- ── 1. tour_id спершу nullable, щоб не впасти на наявних рядках ─────────────
ALTER TABLE "booking_tourists" ADD COLUMN IF NOT EXISTS "tour_id" UUID;

-- ── 2. Backfill з батьківського бронювання ──────────────────────────────────
UPDATE "booking_tourists" bt
   SET "tour_id" = b."tour_id"
  FROM "bookings" b
 WHERE b."id" = bt."booking_id"
   AND bt."tour_id" IS NULL;

-- ── 3. Тепер можна вимагати NOT NULL ────────────────────────────────────────
-- Якщо десь лишився NULL — це осиротілий учасник без бронювання; хай впаде.
ALTER TABLE "booking_tourists" ALTER COLUMN "tour_id" SET NOT NULL;

-- ── 4. Зовнішній ключ ───────────────────────────────────────────────────────
ALTER TABLE "booking_tourists"
  ADD CONSTRAINT "booking_tourists_tour_id_fkey"
  FOREIGN KEY ("tour_id") REFERENCES "tours"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 5. Старий констрейнт по бронюванню геть ─────────────────────────────────
DROP INDEX IF EXISTS "booking_tourists_booking_id_bus_seat_number_key";

-- ── 6. Новий констрейнт по виїзду + індекс ──────────────────────────────────
-- NULL у PostgreSQL не порушує UNIQUE, тож кілька учасників виїзду без
-- призначеного місця — дозволено й очікувано.
CREATE UNIQUE INDEX "booking_tourists_tour_id_bus_seat_number_key"
  ON "booking_tourists"("tour_id", "bus_seat_number");

CREATE INDEX "booking_tourists_tour_id_idx" ON "booking_tourists"("tour_id");
