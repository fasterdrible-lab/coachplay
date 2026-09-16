-- CreateEnum
CREATE TYPE "DocumentationSourceType" AS ENUM ('OFFICIAL', 'VERIFIED_COMMUNITY', 'COMMUNITY', 'MANUAL');

-- CreateEnum
CREATE TYPE "DocumentationTrustLevel" AS ENUM ('AUTHORITATIVE', 'HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "documentation_sources" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "source_type" "DocumentationSourceType" NOT NULL,
    "language" TEXT NOT NULL,
    "trust_level" "DocumentationTrustLevel" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_checked_at" TIMESTAMP(3),
    "last_success_at" TIMESTAMP(3),
    "last_failure_at" TIMESTAMP(3),
    "checksum" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentation_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documentation_sources_game_id_idx" ON "documentation_sources"("game_id");

-- CreateIndex
CREATE INDEX "documentation_sources_domain_idx" ON "documentation_sources"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "documentation_sources_game_id_url_key" ON "documentation_sources"("game_id", "url");

-- AddForeignKey
ALTER TABLE "documentation_sources" ADD CONSTRAINT "documentation_sources_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
