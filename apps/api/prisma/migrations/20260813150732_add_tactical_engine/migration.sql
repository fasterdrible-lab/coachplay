-- CreateEnum
CREATE TYPE "TacticalPossession" AS ENUM ('user', 'opponent', 'contested', 'unknown');

-- CreateEnum
CREATE TYPE "TacticalTeam" AS ENUM ('user', 'opponent');

-- CreateTable
CREATE TABLE "tactical_snapshots" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "timestamp_ms" INTEGER NOT NULL,
    "possession" "TacticalPossession" NOT NULL DEFAULT 'unknown',
    "ball_x" DOUBLE PRECISION,
    "ball_y" DOUBLE PRECISION,
    "controlled_player_id" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tactical_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tactical_players" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "tracking_id" TEXT NOT NULL,
    "team" "TacticalTeam" NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "role" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tactical_players_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tactical_snapshots_match_id_idx" ON "tactical_snapshots"("match_id");

-- CreateIndex
CREATE INDEX "tactical_snapshots_match_id_timestamp_ms_idx" ON "tactical_snapshots"("match_id", "timestamp_ms");

-- CreateIndex
CREATE INDEX "tactical_snapshots_created_at_idx" ON "tactical_snapshots"("created_at");

-- CreateIndex
CREATE INDEX "tactical_players_snapshot_id_idx" ON "tactical_players"("snapshot_id");

-- AddForeignKey
ALTER TABLE "tactical_snapshots" ADD CONSTRAINT "tactical_snapshots_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tactical_players" ADD CONSTRAINT "tactical_players_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "tactical_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
