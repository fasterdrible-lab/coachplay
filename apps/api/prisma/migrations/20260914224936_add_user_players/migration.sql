-- CreateTable
CREATE TABLE "user_players" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "player_card_id" TEXT NOT NULL,
    "current_level" INTEGER NOT NULL,
    "favorite_position" TEXT,
    "user_notes" TEXT,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "current_build_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_player_builds" (
    "id" TEXT NOT NULL,
    "user_player_id" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "allocation" JSONB NOT NULL,
    "computed_attributes" JSONB NOT NULL,
    "role_score" DOUBLE PRECISION NOT NULL,
    "total_points_used" INTEGER NOT NULL,
    "total_points_available" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_player_builds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_players_user_id_idx" ON "user_players"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_players_user_id_player_card_id_key" ON "user_players"("user_id", "player_card_id");

-- CreateIndex
CREATE INDEX "user_player_builds_user_player_id_idx" ON "user_player_builds"("user_player_id");

-- AddForeignKey
ALTER TABLE "user_players" ADD CONSTRAINT "user_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_players" ADD CONSTRAINT "user_players_player_card_id_fkey" FOREIGN KEY ("player_card_id") REFERENCES "player_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_player_builds" ADD CONSTRAINT "user_player_builds_user_player_id_fkey" FOREIGN KEY ("user_player_id") REFERENCES "user_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
