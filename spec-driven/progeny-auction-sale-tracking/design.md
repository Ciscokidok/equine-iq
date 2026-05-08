---
slug: progeny-auction-sale-tracking
status: final
spec_source: spec-driven/progeny-auction-sale-tracking/spec.md
spec_tier: 1
spec_hash: sha256:5a88a3fe9e7f7838c667429f04ce9840eb9e59f4685dc6352f262cee7cebfc30
adaptive_flow: partial
test_approach: none
test_capabilities:
  unit: null
  integration: null
  e2e: null
created_date: 2026-05-08T00:00:00Z
last_updated: 2026-05-08T00:00:00Z
---

# Architectural Design: progeny-auction-sale-tracking

## Overview

- **Spec**: Progeny Auction Sale Tracking (6 FRs, 3 NFRs)
- **Architecture**: extension — adds a new Prisma model and routes to an existing Node/Express/PostgreSQL API, and new panels to the React frontend
- **Test approach**: none — no test framework detected in api/package.json or frontend/package.json
- **Test capabilities**: unit=null, integration=null, e2e=null
  - *Recommendation*: FR-3/FR-4 stats aggregation logic (avg/median/high/low via `$queryRaw`) and FR-5 bulk pre-fetch logic would benefit from unit tests. No framework is required to ship v1, but adding Jest to the API would allow verifying the stats utility in isolation before deployment.

## Technical Approach

### Feature Area 1: AuctionSale data model (FR-1, FR-2)

Today the `Foal` model tracks basic foal metadata and links optionally to a `MatingPairing`. The `FoalResult` model tracks competition results with a generic `event/placement/score/earnings` structure — it cannot represent structured auction data without schema contortion.

**What changes**: A new `AuctionSale` Prisma model is added, linked to `Foal` via a required `foalId` FK. A new `AuctionSaleType` enum is added to `schema.prisma`. `userId` is stored directly on `AuctionSale` (denormalized from `Foal`) to enable efficient user-scoped stats queries that don't route through the foal parent (see AD-5).

CRUD endpoints follow the existing `foals.ts` sub-resource pattern (e.g., `POST /:id/results`) — new routes are `POST /:id/auction-sales` and `GET /:id/auction-sales` on the foals router. The `GET /foals/:id` response is extended to include `auctionSales: []` in the `include` block.

Pattern to follow: `api/src/routes/foals.ts` lines 110–128 for the sub-resource handler structure.

### Feature Area 2: Stats aggregation (FR-3, FR-4)

No aggregation capability exists today. Prisma's `aggregate()` API covers `_avg`, `_min`, `_max`, `_count` but cannot compute median — median requires `prisma.$queryRaw` with PostgreSQL's `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "salePrice")` (see AD-2).

**What changes**: A shared utility `api/src/lib/auctionSaleStats.ts` is created with two exported functions:
- `getStallionSaleStats(stallionId, userId, mareId?)` — single-stallion stats for FR-3/FR-4
- `getBulkSaleStats(stallionIds, userId)` — grouped avg+count for all stallionIds, used by FR-5

Both functions return a typed `SaleStats` object (`count`, `avg`, `median`, `high`, `low`, `lowSampleWarning`). The `lowSampleWarning` flag is set when `count < 3` (AC-4.2).

A new route `GET /api/stallions/:id/auction-sale-stats` is added to the stallions router. It calls `getStallionSaleStats()` and returns the typed stats or `{ count: 0, ...nulls }` for no-data cases (AC-3.2).

### Feature Area 3: Mating analysis integration (FR-5)

Today `POST /api/pairings/analyze` collects stallion IDs from the request, parallelizes Claude API calls with `Promise.all`, and returns ranked results. There is no hook for supplementary DB data.

**What changes**: Before the `Promise.all` call, a single bulk stats query fetches avg+count for all requested stallionIds: `getBulkSaleStats(stallion_ids, userId)`. This returns a `Map<stallionId, { avg, count }>`. After Claude analysis completes, each result is merged: `{ stallion, ...analysis, progenySaleStats: statsMap.get(stallion.id) ?? null }` (see AD-3). A stallion with no sales returns `progenySaleStats: null` (AC-5.2).

The bulk query adds one DB round-trip to the analyze call — it does not touch the `Promise.all` loop and therefore does not affect Claude API parallelism.

### Feature Area 4: Frontend (FR-2, FR-3, FR-6)

**FoalTracker.tsx** (FR-2): Add an "Auction Sales" section to the foal detail panel. Lists all recorded sales ordered by date descending. A "Record Sale" button opens an inline form (salePrice, saleDate, saleType required; auctionHouse, hipNumber, buyer, notes optional). Uses React Query for data fetching and `sonner` for toast feedback consistent with existing patterns.

**StallionDetail.tsx** (FR-3): Add a "Progeny Sale Stats" card displaying avg/median/high/low when data exists, or a "No auction data recorded" placeholder when `count === 0`.

**StallionCompare.tsx** (FR-6, Nice to Have): The view already exists. Add a sortable "Avg Auction Price" column to the comparison table. Uses Recharts bar chart if space allows — falls back to table-only if layout is constrained.

New file `frontend/src/api/auctionSales.ts` exports React Query hooks: `useAuctionSales(foalId)`, `useAddAuctionSale()`, `useStallionSaleStats(stallionId, mareId?)`.

## Findings

| ID | Title | Source | Confidence | Related FRs | Summary |
|----|-------|--------|------------|-------------|---------|
| F-1 | No test framework in project | codebase | high | all | Neither api nor frontend package.json contains jest, vitest, supertest, playwright, or cypress — test_approach is none |
| F-2 | Prisma aggregate() lacks median support | training_knowledge | high | FR-3, FR-4 | `aggregate()` covers avg/min/max/count but not percentile — median requires `$queryRaw` with PERCENTILE_CONT |
| F-3 | Sub-resource route pattern established | codebase | high | FR-1, FR-2 | `foals.ts` uses `POST /:id/results` for nested FoalResult — AuctionSale follows the same `/:id/auction-sales` pattern |
| F-4 | userId must be stored on AuctionSale directly | codebase | high | FR-3, FR-4, FR-5 | Stats endpoints query by stallionId without routing through a user-owned Foal parent; user-scoping requires a direct userId column |
| F-5 | Pairings analyze has clean pre-fetch injection point | codebase | high | FR-5 | `Promise.all(stallions.map(...))` in pairings.ts allows a bulk stats query before the loop — one DB round-trip for all stallionIds |
| F-6 | Stats utility must be shared across two routes | codebase | high | FR-3, FR-4, FR-5 | Both the stallions stats endpoint and the pairings analyze endpoint need the same aggregation logic — extract to `lib/auctionSaleStats.ts` |
| F-7 | StallionCompare.tsx already exists for FR-6 | codebase | high | FR-6 | `frontend/src/views/StallionCompare.tsx` is a registered view — FR-6 extends it rather than creating a new route |
| F-8 | React Query + axios + sonner established frontend pattern | codebase | high | FR-2, FR-3, FR-6 | Frontend uses `@tanstack/react-query` for data fetching, `axios` for HTTP, and `sonner` for toast notifications — new hooks follow this pattern |

## Architecture Decisions

### AD-1: Dedicated `AuctionSale` Prisma model, not an extension of `FoalResult`

- **Context**: `FoalResult` already exists for tracking performance results. It could theoretically hold auction sale data via the `earnings` field and a custom `event` string — avoiding a new model and migration.
- **Decision**: We will create a dedicated `AuctionSale` model separate from `FoalResult`.
- **Rationale**: `FoalResult` uses a generic structure (`event`, `placement`, `score`, `earnings`) optimized for competition results. Auction sales require structured fields that have no natural mapping: `auctionHouse`, `hipNumber`, `saleType` enum, `buyer`. Forcing these into `FoalResult` would require either repurposing free-text fields (fragile) or adding nullable columns that only apply to auction records (schema pollution). A dedicated model is clean, queryable, and extensible. (F-3, F-4 informed this)
- **Alternatives Considered**: Extend `FoalResult` with nullable auction-specific columns — rejected because it contaminates a general-purpose model with domain-specific fields and makes stats queries more complex (must filter by event type to exclude non-sale records).

---

### AD-2: Compute median via `$queryRaw` with PostgreSQL `PERCENTILE_CONT`

- **Context**: FR-3 requires median in the stats response. Prisma's `aggregate()` API does not support percentile functions — there is no `_median` field.
- **Decision**: We will use `prisma.$queryRaw<...>` with `SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "salePrice")` for median computation.
- **Rationale**: `PERCENTILE_CONT` is a native PostgreSQL ordered-set aggregate function available in PostgreSQL 9.4+. Render uses PostgreSQL 14, so it is available. This approach computes the correct statistical median in a single SQL round-trip. It is the idiomatic PostgreSQL approach. (F-2 informed this)
- **Alternatives Considered**: (1) Fetch all `salePrice` values and compute median in JavaScript — simpler code but transfers all prices over the wire and doesn't scale for large datasets. Rejected as unnecessary given `$queryRaw` availability. (2) Store a running median in a separate column — overkill for v1 data volumes.

---

### AD-3: Pre-fetch bulk stats before `Promise.all` in pairings analyze (FR-5)

- **Context**: `POST /api/pairings/analyze` uses `Promise.all(stallions.map(async stallion => analyzePairing(...)))` to parallelize Claude API calls. Adding a per-stallion DB query inside the loop would introduce N serial (or at best parallel) DB round-trips to a latency-sensitive endpoint.
- **Decision**: We will pre-fetch aggregate stats for all stallionIds in a single `GROUP BY stallionId` query before `Promise.all`, then merge the results into each stallion's analysis output.
- **Rationale**: One DB round-trip regardless of stallion count. The stats query completes before Claude calls begin and does not affect API call parallelism. (F-5 informed this)
- **Alternatives Considered**: Run DB queries inside `Promise.all` in parallel with Claude calls — also one "logical" step but N connections. The grouped single-query approach is cleaner and more predictable.

---

### AD-4: Stats endpoint nested under `/api/stallions/:id/auction-sale-stats`

- **Context**: FR-3 and FR-4 require a stats query endpoint. Options are: nest under stallions, add a top-level `/api/auction-sales/stats`, or add to the foals router.
- **Decision**: We will add `GET /api/stallions/:id/auction-sale-stats` to the existing stallions router, with an optional `?mareId=` query parameter for cross-specific stats (FR-4).
- **Rationale**: The stallion is the primary entity being evaluated. Nesting under stallions is consistent with REST resource ownership. `?mareId=` as a query parameter cleanly handles the FR-4 variant without a separate route. (F-3 informed this)
- **Alternatives Considered**: Top-level `/api/auction-sales/stats?stallionId=...` — less RESTful, doesn't co-locate with the stallion resource. Separate `/api/stallions/:id/cross-stats` for FR-4 — unnecessary route proliferation.

---

### AD-5: Store `userId` directly on `AuctionSale` (denormalized)

- **Context**: All user data in this app is scoped by `userId`. `AuctionSale` links to `Foal` which also has a `userId`. The `userId` could be derived by joining through `Foal` on every query, avoiding denormalization.
- **Decision**: We will store `userId` directly on `AuctionSale` alongside the `foalId` FK.
- **Rationale**: The stats endpoints (FR-3, FR-4) query `AuctionSale` by `stallionId` (joining through `Foal.stallionId`) but also need to filter by `userId`. Without a direct `userId` column, every stats query requires an additional join to `Foal` for the user filter. The direct column keeps queries simple and consistent with Foal, MatingPairing, and other models in the schema that all carry `userId` directly. (F-4 informed this)
- **Alternatives Considered**: Join through Foal for userId — adds a join to every query and makes the stats utility more complex. Rejected in favor of the established direct-userId pattern.

## Resolved Uncertainties

| # | Question | Answer |
|---|----------|--------|
| 1 | Can PostgreSQL PERCENTILE_CONT be used with Render's managed PostgreSQL? | Yes — Render uses PostgreSQL 14; PERCENTILE_CONT is available since PostgreSQL 9.4 |
| 2 | Should the bulk stats pre-fetch (FR-5) use groupBy or $queryRaw? | `prisma.auctionSale.groupBy()` covers avg/count; if median is not needed in FR-5 (only avg+count per AC-5.1), groupBy is sufficient and type-safe. $queryRaw with PERCENTILE_CONT is reserved for the stallion stats endpoints (FR-3/FR-4) where median is required. |
| 3 | Does FR-6 require a new view/route or extend StallionCompare.tsx? | Extends `StallionCompare.tsx` — the view already exists and is registered. A new "Avg Auction Price" sortable column fits the comparison table pattern. |

## Standards

| ID | Rule | Domain | File Type | Action Type |
|----|------|--------|-----------|-------------|
| S-1 | All protected routes must call `requireAuth` and `getUserId` before any DB access | security | .ts | * |
| S-2 | All req.body input validated with Zod before processing | error-handling | .ts | * |
| S-3 | Perform ownership check (`findFirst` with `userId`) before any mutation | security | .ts | modify |
| S-4 | Use Prisma ORM for all DB access; `$queryRaw` only when Prisma query builder cannot express the operation | api-design | .ts | * |
| S-5 | Feature branches only — never push directly to main | other | * | * |

See `references/standards.md` for complete standards inventory (5 standards with full typed applicability metadata).

## File Inventory

| Action | Path | Related FRs | Rationale |
|--------|------|-------------|-----------|
| modify | api/prisma/schema.prisma | FR-1 | Add `AuctionSale` model and `AuctionSaleType` enum |
| create | api/prisma/migrations/YYYYMMDD_add_auction_sale/migration.sql | FR-1 | Prisma migration for AuctionSale table |
| create | api/src/lib/auctionSaleStats.ts | FR-3, FR-4, FR-5 | Shared stats utility — `getStallionSaleStats()` and `getBulkSaleStats()` |
| modify | api/src/routes/foals.ts | FR-1, FR-2 | Add `POST /:id/auction-sales` and `GET /:id/auction-sales`; extend GET `/:id` include block |
| modify | api/src/routes/stallions.ts | FR-3, FR-4 | Add `GET /:id/auction-sale-stats` |
| modify | api/src/routes/pairings.ts | FR-5 | Pre-fetch bulk stats before Promise.all; merge progenySaleStats into ranked results |
| create | frontend/src/api/auctionSales.ts | FR-1, FR-2, FR-3 | React Query hooks: `useAuctionSales`, `useAddAuctionSale`, `useStallionSaleStats` |
| modify | frontend/src/views/FoalTracker.tsx | FR-2 | Add "Auction Sales" section with list + "Record Sale" form |
| modify | frontend/src/views/StallionDetail.tsx | FR-3 | Add "Progeny Sale Stats" card |
| modify | frontend/src/views/StallionCompare.tsx | FR-6 | Add sortable "Avg Auction Price" column (Nice to Have) |

## Dependencies and Coupling

| Feature Area | Shared Files | Recommendation |
|--------------|--------------|----------------|
| FR-3, FR-4, FR-5 | `api/src/lib/auctionSaleStats.ts` | Implement this utility first — both the stallions route and pairings route depend on it. Treat as foundation within the stats slice. |
| FR-1, FR-2, FR-3 | `api/prisma/schema.prisma` + migration | Prisma migration must complete before any route handler can reference `prisma.auctionSale`. Implement schema as the first step of any bundle. |
| FR-3, FR-5 | `auctionSaleStats.ts` (different functions) | `getStallionSaleStats` (FR-3) and `getBulkSaleStats` (FR-5) share the same module — implement together. |

## Spec Deviations

None — all spec values preserved.

## Open Questions

1. **Non-goals undefined** (OQ-1): Non-goals (private treaty, API integration, multi-currency) are design assumptions. Assumed correct — proceeding.
2. **`buyer` field** (OQ-2): Included as optional string on `AuctionSale`. No buyer analytics planned.
3. **Stats scope** (OQ-3): User-scoped by default (each user sees only their own sales). Global aggregation deferred to a future product decision.

## Constraints (Technical)

| Constraint | Category | Source | Rationale |
|------------|----------|--------|-----------|
| `$queryRaw` required for median percentile | compatibility | codebase | Prisma's aggregate() does not expose PostgreSQL percentile functions — raw SQL is the only way to compute PERCENTILE_CONT |
| `AuctionSaleType` enum must be defined in schema.prisma before Prisma client generation | infrastructure | technical | Prisma enums require schema definition before migration — cannot be deferred to application code |
| Auction sale requires an existing Foal record (foalId FK is required, not nullable) | infrastructure | spec-constraint | Specified by user in spec OQ resolution (AC-1.1 precondition) |

## Assumptions

| Assumption | Source | Affects |
|------------|--------|---------|
| Render PostgreSQL version is 14+ (required for PERCENTILE_CONT availability) | research | FR-3, FR-4 |
| `getBulkSaleStats` for FR-5 returns only `avg` and `count` (not median) — median is only needed in the stallion stats endpoint per AC-5.1 | design | FR-5 |
| FoalTracker.tsx renders individual foal detail — adding auction sales section is additive, not a layout refactor | codebase | FR-2 |
| StallionCompare.tsx comparison table can accommodate a new column without significant layout changes | codebase | FR-6 |

## Risks (Technical)

| Risk | Impact | Probability | Mitigation | Affects |
|------|--------|-------------|------------|---------|
| `$queryRaw` result is not type-safe — TypeScript won't catch field name mismatches | Medium | Medium | Define explicit return types for all `$queryRaw` calls; validate shape at runtime before returning | FR-3, FR-4 |
| FR-5 pre-fetch adds DB latency to `/analyze` critical path | Medium | Low | Pre-fetch is a single grouped query (not N queries); if p99 exceeds tolerance, make it non-blocking (fire-and-forget with null fallback on timeout) | FR-5 |
| Schema migration adds table to production DB — downtime risk on Render deploy | Low | Low | Prisma migrations are additive (new table, no column changes to existing tables) — zero risk of breaking existing queries | FR-1 |

## References

- See `references/research.md` for full research results per aspect
- See `references/standards.md` for complete standards inventory (5 standards)
- See `references/contracts.md` for API contract definitions (AuctionSale CRUD + stats endpoints)
