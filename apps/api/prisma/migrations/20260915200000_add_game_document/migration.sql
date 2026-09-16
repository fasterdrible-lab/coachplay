-- CreateEnum
CREATE TYPE "GameDocumentType" AS ENUM ('CONTROLS', 'PLAYER_PROGRESSION', 'PLAYER_SKILLS', 'POSITION_TRAINING', 'PLAY_STYLE', 'MANAGER', 'GAMEPLAY', 'VERSION_NOTES', 'BALANCE_CHANGE', 'GENERAL_GUIDE');

-- CreateTable
CREATE TABLE "game_documents" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "document_type" "GameDocumentType" NOT NULL,
    "language" TEXT NOT NULL,
    "game_version" TEXT,
    "published_at" TIMESTAMP(3),
    "retrieved_at" TIMESTAMP(3) NOT NULL,
    "content_hash" TEXT NOT NULL,
    "raw_content" TEXT NOT NULL,
    "normalized_content" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_documents_source_id_idx" ON "game_documents"("source_id");

-- CreateIndex
CREATE INDEX "game_documents_game_id_idx" ON "game_documents"("game_id");

-- CreateIndex
CREATE INDEX "game_documents_document_type_idx" ON "game_documents"("document_type");

-- CreateIndex
CREATE UNIQUE INDEX "game_documents_game_id_url_key" ON "game_documents"("game_id", "url");

-- AddForeignKey
ALTER TABLE "game_documents" ADD CONSTRAINT "game_documents_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "documentation_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_documents" ADD CONSTRAINT "game_documents_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
