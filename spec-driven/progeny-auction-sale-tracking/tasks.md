---
title: "Tasks: Progeny Auction Sale Tracking"
slug: progeny-auction-sale-tracking
status: final
design_source: spec-driven/progeny-auction-sale-tracking/design.md
design_hash: sha256:79fe6327d4d417f329819ae1ec4593d1dd953656ae7604edf8bbb6474bb9c5c8
spec_source: spec-driven/progeny-auction-sale-tracking/spec.md
spec_hash: sha256:5a88a3fe9e7f7838c667429f04ce9840eb9e59f4685dc6352f262cee7cebfc30
strategy: walking-skeleton
total_steps: 12
total_slices: 6
total_bundles: 6
validation: skipped
version: 2.0
date: 2026-05-08
---

# Tasks: Progeny Auction Sale Tracking

> Design: spec-driven/progeny-auction-sale-tracking/design.md | Spec: spec-driven/progeny-auction-sale-tracking/spec.md | Strategy: walking-skeleton | Generated: 2026-05-08 | Status: Draft

> Do not edit this document after finalization. Track execution in `spec-driven/progeny-auction-sale-tracking/progress-bundle-N.md` files.

## Traceability

### Functional Requirements

| FR | AC | STEP | Slice | Bundle |
|----|----|------|-------|--------|
| FR-1 | AC-1.1, AC-1.2 | STEP-1, STEP-2 | Slice 1 | Bundle 1 |
| FR-1 | AC-1.1, AC-1.2, AC-1.3 | STEP-3 | Slice 2 | Bundle 2 |
| FR-2 | AC-2.1, AC-2.2 | STEP-4, STEP-5 | Slice 2 | Bundle 2 |
| FR-3 | AC-3.1, AC-3.2, AC-3.3 | STEP-6, STEP-7 | Slice 3 | Bundle 3 |
| FR-4 | AC-4.1, AC-4.2 | STEP-6, STEP-7 | Slice 3 | Bundle 3 |
| FR-5 | AC-5.1, AC-5.2 | STEP-8 | Slice 4 | Bundle 4 |
| FR-2 | AC-2.1, AC-2.2 | STEP-10 | Slice 5 | Bundle 5 |
| FR-3 | AC-3.1, AC-3.2 | STEP-11 | Slice 5 | Bundle 5 |
| FR-6 | AC-6.1, AC-6.2 | STEP-12 | Slice 6 | Bundle 6 |

### Non-Functional Requirements

| NFR | Disposition | STEP / Mechanism | Verification |
|-----|-------------|------------------|--------------|
| NFR-1 (API Response Time) | Implemented | STEP-6 (indexed $queryRaw for stats); STEP-3/4 (indexed Prisma queries for CRUD) | Inspection: confirm indexes on [foalId], [userId], [userId, saleDate] in migration SQL |
| NFR-2 (Data Authorization) | Implemented | STEP-3 (S-1 + S-3 on POST auction-sales); STEP-4 (S-1 on GET auction-sales); STEP-7 (userId scoping in stats) | Integration: request another user's foal sales → 404 |
| NFR-3 (Reliability) | Platform + Implemented | Platform: Render PostgreSQL durability; Implemented: STEP-6 returns null aggregates (not error) when count=0 | Inspection: STEP-6 null-path code review |

---

## Conflict Analysis

| Hot File | Touched By | Strategy |
|----------|------------|----------|
| api/prisma/schema.prisma | STEP-1 (Bundle 1) | Single bundle — no conflict |
| api/src/routes/foals.ts | STEP-3, STEP-4, STEP-5 (all Bundle 2) | Same bundle — sequential within bundle |
| api/src/routes/stallions.ts | STEP-7 (Bundle 3) | Single bundle — no conflict |
| api/src/routes/pairings.ts | STEP-8 (Bundle 4) | Single bundle — no conflict |
| frontend/src/views/FoalTracker.tsx | STEP-10 (Bundle 5) | Single bundle — no conflict |
| frontend/src/views/StallionDetail.tsx | STEP-11 (Bundle 5) | Single bundle — no conflict |
| frontend/src/views/StallionCompare.tsx | STEP-12 (Bundle 6) | Single bundle — no conflict |

---

## Bundle Execution Order

```
Bundle 1 (Foundation — skeleton)
   ↓
Bundle 2 (CRUD API)  ←→  Bundle 3 (Stats API)   [parallel — disjoint files]
                              ↓
                          Bundle 4 (Analysis Integration)
Bundle 2 + Bundle 3 complete
   ↓
Bundle 5 (Frontend Core)
   ↓
Bundle 6 (StallionCompare — Nice to Have)
```

---

## Slice 1: Schema Foundation (Stage: skeleton)

### Bundle 1: Schema + Migration
> Stage: skeleton | Parallel: no (must run first — unblocks all other bundles) | Files: api/prisma/schema.prisma, api/prisma/migrations/

See: `spec-driven/progeny-auction-sale-tracking/bundle-1.md`

---

## Slice 2: CRUD API (Stage: depth)

### Bundle 2: Foal Auction Sale Routes
> Stage: depth | Parallel: yes (with Bundle 3 — disjoint files) | Files: api/src/routes/foals.ts

See: `spec-driven/progeny-auction-sale-tracking/bundle-2.md`

---

## Slice 3: Stats API (Stage: depth)

### Bundle 3: Stats Utility + Stallion Endpoint
> Stage: depth | Parallel: yes (with Bundle 2 — disjoint files) | Files: api/src/lib/auctionSaleStats.ts, api/src/routes/stallions.ts

See: `spec-driven/progeny-auction-sale-tracking/bundle-3.md`

---

## Slice 4: Mating Analysis Integration (Stage: integration)

### Bundle 4: Pairings Analyze Injection
> Stage: integration | Parallel: no (depends on Bundle 3) | Files: api/src/routes/pairings.ts

See: `spec-driven/progeny-auction-sale-tracking/bundle-4.md`

---

## Slice 5: Frontend Core (Stage: depth)

### Bundle 5: Frontend Hooks + Views
> Stage: depth | Parallel: no (depends on Bundles 2 + 3) | Files: frontend/src/api/auctionSales.ts, frontend/src/views/FoalTracker.tsx, frontend/src/views/StallionDetail.tsx

See: `spec-driven/progeny-auction-sale-tracking/bundle-5.md`

---

## Slice 6: Dashboard Enhancement (Stage: depth — Nice to Have)

### Bundle 6: StallionCompare Column
> Stage: depth | Parallel: no (depends on Bundle 5) | Priority: Nice to Have | Files: frontend/src/views/StallionCompare.tsx

See: `spec-driven/progeny-auction-sale-tracking/bundle-6.md`

---

## Architecture Decisions

See: `spec-driven/progeny-auction-sale-tracking/design.md`

---

## File Structure

    spec-driven/progeny-auction-sale-tracking/tasks.md          — This index file
    spec-driven/progeny-auction-sale-tracking/bundle-1.md       — Schema Foundation (STEP-1, STEP-2)
    spec-driven/progeny-auction-sale-tracking/bundle-2.md       — CRUD API (STEP-3, STEP-4, STEP-5)
    spec-driven/progeny-auction-sale-tracking/bundle-3.md       — Stats API (STEP-6, STEP-7)
    spec-driven/progeny-auction-sale-tracking/bundle-4.md       — Pairings Integration (STEP-8)
    spec-driven/progeny-auction-sale-tracking/bundle-5.md       — Frontend Core (STEP-9, STEP-10, STEP-11)
    spec-driven/progeny-auction-sale-tracking/bundle-6.md       — StallionCompare (STEP-12)
    spec-driven/progeny-auction-sale-tracking/progress-bundle-1.md
    spec-driven/progeny-auction-sale-tracking/progress-bundle-2.md
    spec-driven/progeny-auction-sale-tracking/progress-bundle-3.md
    spec-driven/progeny-auction-sale-tracking/progress-bundle-4.md
    spec-driven/progeny-auction-sale-tracking/progress-bundle-5.md
    spec-driven/progeny-auction-sale-tracking/progress-bundle-6.md
