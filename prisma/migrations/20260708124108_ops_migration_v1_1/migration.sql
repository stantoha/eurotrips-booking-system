-- ops_migration_v1_1
-- Schema.prisma v1.1 (OPS-01/02/03): RoomingStatus enum, RoomType.no_preference,
-- HotelBooking planned*/structure*/rooming* полів, BookingTourist preferred/actual/
-- roommate/special полів, @@unique([bookingId, busSeaNumber]).
--
-- Ці поля існують в schema.prisma та в локальній dev-БД з моменту коміту 57a4872
-- (застосовано напряму через `prisma db push`, БЕЗ відповідної migration.sql —
-- prisma/migrations/ на той момент був у .gitignore, див. пам'ять сесії).
-- Тому немає гарантії, чи вже застосовано ці колонки на production (Railway) —
-- невідомо, чи там БД була ініціалізована через db push з уже повною схемою,
-- чи через послідовні migrate deploy. Усі команди нижче ІДЕМПОТЕНТНІ
-- (IF NOT EXISTS / DO-блок з duplicate_object), щоб міграція безпечно
-- відпрацювала в обох випадках і не зламала build/deploy.

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "rooming_status" AS ENUM ('draft', 'approved', 'final');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
ALTER TYPE "room_type" ADD VALUE IF NOT EXISTS 'no_preference';

-- AlterTable: booking_tourists
ALTER TABLE "booking_tourists"
  ADD COLUMN IF NOT EXISTS "actual_room_number" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "actual_room_type" "room_type",
  ADD COLUMN IF NOT EXISTS "bus_seat_number" INTEGER,
  ADD COLUMN IF NOT EXISTS "meal_type" "meal_type",
  ADD COLUMN IF NOT EXISTS "preferred_room_type" "room_type",
  ADD COLUMN IF NOT EXISTS "roommate_preference" TEXT,
  ADD COLUMN IF NOT EXISTS "special_requirements" TEXT;

-- AlterTable: hotel_bookings
ALTER TABLE "hotel_bookings"
  ADD COLUMN IF NOT EXISTS "final_rooming_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "final_rooming_done" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_fast_launch" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "ops_rooming_required" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "planned_double" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "planned_single" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "planned_triple" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "planned_twin" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "preliminary_rooming_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "preliminary_rooming_done" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "rooming_trigger_sent_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "structure_approved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "structure_approved_by" UUID,
  ADD COLUMN IF NOT EXISTS "structure_status" "rooming_status" NOT NULL DEFAULT 'draft';

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "booking_tourists_booking_id_bus_seat_number_key" ON "booking_tourists"("booking_id", "bus_seat_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "hotel_bookings_structure_status_ops_rooming_required_idx" ON "hotel_bookings"("structure_status", "ops_rooming_required");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "hotel_bookings_rooming_trigger_sent_at_idx" ON "hotel_bookings"("rooming_trigger_sent_at");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "hotel_bookings" ADD CONSTRAINT "hotel_bookings_structure_approved_by_fkey" FOREIGN KEY ("structure_approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
