-- CreateEnum
CREATE TYPE "GameProvider" AS ENUM ('EFOOTBALL');

-- CreateEnum
CREATE TYPE "GameDataSourceKind" AS ENUM ('official', 'community', 'manual');

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "provider" "GameProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_versions" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "released_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_data_sources" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "GameDataSourceKind" NOT NULL,
    "base_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "games_provider_key" ON "games"("provider");

-- CreateIndex
CREATE INDEX "game_versions_game_id_idx" ON "game_versions"("game_id");

-- CreateIndex
CREATE INDEX "game_data_sources_game_id_idx" ON "game_data_sources"("game_id");

-- AddForeignKey
ALTER TABLE "game_versions" ADD CONSTRAINT "game_versions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_data_sources" ADD CONSTRAINT "game_data_sources_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
