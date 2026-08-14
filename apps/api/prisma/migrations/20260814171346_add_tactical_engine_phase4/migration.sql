-- CreateEnum
CREATE TYPE "TacticalPatternSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "tactical_patterns" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "severity" "TacticalPatternSeverity" NOT NULL,
    "first_detected_at" TIMESTAMP(3) NOT NULL,
    "last_detected_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tactical_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tactical_profiles" (
    "user_id" TEXT NOT NULL,
    "dominant_principles" JSONB NOT NULL,
    "neglected_principles" JSONB NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tactical_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "tactical_patterns_user_id_idx" ON "tactical_patterns"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tactical_patterns_user_id_pattern_key" ON "tactical_patterns"("user_id", "pattern");

-- AddForeignKey
ALTER TABLE "tactical_patterns" ADD CONSTRAINT "tactical_patterns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tactical_profiles" ADD CONSTRAINT "tactical_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
