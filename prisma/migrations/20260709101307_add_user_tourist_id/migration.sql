-- add_user_tourist_id
-- Прив'язка User(role=tourist) до Tourist для JWT touristId (BR-12 self-service,
-- LiqPay tourist ownership check). NULL для всіх інших ролей.

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tourist_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_tourist_id_key" ON "users"("tourist_id");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "users" ADD CONSTRAINT "users_tourist_id_fkey" FOREIGN KEY ("tourist_id") REFERENCES "tourists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
