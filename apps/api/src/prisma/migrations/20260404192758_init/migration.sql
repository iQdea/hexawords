-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL_PASSWORD', 'PASSWORDLESS', 'ANONYMOUS');

-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('SINGLE', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "GameComplexity" AS ENUM ('EASY', 'MIDDLE', 'HARD', 'CRAZY');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('ACTIVE', 'FINISHED', 'ABANDONED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "region" VARCHAR(8) NOT NULL DEFAULT 'ru',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "nickname" VARCHAR(32) NOT NULL DEFAULT 'Игрок',
    "avatar_url" VARCHAR(256),

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_auth" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "email" VARCHAR(255),
    "password_hash" VARCHAR(255),
    "provider" "AuthProvider" NOT NULL DEFAULT 'ANONYMOUS',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "refresh_token" VARCHAR(512),

    CONSTRAINT "user_auth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "mode" "GameMode" NOT NULL,
    "complexity" "GameComplexity",
    "level" INTEGER,
    "status" "GameStatus" NOT NULL DEFAULT 'ACTIVE',
    "score" INTEGER NOT NULL DEFAULT 0,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "grid_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cells" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "q" INTEGER NOT NULL,
    "r" INTEGER NOT NULL,
    "char" VARCHAR(2) NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cells_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_words" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "word" VARCHAR(64) NOT NULL,
    "points" INTEGER NOT NULL,
    "cell_path" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "words" (
    "word" VARCHAR(64) NOT NULL,
    "freq" INTEGER NOT NULL DEFAULT 0,
    "len" INTEGER NOT NULL,

    CONSTRAINT "words_pkey" PRIMARY KEY ("word")
);

-- CreateTable
CREATE TABLE "user_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_word_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "word" VARCHAR(64) NOT NULL,
    "points" INTEGER NOT NULL,
    "mode" "GameMode" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_word_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_auth_user_id_key" ON "user_auth"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_auth_email_key" ON "user_auth"("email");

-- CreateIndex
CREATE INDEX "games_user_id_mode_status_idx" ON "games"("user_id", "mode", "status");

-- CreateIndex
CREATE INDEX "cells_game_id_is_active_idx" ON "cells"("game_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "cells_game_id_q_r_key" ON "cells"("game_id", "q", "r");

-- CreateIndex
CREATE INDEX "game_words_game_id_idx" ON "game_words"("game_id");

-- CreateIndex
CREATE INDEX "words_len_idx" ON "words"("len");

-- CreateIndex
CREATE UNIQUE INDEX "user_scores_game_id_key" ON "user_scores"("game_id");

-- CreateIndex
CREATE INDEX "user_scores_user_id_points_idx" ON "user_scores"("user_id", "points" DESC);

-- CreateIndex
CREATE INDEX "user_word_history_user_id_points_idx" ON "user_word_history"("user_id", "points" DESC);

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_auth" ADD CONSTRAINT "user_auth_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cells" ADD CONSTRAINT "cells_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_words" ADD CONSTRAINT "game_words_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scores" ADD CONSTRAINT "user_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_word_history" ADD CONSTRAINT "user_word_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
