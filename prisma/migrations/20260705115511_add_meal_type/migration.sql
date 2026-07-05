-- CreateEnum
CREATE TYPE "meal_type" AS ENUM ('RO', 'BB', 'HB', 'FB');

-- AlterTable
ALTER TABLE "booking_tourists" ADD COLUMN     "meal_type" "meal_type";

