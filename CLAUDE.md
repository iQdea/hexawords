# Hexawords

Russian word-building game on a hexagonal grid. Players form words by picking letters from adjacent hexagons on a hex field. Think Scrabble meets honeycomb — in Russian.

---

## What Is This

Hexawords is a browser-based word game where the playing field is a cluster of hexagons (3 to 7, depending on difficulty). Each hexagon contains 7 letters (3 vowels + 4 consonants). The player taps letters across adjacent hexagons to spell Russian words. Longer and rarer words score more points. The game supports single-play (pick your difficulty) and a 31-level campaign with score targets.

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 22.17 or higher |
| pnpm | 10 or higher |
| Docker | Any recent version (for PostgreSQL + Redis) |

### Step-by-step

```bash
# 1. Start the databases
docker compose up -d postgres redis

# 2. Install all dependencies
pnpm install

# 3. Build the shared packages (types, hex-math, game-engine)
pnpm turbo build --filter='./packages/*'

# 4. Set up the database (seed dictionary)
cd apps/api
cp ../../.env .env
DATABASE_URL="postgresql://hexawords:hexawords_dev@localhost:5432/hexawords" npx ts-node src/seed/download-dict.ts
DATABASE_URL="postgresql://hexawords:hexawords_dev@localhost:5432/hexawords" npx ts-node src/seed/seed.ts
cd ../..

# 5. Start the API server (runs on port 3000)
cd apps/api && npx nest start &

# 6. Start the web dev server (runs on port 5173)
cd apps/web && pnpm dev --host
```

After step 6 open **http://localhost:5173** in your browser. The API is at **http://localhost:3000**.

---

## Project Structure

This is a **monorepo** managed with **pnpm workspaces** and **Turborepo**.

```
hexawords/
├── packages/
│   ├── types/          Shared TypeScript types, enums, DTOs
│   ├── hex-math/       Cube coordinates, adjacency O(1), grid generation (46 tests)
│   └── game-engine/    Game logic, scoring with rarity bonus, balanced letter gen (32 tests)
├── apps/
│   ├── api/            NestJS backend
│   └── web/            Vue 3 + Vite + Pinia frontend (SVG hex grid, PWA)
├── docker-compose.yml  PostgreSQL 16 + Redis 7
├── turbo.json          Turborepo task config
├── pnpm-workspace.yaml Workspace definition
└── package.json        Root scripts
```

### packages/types

Shared TypeScript types, enums, and DTOs used by both the API and the frontend. Keeps contracts in sync across the monorepo.

### packages/hex-math

All hexagonal math lives here:

- **Cube coordinates** — each hexagon is identified by (q, r, s) where q+r+s=0.
- **Adjacency** — O(1) check via `|dq|+|dr|+|ds| = 2`.
- **Grid generation** — creates hex fields of configurable size.
- **SVG layout** — converts cube coords to pixel positions for rendering.
- 46 unit tests (Vitest).

### packages/game-engine

Pure game logic with zero I/O:

- **Word validation** — the backend injects a dictionary validator function.
- **Scoring** — base points by word length, multiplied by rarity bonus (up to 3x).
- **Balanced letter generation** — each hexagon always gets 3 vowels + 4 consonants using Russian letter frequencies.
- **Streak multiplier** — consecutive valid words increase the score multiplier.
- 32 unit tests (Vitest).

### apps/api

NestJS 11 backend with these modules:

| Module | Purpose |
|--------|---------|
| **Auth** | Anonymous auto-creation, email sign-up/sign-in, account upgrade, JWT in httpOnly cookies |
| **Game** | Create game, submit word, reset, campaign progress |
| **Dictionary** | 82,750 Russian words in memory; unknown words auto-checked via ru.wiktionary.org API |
| **Leaderboard** | Global high scores |
| **User** | Profile, stats, word history |
| **Socket** | Socket.IO with per-user rooms (`user:{id}`) for real-time cell respawn events |
| **Queue** | BullMQ delayed jobs via Redis for cell respawn (500ms delay) |

16 end-to-end tests (Jest + Supertest).

### apps/web

Vue 3 SPA with:

- **Vite** build tool
- **Pinia** state management
- **Vue Router** client-side routing
- **SVG hex grid** — hexagons rendered as SVG polygons
- **PWA** — installable via vite-plugin-pwa
- Sky background with glass-morphism UI cards

---

## Architecture

### Two-level hexagonal field

The playing field has **N hexagons** (3 to 7, depending on difficulty). Each hexagon contains **7 letter cells**. So a medium (5-hex) game has 35 letters on screen.

### Word-building rules

1. Tap a letter in any hexagon — this is the first letter of the word.
2. The next letter must come from an **adjacent hexagon** (not the same one).
3. You may take only **one letter per hexagon** per step.
4. You **can** revisit a previously used hexagon, as long as you arrive from a different hex.
5. Minimum word length is **2 letters**.

### Balanced letter generation

Every hexagon is guaranteed to have **3 vowels and 4 consonants**, selected using weighted Russian letter frequency tables. This ensures playable boards.

### Dictionary and Wiktionary auto-discovery

- On startup the API loads **82,750 Russian words** into an in-memory Set for O(1) lookup.
- If a submitted word is not in the dictionary, the API queries the **ru.wiktionary.org API** to check if it is a real word. If Wiktionary confirms it, the word is added to the database automatically.

### Rarity scoring

Words are scored by length, then multiplied by a rarity factor:

| Rarity | Multiplier | Meaning |
|--------|-----------|---------|
| Common | 1x | Many players found this word |
| Uncommon | 2x | Few players found it |
| Rare | 3x | Almost nobody found it |

Submitting a word you already found in the same game is allowed but gives only **25%** of the normal score.

### Streak multiplier

Finding consecutive valid words increases a streak multiplier, rewarding sustained play.

### Cell respawn

When a letter is used, its cell is temporarily consumed. **BullMQ** schedules a delayed job (500ms) via Redis, and when it fires, a new letter appears in that cell. The frontend is notified via **Socket.IO** (`cell:respawned` event).

### Authentication

- On first visit, an **anonymous account** is auto-created.
- Users can optionally **upgrade** to a full account with email + password.
- Auth uses **JWT** stored in **httpOnly cookies** (access token 15m, refresh token 7d).
- Passport.js JWT strategy on the backend.

---

## Commands

### Root (from project root)

```bash
pnpm turbo build          # Build all packages and apps
pnpm turbo test           # Run all unit and e2e tests
pnpm turbo dev            # Start all dev servers (API + Web)
pnpm turbo lint           # Lint everything
pnpm turbo typecheck      # Type-check everything
```

### API (from apps/api/)

```bash
npx nest start                                      # Start server
npx nest start --watch                               # Start with hot reload
npx jest --config test/jest-e2e.json --forceExit     # Run e2e tests

# Database
DATABASE_URL="postgresql://hexawords:hexawords_dev@localhost:5432/hexawords" npx ts-node src/seed/seed.ts  # Seed dictionary
DATABASE_URL="postgresql://hexawords:hexawords_dev@localhost:5432/hexawords" npx ts-node src/seed/seed.ts  # Seed dictionary
```

### Web (from apps/web/)

```bash
pnpm dev                  # Vite dev server (port 5173)
pnpm dev --host           # Expose to network
pnpm build                # Production build
pnpm preview              # Preview production build
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Vue 3 | UI framework |
| Frontend | Vite | Build tool and dev server |
| Frontend | Pinia | State management |
| Frontend | Vue Router | Client-side routing |
| Frontend | Socket.IO Client | Real-time updates |
| Frontend | vite-plugin-pwa | Progressive Web App |
| Backend | NestJS 11 | API framework |
| Backend | pg (node-postgres) | Raw SQL with typed results |
| Backend | PostgreSQL 16 | Primary database |
| Backend | Redis 7 | Queue backend / caching |
| Backend | BullMQ | Delayed job processing |
| Backend | Socket.IO | WebSocket server |
| Auth | Passport.js | JWT authentication |
| Auth | bcrypt | Password hashing |
| Testing | Vitest | Unit tests (packages) |
| Testing | Jest + Supertest | E2E tests (API) |
| Infra | Docker Compose | Local dev environment |
| Infra | nginx | Production reverse proxy |
| Monorepo | pnpm workspaces | Package management |
| Monorepo | Turborepo | Build orchestration |

---

## Environment Variables

All variables are defined in the root `.env` file. Copy it into `apps/api/` before running.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://hexawords:hexawords_dev@localhost:5432/hexawords` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `REDIS_HOST` | `localhost` | Redis host (used by BullMQ) |
| `REDIS_PORT` | `6379` | Redis port (used by BullMQ) |
| `JWT_SECRET` | `dev-secret-change-in-prod` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | `dev-refresh-secret-change-in-prod` | Secret for signing refresh tokens |
| `JWT_EXPIRATION` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRATION` | `7d` | Refresh token lifetime |
| `PORT` | `3000` | API server port |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |

---

## API Endpoints

### Auth — `POST/GET /auth/...`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/anonymous` | No | Create anonymous account, returns JWT cookies |
| POST | `/auth/sign-up` | No | Register with email + password |
| POST | `/auth/sign-in` | No | Login with email + password |
| POST | `/auth/upgrade` | Yes | Upgrade anonymous account to full account |
| GET | `/auth/me` | Yes | Get current user info |
| POST | `/auth/refresh` | Cookie | Refresh access token using refresh cookie |
| POST | `/auth/sign-out` | Yes | Clear auth cookies |

### Games — `POST/GET /games/...`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/games/new` | Yes | Create a new game (pass difficulty / campaign level) |
| POST | `/games/:id/submit-word` | Yes | Submit a word for scoring |
| POST | `/games/:id/reset` | Yes | Shuffle all letters, reset score and words |
| GET | `/games/campaign/progress` | Yes | Get campaign level progress |
| GET | `/games/:id` | Yes | Get game state (field, score, words found) |

### Leaderboard — `GET /leaderboard`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/leaderboard` | No | Get global high-score leaderboard |

### User — `GET/PATCH /user/...`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/user/profile` | Yes | Get user profile |
| PATCH | `/user/profile` | Yes | Update display name or other profile fields |
| GET | `/user/stats` | Yes | Get game statistics (games played, words found, etc.) |
| GET | `/user/words` | Yes | Get history of all words submitted by this user |

### WebSocket Events (Socket.IO)

| Event | Direction | Description |
|-------|-----------|-------------|
| `cell:respawned` | Server -> Client | A used cell has been refilled with a new letter |

---

## Conventions

- **Russian language** for all user-facing strings.
- Packages use **CommonJS** module format (NestJS compatibility).
- All game state mutations wrapped in `db.transaction().execute()`.
- WebSocket events use `namespace:action` naming (e.g. `cell:respawned`).
- API errors return Russian messages for auth/validation.
