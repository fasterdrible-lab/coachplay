-- CreateEnum
CREATE TYPE "PackCurrency" AS ENUM ('coins', 'gp');

-- CreateEnum
CREATE TYPE "EconomyRecommendationResult" AS ENUM ('RECOMMENDED', 'NEUTRAL', 'NOT_RECOMMENDED', 'INSUFFICIENT_DATA');

-- CreateTable
CREATE TABLE "packs" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "currency" "PackCurrency" NOT NULL,
    "odds_source" TEXT,
    "odds_verified_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pack_target_players" (
    "id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,
    "player_card_id" TEXT NOT NULL,
    "probability" DOUBLE PRECISION,

    CONSTRAINT "pack_target_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "economy_recommendations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,
    "recommendation" "EconomyRecommendationResult" NOT NULL,
    "score" DOUBLE PRECISION,
    "explanation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "economy_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "packs_game_id_external_id_key" ON "packs"("game_id", "external_id");

-- CreateIndex
CREATE INDEX "pack_target_players_pack_id_idx" ON "pack_target_players"("pack_id");

-- CreateIndex
CREATE UNIQUE INDEX "pack_target_players_pack_id_player_card_id_key" ON "pack_target_players"("pack_id", "player_card_id");

-- CreateIndex
CREATE INDEX "economy_recommendations_user_id_idx" ON "economy_recommendations"("user_id");

-- CreateIndex
CREATE INDEX "economy_recommendations_pack_id_idx" ON "economy_recommendations"("pack_id");

-- AddForeignKey
ALTER TABLE "packs" ADD CONSTRAINT "packs_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_target_players" ADD CONSTRAINT "pack_target_players_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_target_players" ADD CONSTRAINT "pack_target_players_player_card_id_fkey" FOREIGN KEY ("player_card_id") REFERENCES "player_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "economy_recommendations" ADD CONSTRAINT "economy_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "economy_recommendations" ADD CONSTRAINT "economy_recommendations_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
