# AI Manager FM

Football management game where you (the player) manage one team's tactics, while every
other team in the league is managed by an AI Agent (Gemini). Matches are simulated by a
deterministic probabilistic engine and visualized as a 2D pitch view (circles = players,
ala Football Manager).

## Stack

- Next.js 14 (App Router, API routes)
- PostgreSQL + Prisma
- Gemini 2.0 Flash (free tier) for AI manager tactics
- Canvas-based 2D pitch renderer (no game engine dependency)

---

## 1. Prerequisites

- Node.js 18+ and npm
- PostgreSQL running locally (or accessible via connection string)
- A free Gemini API key — get one at https://aistudio.google.com/app/apikey

---

## 2. Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
```

Edit `.env` and set:

```env
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/ai_manager_fm"
GEMINI_API_KEY="your-actual-gemini-key"
```

If you don't have a `ai_manager_fm` database yet, create it:

```bash
# using psql
psql -U postgres -c "CREATE DATABASE ai_manager_fm;"
```

---

## 3. Database migration & seed

```bash
# Create tables from the Prisma schema
npx prisma migrate dev --name init

# Seed the league: 8 teams, 18 players each.
# Team #1 ("Ironclad FC") is marked as YOUR team (isUserControlled = true).
 ```

The seed script prints the league ID — note it if you want to query the DB directly,
but the app auto-discovers the single seeded league via `/api/leagues/default`.

---

## 4. Generate the season schedule

Start the dev server first:

```bash
npm run dev
```

Then generate fixtures (one-time, run once per league):

```bash
curl -X POST http://localhost:3000/api/leagues/<LEAGUE_ID>/generate-fixtures \
  -H "Content-Type: application/json" \
  -d '{"doubleRound": false}'
```

Replace `<LEAGUE_ID>` with the ID printed by the seed script (or query
`GET /api/leagues/default` to find it). `doubleRound: true` generates a full
home-and-away season (14 rounds for 8 teams) instead of single round-robin (7 rounds).

---

## 5. Play

Open **http://localhost:3000** in your browser.

- The home page shows the league table and fixture list.
- Fixtures involving your team (★ Ironclad FC) show a tactics form — pick formation,
  starting XI, mentality, and instructions, then click **Confirm Tactics** followed by
  **Kick Off**.
- Fixtures between two AI teams can be simulated directly by clicking **Kick Off**
  (Gemini generates tactics for both sides automatically on first use, then caches them
  per team for the season).
- After simulating, you'll see the 2D pitch view with animated player/ball positions,
  a live commentary feed, and an **AI Decision Log** tab showing each manager's
  formation, instructions, and reasoning.

---

## 6. Simulating a full round from the command line (optional)

Useful for fast-forwarding AI-vs-AI fixtures without clicking through the UI:

```bash
npm run sim:round 1   # simulates all SCHEDULED fixtures in round 1
```

If your team has a fixture in that round, the script skips it with a message —
submit your tactics via the UI first, then re-run, or simulate that one fixture
manually from its match page.

---

## Project structure

```
app/
  page.tsx                          # League table + fixture list
  match/[id]/page.tsx               # Tactics form (pre-match) / Pitch view (post-match)
  api/
    leagues/default/                # Auto-discover the seeded league
    leagues/[id]/generate-fixtures/ # Round-robin schedule generator
    leagues/[id]/table/             # Standings computed from simulated fixtures
    fixtures/[id]/                  # Fixture detail (events, tactics, scores)
    fixtures/[id]/tactics/          # Player submits their tactics (POST/GET)
    fixtures/[id]/simulate/         # Run the match engine, persist result
    teams/[id]/squad/               # Squad list for tactics form

lib/
  match-engine/
    types.ts          # Shared contract: MatchEvent, TacticsInput, etc.
    simulate.ts        # Deterministic seeded match simulation
    seedrandom.ts       # Lightweight seeded PRNG (no external dep)
    formations.ts      # Formation string -> pitch coordinates
  ai-agent/
    generate-tactics.ts # Gemini function-calling -> validated TacticsInput
  prisma.ts             # Prisma client singleton

components/
  pitch/PitchView.tsx    # Canvas renderer with event-based interpolation
  tactics/TacticsForm.tsx # Formation/XI/instructions picker

prisma/schema.prisma     # Database schema
scripts/
  seed.ts               # League + teams + players seed data
  simulate-round.ts     # Batch-simulate a round via API
```

---

## How it works (architecture notes)

**AI tactics caching**: each AI-controlled team gets a `baseTactics` JSON generated
once via Gemini and reused for the whole season, UNLESS the opponent's overall rating
differs by more than 15 points — in that case, match-specific tactics are generated
for that fixture only (not cached).

**Determinism**: `simulateMatch(input, fixtureId)` uses `fixtureId` as a seed for a
mulberry32 PRNG, so re-simulating with the same tactics always produces the same
result — useful for debugging.

**Fallback tactics**: if `GEMINI_API_KEY` is missing/invalid or Gemini returns an
invalid response (bad player IDs, wrong GK count, etc.), the AI agent falls back to a
balanced 4-4-2 using the best-rated available players. The match will still simulate
successfully.

**Validation**: both AI-generated and player-submitted tactics are validated for
exactly 11 unique player IDs and exactly 1 GK before the match engine runs — the
engine throws a clear error otherwise (caught and returned as a 400 by `/simulate`).

---

## Troubleshooting

- **"No league found"**: run `npm run db:seed`.
- **"Fixtures already generated"**: fixtures were already created for this league;
  this is a one-time operation per league.
- **Gemini errors / rate limits**: the app falls back to default tactics automatically
  — matches will still run, just without AI reasoning text in the Decision Log
  (reasoning will say "Default balanced setup...").
- **Prisma migration fails**: ensure PostgreSQL is running and `DATABASE_URL` in
  `.env` is correct (`psql $DATABASE_URL` should connect).
