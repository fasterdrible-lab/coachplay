-- CreateEnum
CREATE TYPE "CaptureSourceType" AS ENUM ('window', 'monitor', 'region');

-- CreateEnum
CREATE TYPE "CaptureSessionStatus" AS ENUM ('starting', 'running', 'paused', 'stopped', 'failed');

-- CreateEnum
CREATE TYPE "FrameAnalysisStatus" AS ENUM ('pending', 'analyzed', 'skipped', 'failed');

-- CreateEnum
CREATE TYPE "SegmentReason" AS ENUM ('event_detected', 'manual', 'periodic');

-- CreateEnum
CREATE TYPE "SegmentStatus" AS ENUM ('pending', 'processing', 'done', 'failed');

-- CreateEnum
CREATE TYPE "FeedbackChannel" AS ENUM ('text', 'voice', 'overlay', 'report');

-- AlterTable
ALTER TABLE "game_events" ADD COLUMN     "capture_session_id" TEXT,
ADD COLUMN     "evidence" JSONB,
ADD COLUMN     "segment_id" TEXT;

-- CreateTable
CREATE TABLE "capture_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "match_id" TEXT,
    "source_type" "CaptureSourceType" NOT NULL,
    "source_name" TEXT NOT NULL,
    "resolution_width" INTEGER,
    "resolution_height" INTEGER,
    "capture_fps" INTEGER NOT NULL DEFAULT 2,
    "analysis_fps" INTEGER NOT NULL DEFAULT 1,
    "status" "CaptureSessionStatus" NOT NULL DEFAULT 'starting',
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capture_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frame_samples" (
    "id" TEXT NOT NULL,
    "capture_session_id" TEXT NOT NULL,
    "timestamp_ms" INTEGER NOT NULL,
    "frame_path" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "confidence_score" DOUBLE PRECISION,
    "analysis_status" "FrameAnalysisStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "frame_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_segments" (
    "id" TEXT NOT NULL,
    "capture_session_id" TEXT NOT NULL,
    "match_id" TEXT,
    "start_timestamp_ms" INTEGER NOT NULL,
    "end_timestamp_ms" INTEGER NOT NULL,
    "file_path" TEXT NOT NULL,
    "reason" "SegmentReason" NOT NULL DEFAULT 'manual',
    "status" "SegmentStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_feedbacks" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "event_id" TEXT,
    "feedback_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "delivered_channel" "FeedbackChannel" NOT NULL,
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "capture_sessions_user_id_idx" ON "capture_sessions"("user_id");

-- CreateIndex
CREATE INDEX "capture_sessions_match_id_idx" ON "capture_sessions"("match_id");

-- CreateIndex
CREATE INDEX "capture_sessions_status_idx" ON "capture_sessions"("status");

-- CreateIndex
CREATE INDEX "frame_samples_capture_session_id_idx" ON "frame_samples"("capture_session_id");

-- CreateIndex
CREATE INDEX "video_segments_capture_session_id_idx" ON "video_segments"("capture_session_id");

-- CreateIndex
CREATE INDEX "video_segments_match_id_idx" ON "video_segments"("match_id");

-- CreateIndex
CREATE INDEX "coach_feedbacks_match_id_idx" ON "coach_feedbacks"("match_id");

-- CreateIndex
CREATE INDEX "game_events_capture_session_id_idx" ON "game_events"("capture_session_id");

-- AddForeignKey
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_capture_session_id_fkey" FOREIGN KEY ("capture_session_id") REFERENCES "capture_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "video_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture_sessions" ADD CONSTRAINT "capture_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture_sessions" ADD CONSTRAINT "capture_sessions_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frame_samples" ADD CONSTRAINT "frame_samples_capture_session_id_fkey" FOREIGN KEY ("capture_session_id") REFERENCES "capture_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_segments" ADD CONSTRAINT "video_segments_capture_session_id_fkey" FOREIGN KEY ("capture_session_id") REFERENCES "capture_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_segments" ADD CONSTRAINT "video_segments_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_feedbacks" ADD CONSTRAINT "coach_feedbacks_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_feedbacks" ADD CONSTRAINT "coach_feedbacks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "game_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
