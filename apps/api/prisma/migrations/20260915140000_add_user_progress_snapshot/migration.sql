-- CreateTable
CREATE TABLE "user_progress_snapshots" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metrics" JSONB NOT NULL,
    "formula_version" TEXT NOT NULL,

    CONSTRAINT "user_progress_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_progress_snapshots_user_id_idx" ON "user_progress_snapshots"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_progress_snapshots_user_id_game_id_key" ON "user_progress_snapshots"("user_id", "game_id");

-- AddForeignKey
ALTER TABLE "user_progress_snapshots" ADD CONSTRAINT "user_progress_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_progress_snapshots" ADD CONSTRAINT "user_progress_snapshots_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
