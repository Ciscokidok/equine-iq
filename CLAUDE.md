# EquineIQ — CLAUDE.md

## What This Is

AI-powered mating advisor for horse breeders. Given a mare, the app returns ranked stallion recommendations with scores, reasoning, and risk flags based on pedigree compatibility, conformation goals, performance records, and historical outcome data.

**Target users:** Small to mid-size breeders (3–30 mares). Disciplines: sport horse, warmblood, Quarter Horse performance, Paint. Explicitly NOT thoroughbred racing.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS, shadcn/ui, Recharts, react-d3-tree |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | bcrypt + JWT (HS256, 7-day tokens, localStorage) |
| AI | Anthropic API — `claude-sonnet-4-6` |

---

## Dev Commands

```bash
# Backend
cd api && npm install
npx prisma migrate dev       # run migrations
npx prisma db seed           # seed stallion catalog
npm run dev                  # starts on :3001

# Frontend
cd frontend && npm install
npm run dev                  # starts on :5173
```

---

## Environment Variables

### api/.env
```
DATABASE_URL=postgresql://...
SECRET_KEY=long-random-string
ANTHROPIC_API_KEY=sk-ant-...
FRONTEND_URL=http://localhost:5173
PORT=3001
```

### frontend/.env
```
VITE_API_URL=http://localhost:3001
```

---

## Architecture

```
frontend/          React SPA — Vite build
api/               Express REST API
  prisma/          Schema + migrations + seed
  src/
    routes/        mares, stallions, pairings, horses
    services/      claude.ts — Anthropic API calls
    middleware/    auth.ts — Clerk JWT verification
    lib/           prisma.ts — DB client singleton
```

**Core flow:** Breeder selects mare → sets breeding goal → app calls `POST /api/pairings/analyze` with mare_id + stallion_ids + goal → backend parallelizes Claude calls (one per stallion) → returns ranked list sorted by compatibility_score.

**Claude call contract:** Temperature 0.3, max_tokens 1500, JSON-only response with `compatibility_score`, `score_breakdown`, `reasoning`, `risk_flags`, `top_strengths`, `considerations`.

---

## Data Model (key tables)

- `horses` — both mares and stallions; `sex` enum distinguishes them; pedigree stored as JSON
- `mating_pairings` — saved analyses with score breakdown and AI reasoning
- `users` — Clerk user_id as primary key; `subscription_tier` free/pro

---

## Git Workflow

Feature branches → PR → merge to main. Never push directly to main.

```bash
git checkout -b feature/<name>
git push origin feature/<name>
gh pr create --base main
```

---

## Build Order (Phases)

- **Phase 1 (current):** Auth → Mare CRUD → Stallion DB with seed data → `/api/pairings/analyze` → Mating advisor UI → Save pairing
- **Phase 2:** Pedigree visualizer → Saved pairings comparison → Stallion catalog search
- **Phase 3:** PDF export → Dashboard analytics → Response caching
