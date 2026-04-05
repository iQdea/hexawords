CREATE TYPE "AuthProvider" AS ENUM ('EMAIL_PASSWORD', 'PASSWORDLESS', 'ANONYMOUS');
CREATE TYPE "GameMode" AS ENUM ('SINGLE', 'CAMPAIGN');
CREATE TYPE "GameComplexity" AS ENUM ('EASY', 'MIDDLE', 'HARD', 'CRAZY');
CREATE TYPE "GameStatus" AS ENUM ('ACTIVE', 'FINISHED', 'ABANDONED');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  region VARCHAR(8) NOT NULL DEFAULT 'ru'
);

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(32) NOT NULL DEFAULT 'Игрок',
  avatar_url VARCHAR(256)
);

CREATE TABLE user_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  provider "AuthProvider" NOT NULL DEFAULT 'ANONYMOUS',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  refresh_token VARCHAR(512)
);

CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  mode "GameMode" NOT NULL,
  complexity "GameComplexity",
  level INT,
  status "GameStatus" NOT NULL DEFAULT 'ACTIVE',
  score INT NOT NULL DEFAULT 0,
  word_count INT NOT NULL DEFAULT 0,
  hex_count INT NOT NULL,
  cells_per_hex INT NOT NULL DEFAULT 7,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  finished_at TIMESTAMP(3)
);
CREATE INDEX games_user_id_mode_status_idx ON games(user_id, mode, status);

CREATE TABLE cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  hex_q INT NOT NULL,
  hex_r INT NOT NULL,
  slot INT NOT NULL,
  char VARCHAR(2) NOT NULL,
  points INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(game_id, hex_q, hex_r, slot)
);
CREATE INDEX cells_game_id_is_active_idx ON cells(game_id, is_active);

CREATE TABLE game_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  word VARCHAR(64) NOT NULL,
  points INT NOT NULL,
  cell_path JSONB NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX game_words_game_id_idx ON game_words(game_id);

CREATE TABLE words (
  word VARCHAR(64) PRIMARY KEY,
  freq INT NOT NULL DEFAULT 0,
  len INT NOT NULL
);
CREATE INDEX words_len_idx ON words(len);

CREATE TABLE user_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  game_id UUID NOT NULL UNIQUE,
  points INT NOT NULL DEFAULT 0
);
CREATE INDEX user_scores_user_id_points_idx ON user_scores(user_id, points DESC);

CREATE TABLE user_word_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  word VARCHAR(64) NOT NULL,
  points INT NOT NULL,
  mode "GameMode" NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX user_word_history_user_id_points_idx ON user_word_history(user_id, points DESC);
