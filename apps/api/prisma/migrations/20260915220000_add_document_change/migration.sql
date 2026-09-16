-- CreateEnum
CREATE TYPE "DocumentChangeType" AS ENUM ('TEXT_ADDED', 'TEXT_REMOVED', 'TEXT_MODIFIED', 'SECTION_ADDED', 'SECTION_REMOVED');

-- CreateEnum
CREATE TYPE "DocumentChangeReviewStatus" AS ENUM ('PENDING', 'REVIEWED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "document_changes" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "old_version" INTEGER NOT NULL,
    "new_version" INTEGER NOT NULL,
    "change_type" "DocumentChangeType" NOT NULL,
    "change_summary" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "review_status" "DocumentChangeReviewStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "document_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_changes_document_id_idx" ON "document_changes"("document_id");

-- CreateIndex
CREATE INDEX "document_changes_review_status_idx" ON "document_changes"("review_status");

-- AddForeignKey
ALTER TABLE "document_changes" ADD CONSTRAINT "document_changes_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "game_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
