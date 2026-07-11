-- add_product_manager_logist_roles
-- Нові ролі product_manager (CRUD турів/виїздів, персонал, допи) та
-- logist (готелі/румінг/перевізники/автобуси/листування) + структуровані
-- Carrier/Bus, TourDriverAssignment (ліміт 2 водії на тур — на рівні сервісу),
-- Communication.hotel_booking_id (ручний лог листування логіста з готелем).
--
-- ІДЕМПОТЕНТНО (IF NOT EXISTS скрізь) — той самий патерн, що ops_migration_v1_1.

-- AlterEnum: user_role
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'product_manager';
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'logist';

-- CreateTable: carriers
CREATE TABLE IF NOT EXISTS "carriers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "contact_name" VARCHAR(255),
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: buses
CREATE TABLE IF NOT EXISTS "buses" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "carrier_id" UUID NOT NULL,
    "brand" VARCHAR(100) NOT NULL,
    "plate_number" VARCHAR(20) NOT NULL,
    "seats_count" INTEGER NOT NULL,
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buses_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "buses" ADD CONSTRAINT "buses_carrier_id_fkey"
        FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "buses_carrier_id_idx" ON "buses"("carrier_id");

-- AlterTable: transport_bookings — опційні FK на carriers/buses
ALTER TABLE "transport_bookings"
  ADD COLUMN IF NOT EXISTS "carrier_id" UUID,
  ADD COLUMN IF NOT EXISTS "bus_id" UUID;

DO $$ BEGIN
    ALTER TABLE "transport_bookings" ADD CONSTRAINT "transport_bookings_carrier_id_fkey"
        FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "transport_bookings" ADD CONSTRAINT "transport_bookings_bus_id_fkey"
        FOREIGN KEY ("bus_id") REFERENCES "buses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "transport_bookings_carrier_id_idx" ON "transport_bookings"("carrier_id");
CREATE INDEX IF NOT EXISTS "transport_bookings_bus_id_idx" ON "transport_bookings"("bus_id");

-- CreateTable: tour_driver_assignments
CREATE TABLE IF NOT EXISTS "tour_driver_assignments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tour_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_driver_assignments_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "tour_driver_assignments" ADD CONSTRAINT "tour_driver_assignments_tour_id_fkey"
        FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "tour_driver_assignments" ADD CONSTRAINT "tour_driver_assignments_staff_id_fkey"
        FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "tour_driver_assignments_tour_id_staff_id_key" ON "tour_driver_assignments"("tour_id", "staff_id");
CREATE INDEX IF NOT EXISTS "tour_driver_assignments_tour_id_idx" ON "tour_driver_assignments"("tour_id");

-- AlterTable: communications — опційний FK на hotel_bookings (ручний лог листування)
ALTER TABLE "communications"
  ADD COLUMN IF NOT EXISTS "hotel_booking_id" UUID;

DO $$ BEGIN
    ALTER TABLE "communications" ADD CONSTRAINT "communications_hotel_booking_id_fkey"
        FOREIGN KEY ("hotel_booking_id") REFERENCES "hotel_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "communications_hotel_booking_id_idx" ON "communications"("hotel_booking_id");
