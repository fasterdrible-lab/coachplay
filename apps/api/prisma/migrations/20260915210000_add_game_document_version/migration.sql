-- CreateTable
CREATE TABLE "game_document_versions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "content_hash" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "change_detected" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_document_versions_document_id_idx" ON "game_document_versions"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_document_versions_document_id_version_number_key" ON "game_document_versions"("document_id", "version_number");

-- AddForeignKey
ALTER TABLE "game_document_versions" ADD CONSTRAINT "game_document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "game_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
