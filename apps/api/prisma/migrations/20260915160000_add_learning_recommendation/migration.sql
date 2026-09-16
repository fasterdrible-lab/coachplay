-- CreateTable
CREATE TABLE "learning_recommendations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "lesson_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "dismissed_at" TIMESTAMP(3),

    CONSTRAINT "learning_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learning_recommendations_user_id_key" ON "learning_recommendations"("user_id");

-- CreateIndex
CREATE INDEX "learning_recommendations_lesson_id_idx" ON "learning_recommendations"("lesson_id");

-- AddForeignKey
ALTER TABLE "learning_recommendations" ADD CONSTRAINT "learning_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_recommendations" ADD CONSTRAINT "learning_recommendations_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
