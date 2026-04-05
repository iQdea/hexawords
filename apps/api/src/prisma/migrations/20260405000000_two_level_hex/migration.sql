-- Rename columns in games
ALTER TABLE "games" RENAME COLUMN "grid_size" TO "hex_count";
ALTER TABLE "games" ADD COLUMN "cells_per_hex" INTEGER NOT NULL DEFAULT 7;

-- Rename columns in cells
ALTER TABLE "cells" RENAME COLUMN "q" TO "hex_q";
ALTER TABLE "cells" RENAME COLUMN "r" TO "hex_r";
ALTER TABLE "cells" ADD COLUMN "slot" INTEGER NOT NULL DEFAULT 0;

-- Drop old unique constraint/index (may be constraint or index depending on Prisma version)
ALTER TABLE "cells" DROP CONSTRAINT IF EXISTS "cells_game_id_q_r_key";
DROP INDEX IF EXISTS "cells_game_id_q_r_key";

-- Add new unique constraint
ALTER TABLE "cells" ADD CONSTRAINT "cells_game_id_hex_q_hex_r_slot_key" UNIQUE ("game_id", "hex_q", "hex_r", "slot");
