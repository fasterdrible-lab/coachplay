-- CreateEnum
CREATE TYPE "DataImportStatus" AS ENUM ('processing', 'done', 'partial', 'failed');

-- CreateEnum
CREATE TYPE "DataImportChangeType" AS ENUM ('player_created', 'card_created', 'card_updated', 'card_removed');

-- CreateTable
CREATE TABLE "data_import_runs" (
    "id" TEXT NOT NULL,
    "game_data_source_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_version" TEXT NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL,
    "checksum" TEXT NOT NULL,
    "record_count" INTEGER NOT NULL,
    "created_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "removed_count" INTEGER NOT NULL DEFAULT 0,
    "unchanged_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "status" "DataImportStatus" NOT NULL DEFAULT 'processing',
    "error_detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_import_changes" (
    "id" TEXT NOT NULL,
    "data_import_run_id" TEXT NOT NULL,
    "change_type" "DataImportChangeType" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "diff" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_import_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_import_runs_game_data_source_id_idx" ON "data_import_runs"("game_data_source_id");

-- CreateIndex
CREATE INDEX "data_import_runs_created_at_idx" ON "data_import_runs"("created_at");

-- CreateIndex
CREATE INDEX "data_import_changes_data_import_run_id_idx" ON "data_import_changes"("data_import_run_id");

-- AddForeignKey
ALTER TABLE "data_import_runs" ADD CONSTRAINT "data_import_runs_game_data_source_id_fkey" FOREIGN KEY ("game_data_source_id") REFERENCES "game_data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_import_changes" ADD CONSTRAINT "data_import_changes_data_import_run_id_fkey" FOREIGN KEY ("data_import_run_id") REFERENCES "data_import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
