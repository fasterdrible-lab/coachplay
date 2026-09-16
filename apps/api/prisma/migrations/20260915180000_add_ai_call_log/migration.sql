-- CreateTable
CREATE TABLE "ai_call_logs" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "provider" TEXT,
    "success" BOOLEAN NOT NULL,
    "cost_estimate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL,
    "error_message" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_call_logs_feature_idx" ON "ai_call_logs"("feature");

-- CreateIndex
CREATE INDEX "ai_call_logs_user_id_idx" ON "ai_call_logs"("user_id");

-- CreateIndex
CREATE INDEX "ai_call_logs_created_at_idx" ON "ai_call_logs"("created_at");

-- AddForeignKey
ALTER TABLE "ai_call_logs" ADD CONSTRAINT "ai_call_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
