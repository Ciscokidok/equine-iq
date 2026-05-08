# Bundle 4: Pairings Analysis Integration

> Tasks: spec-driven/progeny-auction-sale-tracking/tasks.md | Bundle: 4 | Slice: 4 — Mating Analysis Integration | Stage: integration
> Parallel: no
> Depends on: Bundle 3 (needs getBulkSaleStats)
> Files: api/src/routes/pairings.ts

**Bundle Verify**:
- **Level**: integration
- **Given**: Bundle 4 complete, dev server running
- **Action**: POST /api/pairings/analyze with a mix of stallions — some with recorded sales, some without
- **Outcome**: Each result in the `results` array includes a `progenySaleStats` field — `{avg:number, count:number}` for stallions with sales, `null` for stallions without; existing analysis fields (compatibility_score, reasoning, etc.) are unchanged

---

#### STEP-8: Inject progenySaleStats into POST /api/pairings/analyze
[FR-5 -> AC-5.1, AC-5.2] | modify `api/src/routes/pairings.ts` | Effort: S

> **Intent**: The bulk stats pre-fetch must run before `Promise.all` — not inside it — to avoid N separate DB round-trips to a latency-sensitive endpoint (AD-3). Placing the query inside the loop would add one DB connection per stallion; the pre-fetch pattern adds exactly one DB round-trip regardless of how many stallions are in the request. `getBulkSaleStats` returns a `Map<stallionId, BulkSaleStat>` — `statsMap.get(stallion.id) ?? null` naturally handles the no-data case (AC-5.2) without any special-casing. Importantly, if `getBulkSaleStats` is called with an empty array (no stallions), it must return an empty Map immediately — guard against that in STEP-6.

> **Standards**: S-1 (requireAuth + getUserId already present — do not remove), S-4 (Prisma via the stats utility)

- Import `getBulkSaleStats` from `../lib/auctionSaleStats`
- Locate the analyze handler in `api/src/routes/pairings.ts`
- After the stallions array is fetched (step 2 of the handler), extract: `const stallionIds = stallions.map(s => s.id)`
- Call before `Promise.all`: `const statsMap = await getBulkSaleStats(stallionIds, userId)`
- In the result map (after `Promise.all` resolves and results are ranked), add to each result object: `progenySaleStats: statsMap.get(r.stallion.id) ?? null`
- Preserve existing field order: stallion, compatibility_score, reasoning, risk_flags, top_strengths, considerations, progenySaleStats
- Follow pattern sketch: `references/research.md` Aspect 2 code sketch (F-5 injection point)

**Verify**:
- Level: integration | Given: analysis run with stallion that has 5 sales | Action: POST /api/pairings/analyze | Outcome: that stallion's result includes `progenySaleStats:{avg:number, count:5}`
- Level: integration | Given: analysis run with stallion that has no sales | Action: POST /api/pairings/analyze | Outcome: that stallion's result includes `progenySaleStats:null`; all other analysis fields present and correct
- Level: inspection | Given: pairings.ts modified | Action: `npx tsc --noEmit` in api/ | Outcome: compiles with no errors

> Depends on: STEP-6 | Enables: — | Parallel with: STEP-7, STEP-9
