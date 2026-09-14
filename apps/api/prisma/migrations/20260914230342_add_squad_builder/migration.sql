-- CreateTable
CREATE TABLE "formations" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formation_positions" (
    "id" TEXT NOT NULL,
    "formation_id" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "formation_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_squads" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formation_id" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_squads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "squad_players" (
    "id" TEXT NOT NULL,
    "user_squad_id" TEXT NOT NULL,
    "user_player_id" TEXT NOT NULL,
    "slot" TEXT,
    "is_starting" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "squad_players_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "formations_game_id_code_key" ON "formations"("game_id", "code");

-- CreateIndex
CREATE INDEX "formation_positions_formation_id_idx" ON "formation_positions"("formation_id");

-- CreateIndex
CREATE UNIQUE INDEX "formation_positions_formation_id_slot_key" ON "formation_positions"("formation_id", "slot");

-- CreateIndex
CREATE INDEX "user_squads_user_id_idx" ON "user_squads"("user_id");

-- CreateIndex
CREATE INDEX "squad_players_user_squad_id_idx" ON "squad_players"("user_squad_id");

-- CreateIndex
CREATE UNIQUE INDEX "squad_players_user_squad_id_user_player_id_key" ON "squad_players"("user_squad_id", "user_player_id");

-- AddForeignKey
ALTER TABLE "formations" ADD CONSTRAINT "formations_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formation_positions" ADD CONSTRAINT "formation_positions_formation_id_fkey" FOREIGN KEY ("formation_id") REFERENCES "formations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_squads" ADD CONSTRAINT "user_squads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_squads" ADD CONSTRAINT "user_squads_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_squads" ADD CONSTRAINT "user_squads_formation_id_fkey" FOREIGN KEY ("formation_id") REFERENCES "formations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "squad_players" ADD CONSTRAINT "squad_players_user_squad_id_fkey" FOREIGN KEY ("user_squad_id") REFERENCES "user_squads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "squad_players" ADD CONSTRAINT "squad_players_user_player_id_fkey" FOREIGN KEY ("user_player_id") REFERENCES "user_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
