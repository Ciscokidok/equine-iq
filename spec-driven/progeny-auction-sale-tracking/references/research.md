# Research: progeny-auction-sale-tracking

Full research results organized by aspect. Summaries appear in `design.md`; this file contains the full analysis.

---

## Aspect 1: AuctionSale Schema + Stats Aggregation

**Architectural question**: How should the AuctionSale Prisma model be structured, and what is the correct approach for computing avg/median/high/low stats with Prisma and PostgreSQL?

### Findings

**F-1: No test framework in project**
- Source: codebase (direct inspection of api/package.json, frontend/package.json)
- Confidence: high
- Neither package contains jest, vitest, mocha, supertest, playwright, or cypress. `test_approach` is `none`. Verify clauses in task steps will use inspection-level checks (INFORMATION_SCHEMA equivalents, manual API smoke tests).

**F-2: Prisma aggregate() lacks median support**
- Source: training_knowledge (confirmed against Prisma docs)
- Confidence: high
- Prisma's `prisma.<model>.aggregate()` supports `_avg`, `_min`, `_max`, `_count`, and `_sum`. It does not expose percentile functions (PERCENTILE_CONT, PERCENTILE_DISC). PostgreSQL's `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY col)` is the correct SQL — available since PostgreSQL 9.4, available on Render PostgreSQL 14.
- Implication: All median computations use `prisma.$queryRaw`. The return type must be cast manually — Prisma does not generate types for raw query results.

**F-3: Sub-resource route pattern established in foals.ts**
- Source: codebase (foals.ts lines 110–128)
- Confidence: high
- `POST /foals/:id/results` verifies foal ownership (`findFirst` with `userId`), validates input with Zod, and creates a nested record. The pattern for `POST /foals/:id/auction-sales` is identical in structure.

**F-4: userId must be stored on AuctionSale directly**
- Source: codebase (analysis of stats query paths)
- Confidence: high
- FR-3 stats endpoint queries by `stallionId`. The path is: `AuctionSale.stallionId` (derived from `Foal.stallionId`). To filter by user, the query must either join through `Foal` or have a direct `userId` on `AuctionSale`. All existing models with user scoping carry `userId` directly (User, Horse.createdByUser, MatingPairing, Foal). Consistent with established pattern.

### Approaches Evaluated

**Approach A (Recommended): Dedicated AuctionSale model with $queryRaw for median**
- Schema: new `AuctionSaleType` enum + `AuctionSale` model with required `foalId`, `userId`, `salePrice` (Float), `saleDate` (DateTime), `saleType` (AuctionSaleType), optional `auctionHouse`, `hipNumber`, `buyer`, `notes`
- Stats: `prisma.$queryRaw` with `SELECT AVG("salePrice"), PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "salePrice"), MIN("salePrice"), MAX("salePrice"), COUNT(*) FROM "AuctionSale" WHERE "stallionId" = $1 AND "userId" = $2`
- Fit: High — clean model, correct statistics, consistent with codebase patterns
- Tradeoffs: Adds one `$queryRaw` call (not type-safe without manual typing); migration adds a new table
- Recommendation: Use this approach

**Approach B: Extend FoalResult with nullable auction-specific columns**
- Add `auctionHouse`, `hipNumber`, `saleType`, `buyer` as nullable columns to FoalResult; use `event = 'auction_sale'` to distinguish records
- Fit: Low — contaminates a general-purpose model; stats queries must filter by event type; schema is fragile
- Recommendation: Rejected

**Approach C: Compute median in JavaScript**
- Fetch all `salePrice` values for a stallion, sort, compute median in Node.js
- Fit: Medium — correct but transfers all prices for large datasets; not idiomatic
- Recommendation: Acceptable fallback for small datasets, but `$queryRaw` is correct approach

### Resolved Uncertainties

- PERCENTILE_CONT on Render PostgreSQL 14: confirmed available. Render's managed PostgreSQL uses PostgreSQL 14+ as of 2024.
- Prisma model naming: `AuctionSale` (camelCase in schema.prisma); table name `"AuctionSale"` in PostgreSQL (Prisma default).

---

## Aspect 2: FR-5 Mating Analysis Integration

**Architectural question**: How to inject `progenySaleStats` into POST /api/pairings/analyze with zero latency regression?

### Findings

**F-5: Pairings analyze has clean pre-fetch injection point**
- Source: codebase (pairings.ts lines 61–86)
- Confidence: high
- The analyze handler: (1) validates input, (2) fetches mare + stallions, (3) `Promise.all(stallions.map(async stallion => analyzePairing(...)))`, (4) filters/sorts/maps results, (5) returns `{ results, errors }`.
- Injection point: between steps 2 and 3. A single grouped query before Promise.all fetches stats for all stallionIds. The stats Map is closed over by the map function and merged in step 4.
- Code sketch:
  ```typescript
  // Before Promise.all:
  const statsMap = await getBulkSaleStats(stallion_ids, userId)
  
  // In step 4 map:
  .map((r) => ({
    stallion: r.stallion,
    ...r.analysis!,
    progenySaleStats: statsMap.get(r.stallion.id) ?? null,
  }))
  ```

**F-6: Stats utility shared across stallions route and pairings route**
- Source: codebase (route structure analysis)
- Confidence: high
- Both `GET /api/stallions/:id/auction-sale-stats` (FR-3/FR-4) and the pairings analyze augmentation (FR-5) need aggregation logic. The utility `api/src/lib/auctionSaleStats.ts` exports:
  - `getStallionSaleStats(stallionId: string, userId: string, mareId?: string): Promise<SaleStats>` — full stats including median for the API endpoint
  - `getBulkSaleStats(stallionIds: string[], userId: string): Promise<Map<string, { avg: number; count: number }>>` — avg+count only (median not needed per AC-5.1) for the pairings inject

### Approaches Evaluated

**Approach A (Recommended): Pre-fetch bulk stats before Promise.all**
- One grouped `SELECT` against AuctionSale by `stallionId IN (...)` and `userId = ?`
- Builds a `Map<stallionId, { avg, count }>` before Claude calls begin
- Merged into results after analysis completes
- Tradeoffs: One additional DB round-trip on every analyze call, even if no sales data exists. Mitigated by: the query is fast (simple GROUP BY, indexed on stallionId + userId), and returns immediately with empty Map if no sales exist.
- Recommendation: Use this approach

**Approach B: Per-stallion queries inside Promise.all**
- Run `getStallionSaleStats(stallion.id, userId)` in parallel with Claude calls inside `Promise.all`
- Tradeoffs: N DB connections vs. one grouped query; more complex error handling; harder to reason about latency
- Recommendation: Rejected in favor of single grouped query

**Approach C: Non-blocking fire-and-forget with timeout**
- Start the bulk stats query, set a 100ms timeout, proceed with `null` if it doesn't complete
- Tradeoffs: Adds complexity; unnecessary for a fast GROUP BY query
- Recommendation: Keep as fallback if latency monitoring shows p99 regression after launch

### Resolved Uncertainties

- FR-5 only needs `avg` and `count` per AC-5.1 — median is not required in the mating analysis output. `getBulkSaleStats` uses `prisma.auctionSale.groupBy()` (type-safe) rather than `$queryRaw` since median is not needed.
- Prisma `groupBy()` with `_avg` and `_count` is fully type-safe and generates the correct GROUP BY query.

---

## Aspect 3: Frontend integration (derived from codebase scan)

### Findings

**F-7: StallionCompare.tsx already exists**
- Source: codebase (frontend/src/views/ directory listing)
- Confidence: high
- `StallionCompare.tsx` is registered in the app. FR-6 (Nice to Have) extends this view with an "Avg Auction Price" sortable column. No new route or view file needed.

**F-8: React Query + axios + sonner is the established frontend pattern**
- Source: codebase (frontend/package.json dependencies)
- Confidence: high
- `@tanstack/react-query` for data fetching, `axios` for HTTP calls, `sonner` for toast notifications, `react-hook-form` for forms, `shadcn/ui` (Tailwind-based) for components. New hooks follow the `useQuery` / `useMutation` pattern. Sale recording form uses `react-hook-form` + `zod` resolver consistent with existing form patterns.

### Resolved Uncertainties

- FoalTracker.tsx renders foal detail — confirmed by filename and view count (single-foal view pattern)
- No existing auction sale UI component exists — all frontend work is additive
