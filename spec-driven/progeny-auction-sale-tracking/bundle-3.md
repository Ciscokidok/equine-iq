# Bundle 3: Stats Utility + Stallion Endpoint

> Tasks: spec-driven/progeny-auction-sale-tracking/tasks.md | Bundle: 3 | Slice: 3 — Stats API | Stage: depth
> Parallel: yes — can run in parallel with Bundle 2 (disjoint files)
> Depends on: Bundle 1
> Files: api/src/lib/auctionSaleStats.ts, api/src/routes/stallions.ts

**Bundle Verify**:
- **Level**: integration
- **Given**: Bundle 3 steps complete, dev server running
- **Action**: GET /api/stallions/:id/auction-sale-stats for a stallion with no sales; then with sales; then with ?mareId= param
- **Outcome**: No-data case returns 200 with `{count:0, avg:null, median:null, high:null, low:null, lowSampleWarning:false}`; with-data case returns correct aggregates; mare cross case returns cross-scoped stats with lowSampleWarning:true when count < 3

---

#### STEP-6: Create api/src/lib/auctionSaleStats.ts
[FR-3 -> AC-3.1, AC-3.2; FR-4 -> AC-4.1, AC-4.2; FR-5 -> AC-5.1, AC-5.2] | create `api/src/lib/auctionSaleStats.ts` | Effort: M

> **Intent**: Median requires `$queryRaw` — Prisma's `aggregate()` has no percentile support (F-2, AD-2). The `$queryRaw` return type is `unknown` — the result must be cast to an explicit interface and runtime-validated (e.g. check the field exists) before returning, because TypeScript cannot verify the SQL output shape. `count` is returned as `BigInt` by PostgreSQL JDBC drivers; it must be converted to `Number` before returning in the JSON response (BigInt does not JSON.stringify). The `getBulkSaleStats` function also requires `$queryRaw` — despite research suggesting `groupBy()`, Prisma's groupBy cannot group by a field on a related model (`stallionId` lives on `Foal`, not on `AuctionSale`). The `lowSampleWarning` flag is `true` when `count < 3` (AC-4.2). The no-data case (`count === 0`) must return `null` aggregates, not an error, and `lowSampleWarning: false` (AC-3.2).

> **Standards**: S-4 (`$queryRaw` is justified — Prisma aggregate() cannot express percentile functions; groupBy() cannot express cross-table grouping)

- Define and export interfaces matching contracts.md:
  ```typescript
  export interface SaleStats {
    stallionId: string; mareId: string | null; count: number;
    avg: number | null; median: number | null; high: number | null; low: number | null;
    lowSampleWarning: boolean;
  }
  export interface BulkSaleStat { avg: number; count: number; }
  ```
- Implement `getStallionSaleStats(stallionId, userId, mareId?)`:
  - Use `$queryRaw` with template literal: `SELECT COUNT(*), AVG(a."salePrice"), PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY a."salePrice") as median, MIN(a."salePrice"), MAX(a."salePrice") FROM "AuctionSale" a JOIN "Foal" f ON a."foalId" = f.id WHERE f."stallionId" = ${stallionId} AND a."userId" = ${userId}` — append `AND f."mareId" = ${mareId}` when mareId is provided
  - Cast result as `[{ count: bigint, avg: number|null, median: number|null, min: number|null, max: number|null }]`
  - Convert `BigInt` count to `Number(result[0].count)`
  - Return full `SaleStats` with `lowSampleWarning: Number(count) < 3`
- Implement `getBulkSaleStats(stallionIds, userId)`:
  - Return empty `Map` immediately if `stallionIds.length === 0`
  - Use `$queryRaw` with `Prisma.join()`: `SELECT f."stallionId", COUNT(*) as count, AVG(a."salePrice") as avg FROM "AuctionSale" a JOIN "Foal" f ON a."foalId" = f.id WHERE f."stallionId" IN (${Prisma.join(stallionIds)}) AND a."userId" = ${userId} GROUP BY f."stallionId"`
  - Build and return `Map<string, BulkSaleStat>` from the result rows
- Import `prisma` from `../lib/prisma` and `Prisma` from `@prisma/client`

**Verify**:
- Level: inspection | Given: auctionSaleStats.ts created | Action: `npx tsc --noEmit` in api/ | Outcome: compiles with no errors
- Level: integration | Given: stallion has 5 recorded progeny sales | Action: call getStallionSaleStats(stallionId, userId) | Outcome: returns {count:5, avg:number, median:number, high:number, low:number, lowSampleWarning:false}
- Level: integration | Given: stallion has 2 progeny sales | Action: call getStallionSaleStats | Outcome: lowSampleWarning:true (count < 3)
- Level: integration | Given: stallion has no sales | Action: call getStallionSaleStats | Outcome: {count:0, avg:null, median:null, high:null, low:null, lowSampleWarning:false}
- Level: integration | Given: 3 stallions in stallionIds array | Action: call getBulkSaleStats | Outcome: Map with entries for stallions that have sales; missing entries for stallions with no sales

> Depends on: STEP-2 | Enables: STEP-7, STEP-8 | Parallel with: STEP-3, STEP-4, STEP-5

---

#### STEP-7: Add GET /api/stallions/:id/auction-sale-stats
[FR-3 -> AC-3.1, AC-3.2, AC-3.3; FR-4 -> AC-4.1, AC-4.2] | modify `api/src/routes/stallions.ts` | Effort: S

> **Intent**: The stallion catalog is shared — any authenticated user can query stats for any stallion (AC-3.3). The ownership check here is NOT on the stallion (unlike foal routes) — stallions are catalog entries, not user-owned. User scoping is implicit inside `getStallionSaleStats` via the `userId` parameter, which restricts results to that user's sale records. The endpoint returns 200 with null aggregates (not 404) when no sales exist (AC-3.2). A 404 is still returned when the stallion ID itself doesn't exist in the catalog. Optional `mareId` query param must be validated as a UUID format before passing to the utility to prevent injection via raw string.

> **Standards**: S-1 (requireAuth + getUserId before DB access)

- Add `router.get('/:id/auction-sale-stats', requireAuth, async (req, res) => { ... })`
- `getUserId(req)` + extract `req.query.mareId` (validate UUID format if present — return 400 on invalid format)
- Stallion existence check: `prisma.horse.findUnique({ where: { id: req.params.id } })` → 404 if not found
- Call `getStallionSaleStats(req.params.id, userId, mareId)` → return 200 with the `SaleStats` result
- Import `getStallionSaleStats` from `../lib/auctionSaleStats`
- Follow pattern: existing `GET /:id` handler in `api/src/routes/stallions.ts`

**Verify**:
- Level: integration | Given: stallion exists with 5 progeny sales in user's account | Action: GET /api/stallions/:id/auction-sale-stats | Outcome: 200 with count:5, avg, median, high, low, lowSampleWarning:false
- Level: integration | Given: stallion exists, no sales | Action: GET /api/stallions/:id/auction-sale-stats | Outcome: 200 with count:0, all aggregates null, lowSampleWarning:false
- Level: integration | Given: stallion does not exist | Action: GET | Outcome: 404
- Level: integration | Given: valid mareId query param with fewer than 3 cross sales | Action: GET /api/stallions/:id/auction-sale-stats?mareId=:uuid | Outcome: 200 with stats scoped to that cross; lowSampleWarning:true

> Depends on: STEP-6 | Enables: STEP-9 | Parallel with: STEP-3, STEP-4, STEP-5
