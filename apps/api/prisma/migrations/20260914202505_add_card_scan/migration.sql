-- CreateEnum
CREATE TYPE "CardScanStatus" AS ENUM ('AUTO_IDENTIFIED', 'NEEDS_CONFIRMATION', 'NEEDS_NEW_IMAGE', 'INVALID_IMAGE');

-- CreateTable
CREATE TABLE "card_scans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "CardScanStatus" NOT NULL,
    "confidence_score" DOUBLE PRECISION,
    "matched_player_card_id" TEXT,
    "candidate_card_ids" JSONB,
    "raw_extraction" JSONB,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_scans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "card_scans_user_id_idx" ON "card_scans"("user_id");

-- CreateIndex
CREATE INDEX "card_scans_matched_player_card_id_idx" ON "card_scans"("matched_player_card_id");

-- AddForeignKey
ALTER TABLE "card_scans" ADD CONSTRAINT "card_scans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_scans" ADD CONSTRAINT "card_scans_matched_player_card_id_fkey" FOREIGN KEY ("matched_player_card_id") REFERENCES "player_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
