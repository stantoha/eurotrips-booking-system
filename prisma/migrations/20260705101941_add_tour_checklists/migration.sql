-- CreateTable
CREATE TABLE "tour_checklists" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tour_id" UUID NOT NULL,
    "transport_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "transport_confirmed_at" TIMESTAMP(3),
    "hotels_all_paid" BOOLEAN NOT NULL DEFAULT false,
    "hotels_all_paid_at" TIMESTAMP(3),
    "guides_all_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "guides_all_confirmed_at" TIMESTAMP(3),
    "rooming_finalized_and_sent" BOOLEAN NOT NULL DEFAULT false,
    "rooming_finalized_and_sent_at" TIMESTAMP(3),
    "documents_generated" BOOLEAN NOT NULL DEFAULT false,
    "documents_generated_at" TIMESTAMP(3),
    "tourists_notified" BOOLEAN NOT NULL DEFAULT false,
    "tourists_notified_at" TIMESTAMP(3),
    "guide_assigned" BOOLEAN NOT NULL DEFAULT false,
    "guide_assigned_at" TIMESTAMP(3),
    "emergency_contacts_ready" BOOLEAN NOT NULL DEFAULT false,
    "emergency_contacts_ready_at" TIMESTAMP(3),
    "final_letter_sent" BOOLEAN NOT NULL DEFAULT false,
    "final_letter_sent_at" TIMESTAMP(3),
    "readiness_percent" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tour_checklists_tour_id_key" ON "tour_checklists"("tour_id");

-- CreateIndex
CREATE INDEX "tour_checklists_readiness_percent_idx" ON "tour_checklists"("readiness_percent");

-- AddForeignKey
ALTER TABLE "tour_checklists" ADD CONSTRAINT "tour_checklists_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

