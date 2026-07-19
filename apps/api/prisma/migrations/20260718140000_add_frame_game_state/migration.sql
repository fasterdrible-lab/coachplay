-- CreateEnum
CREATE TYPE "FrameGameState" AS ENUM ('menu', 'match_running', 'paused', 'replay', 'post_match');

-- AlterTable
ALTER TABLE "frame_samples" ADD COLUMN     "game_state" "FrameGameState",
ADD COLUMN     "motion_score" DOUBLE PRECISION;
