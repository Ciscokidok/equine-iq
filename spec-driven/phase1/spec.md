# Phase 1 Spec — Core Loop

**Source:** `equine_mating_advisor_spec.md` sections 1–9 (Phase 1)

## Goal

Deliver a working end-to-end mating advisor: a breeder can log in, add a mare, run the advisor against the stallion catalog, read AI-generated compatibility analysis, and save a pairing.

## Acceptance Criteria

- [ ] User can sign up / log in via Clerk
- [ ] User can create, view, edit, and delete mares with full pedigree (up to 4 generations)
- [ ] Stallion catalog has ≥ 200 seeded stallions with pedigree, discipline, and stud fee data
- [ ] `POST /api/pairings/analyze` accepts mare_id + stallion_ids (1–10) + goal, calls Claude in parallel, returns ranked list within 30s
- [ ] Mating advisor UI renders Step 1 (goal input + filters), Step 2 (ranked results with score badges), Step 3 (full analysis modal)
- [ ] User can save a pairing and see it on the dashboard
- [ ] Free tier capped at 3 mares (enforced server-side)

## Out of Scope (Phase 1)

Pedigree visualizer, comparison view, PDF export, stallion catalog search UI, private stallion upload, response caching.

## Key Technical Decisions

- Parallelize Claude calls with `Promise.all` — never sequential
- Temperature 0.3, max_tokens 1500, JSON-only response
- If Claude returns invalid JSON, retry once before returning an error score
- Stallion seed data: KWPN, AQHA, APHA, American Warmblood — start with the 6 named stallions in spec §11, expand to 200+ via Prisma seed script
- Clerk middleware validates JWT on every protected route; user_id extracted from `req.auth.userId`
