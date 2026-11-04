-- AlterTable
ALTER TABLE "users" ADD COLUMN "cpf" VARCHAR(11);

-- CreateIndex
CREATE UNIQUE INDEX "users_cpf_key" ON "users"("cpf");

-- CreateEnum
CREATE TYPE "RoboticsSlotStatus" AS ENUM ('CONFIRMED', 'WAITLIST', 'CANCELLED');

-- CreateTable
CREATE TABLE "robotics_modalities" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slot_limit" INTEGER NOT NULL DEFAULT 16,
    "display_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "robotics_modalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "robotics_teams" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "advisor_user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "advisor_name" TEXT NOT NULL,
    "advisor_email" TEXT NOT NULL,
    "advisor_phone" TEXT NOT NULL,
    "advisor_document" TEXT NOT NULL,
    "rules_accepted_at" TIMESTAMP(3) NOT NULL,
    "withdrawn_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "robotics_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "robotics_team_members" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "cpf" VARCHAR(11) NOT NULL,
    "birth_date" DATE NOT NULL,
    "document" TEXT NOT NULL,
    "user_id" UUID,
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "robotics_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "robotics_team_modalities" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "modality_id" UUID NOT NULL,
    "status" "RoboticsSlotStatus" NOT NULL DEFAULT 'CONFIRMED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "robotics_team_modalities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "robotics_modalities_event_id_name_key" ON "robotics_modalities"("event_id", "name");

-- CreateIndex
CREATE INDEX "robotics_modalities_event_id_display_order_idx" ON "robotics_modalities"("event_id", "display_order");

-- CreateIndex
CREATE INDEX "robotics_teams_event_id_idx" ON "robotics_teams"("event_id");

-- CreateIndex
CREATE INDEX "robotics_teams_advisor_user_id_idx" ON "robotics_teams"("advisor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "robotics_teams_event_name_active" ON "robotics_teams"("event_id", lower("name")) WHERE "withdrawn_at" IS NULL;

-- CreateIndex
CREATE INDEX "robotics_team_members_team_id_idx" ON "robotics_team_members"("team_id");

-- CreateIndex
CREATE INDEX "robotics_team_members_user_id_idx" ON "robotics_team_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "robotics_team_members_event_cpf_active" ON "robotics_team_members"("event_id", "cpf") WHERE "released_at" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "robotics_team_modalities_team_id_modality_id_key" ON "robotics_team_modalities"("team_id", "modality_id");

-- CreateIndex
CREATE INDEX "robotics_team_modalities_modality_id_status_idx" ON "robotics_team_modalities"("modality_id", "status");

-- AddForeignKey
ALTER TABLE "robotics_modalities" ADD CONSTRAINT "robotics_modalities_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robotics_teams" ADD CONSTRAINT "robotics_teams_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robotics_teams" ADD CONSTRAINT "robotics_teams_advisor_user_id_fkey" FOREIGN KEY ("advisor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robotics_team_members" ADD CONSTRAINT "robotics_team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "robotics_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robotics_team_members" ADD CONSTRAINT "robotics_team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robotics_team_modalities" ADD CONSTRAINT "robotics_team_modalities_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "robotics_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robotics_team_modalities" ADD CONSTRAINT "robotics_team_modalities_modality_id_fkey" FOREIGN KEY ("modality_id") REFERENCES "robotics_modalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the three official modalities for the published MDX event.
INSERT INTO "robotics_modalities" ("id", "event_id", "name", "slot_limit", "display_order", "updated_at")
SELECT gen_random_uuid(), event.id, modality.name, 16, modality.display_order, CURRENT_TIMESTAMP
FROM "events" AS event
CROSS JOIN (
  VALUES
    ('Caça Balão', 1),
    ('Sumô', 2),
    ('Corrida com obstáculos', 3)
) AS modality(name, display_order)
WHERE event.slug = 'mdx-2026';
