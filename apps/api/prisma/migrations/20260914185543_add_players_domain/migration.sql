-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "nationality" TEXT,
    "preferred_foot" TEXT,
    "height" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_cards" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "card_type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "overall_base" INTEGER NOT NULL,
    "max_level" INTEGER NOT NULL,
    "position" TEXT NOT NULL,
    "image_url" TEXT,
    "release_date" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "data_version" TEXT NOT NULL,
    "source" TEXT,
    "source_version" TEXT,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "last_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_positions" (
    "id" TEXT NOT NULL,
    "player_card_id" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "player_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_stats" (
    "id" TEXT NOT NULL,
    "player_card_id" TEXT NOT NULL,
    "stat_key" TEXT NOT NULL,
    "base_value" INTEGER NOT NULL,
    "max_value" INTEGER NOT NULL,

    CONSTRAINT "player_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_skills" (
    "id" TEXT NOT NULL,
    "player_card_id" TEXT NOT NULL,
    "skill_key" TEXT NOT NULL,

    CONSTRAINT "player_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_play_styles" (
    "id" TEXT NOT NULL,
    "player_card_id" TEXT NOT NULL,
    "play_style_key" TEXT NOT NULL,
    "tier" TEXT,

    CONSTRAINT "player_play_styles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_versions" (
    "id" TEXT NOT NULL,
    "player_card_id" TEXT NOT NULL,
    "data_version" TEXT NOT NULL,
    "source" TEXT,
    "source_version" TEXT,
    "snapshot" JSONB NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "players_game_id_idx" ON "players"("game_id");

-- CreateIndex
CREATE INDEX "players_normalized_name_idx" ON "players"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "players_game_id_external_id_key" ON "players"("game_id", "external_id");

-- CreateIndex
CREATE INDEX "player_cards_player_id_idx" ON "player_cards"("player_id");

-- CreateIndex
CREATE INDEX "player_cards_position_idx" ON "player_cards"("position");

-- CreateIndex
CREATE INDEX "player_cards_card_type_idx" ON "player_cards"("card_type");

-- CreateIndex
CREATE UNIQUE INDEX "player_cards_player_id_external_id_key" ON "player_cards"("player_id", "external_id");

-- CreateIndex
CREATE INDEX "player_positions_player_card_id_idx" ON "player_positions"("player_card_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_positions_player_card_id_position_key" ON "player_positions"("player_card_id", "position");

-- CreateIndex
CREATE INDEX "player_stats_player_card_id_idx" ON "player_stats"("player_card_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_stats_player_card_id_stat_key_key" ON "player_stats"("player_card_id", "stat_key");

-- CreateIndex
CREATE INDEX "player_skills_player_card_id_idx" ON "player_skills"("player_card_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_skills_player_card_id_skill_key_key" ON "player_skills"("player_card_id", "skill_key");

-- CreateIndex
CREATE INDEX "player_play_styles_player_card_id_idx" ON "player_play_styles"("player_card_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_play_styles_player_card_id_play_style_key_key" ON "player_play_styles"("player_card_id", "play_style_key");

-- CreateIndex
CREATE INDEX "card_versions_player_card_id_idx" ON "card_versions"("player_card_id");

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_cards" ADD CONSTRAINT "player_cards_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_positions" ADD CONSTRAINT "player_positions_player_card_id_fkey" FOREIGN KEY ("player_card_id") REFERENCES "player_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_player_card_id_fkey" FOREIGN KEY ("player_card_id") REFERENCES "player_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_skills" ADD CONSTRAINT "player_skills_player_card_id_fkey" FOREIGN KEY ("player_card_id") REFERENCES "player_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_play_styles" ADD CONSTRAINT "player_play_styles_player_card_id_fkey" FOREIGN KEY ("player_card_id") REFERENCES "player_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_versions" ADD CONSTRAINT "card_versions_player_card_id_fkey" FOREIGN KEY ("player_card_id") REFERENCES "player_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
