> Stage: Depth — Auction Lifecycle | Parallel: yes (file-disjoint from listing, bidding, catalog bundles) | Files: api/src/lib/auctionLifecycle.ts, api/src/routes/cron.ts, api/src/routes/listings.ts

**Bundle Verify**: Cron tick transitions scheduled→open and open→closed correctly and idempotently; reserve evaluation triggers correct behavior per reserveBehavior setting
- **Level**: integration
- **Given**: DB contains scheduled auction with startAt in the past, open auction with endsAt in the past, open auction whose high bid meets reserve
- **Action**: POST /api/admin/cron/tick with ADMIN_TOKEN; call twice in succession
- **Outcome**: First call: scheduled→open, open→closed; second call: no state changes (idempotent). Closed auction with met reserve transitions to sold.

---

#### STEP-14: Create auction lifecycle state machine
[FR-2 -> AC-2.1, FR-2 -> AC-2.2, FR-2 -> AC-2.3, FR-2 -> AC-2.4, FR-8 -> AC-8.1, FR-8 -> AC-8.2, FR-8 -> AC-8.3] | create `api/src/lib/auctionLifecycle.ts` | Effort: M

> **Intent**: All state transitions use `UPDATE WHERE status = 'expected_source'` to guarantee idempotency (NFR-3, AD-2). If the cron fires twice in the same minute, the second run finds no rows matching the WHERE clause and does nothing — no double-transition. The `evaluateReserve()` function must handle all three `reserveBehavior` values: `auto_pass` transitions immediately to `passed`; `seller_decision` sets `status = 'seller_deciding'` and records `sellerDecisionDeadline = closedAt + 24h`; `counter_offer` sets `status = 'counter_offering'`. The cron also checks `seller_deciding` auctions past their deadline and auto-transitions to `passed` (AC-8.2). `auctionSocket.getIO()` is called to broadcast state transitions — failing to broadcast must NOT abort the transition (log error, continue).

**Implementation guidance**:
- Export `cronTick(): Promise<void>` — runs all four transition checks in sequence
- `transitionToOpen()`: `UPDATE Auction SET status='open' WHERE status='scheduled' AND startAt <= now()` via `prisma.auction.updateMany`; broadcast `io.to('auction:${id}').emit('status', { status: 'open' })` for each transitioned auction
- `transitionToClosed()`: `UPDATE WHERE status='open' AND endsAt <= now()`; for each closed auction call `evaluateReserve(auction)`
- `evaluateReserve(auction)`: if `currentBid >= reservePrice` (or no reserve): transition to `sold`; if `currentBid < reservePrice`: branch on `reserveBehavior`
- `checkSellerDecisionExpiry()`: `UPDATE WHERE status='seller_deciding' AND sellerDecisionDeadline <= now()` → `passed`
- Wrap each UPDATE in try/catch — a failure in one check must not abort subsequent checks

**Pattern reference**: `api/src/lib/auctionSaleStats.ts` (prisma query pattern)

**Verify clauses**:
- Level: unit | Given: auction with status='scheduled' and startAt 1 minute ago | Action: call `transitionToOpen()` | Outcome: auction status becomes 'open'
- Level: unit | Given: `transitionToOpen()` called when no scheduled auctions exist | Action: call again | Outcome: no error, no state changes (idempotent)
- Level: unit | Given: closed auction with currentBid >= reservePrice and reserveBehavior='auto_pass' | Action: `evaluateReserve()` | Outcome: status = 'passed' (NOT 'sold' — reserve NOT met)
- Level: unit | Given: closed auction with reserveBehavior='seller_decision' and currentBid < reserve | Action: `evaluateReserve()` | Outcome: status = 'seller_deciding', sellerDecisionDeadline set to ~24h from now

> **Standards**: S-1, S-2

**Depends on**: STEP-2, STEP-10
**Enables**: STEP-15, STEP-16
**Parallel with**: STEP-13, STEP-18, STEP-23, STEP-27, STEP-31

---

#### STEP-15: Implement cron tick route
MANUAL -> cron endpoint that triggers lifecycle transitions on a Render Cron Service schedule | modify `api/src/routes/cron.ts` | Effort: XS

> **Intent**: N/A — structural step. The Render Cron Service calls `POST /api/admin/cron/tick` with `Authorization: Bearer $ADMIN_TOKEN` every minute. The `requireAdminToken` middleware (STEP-4) guards this endpoint — unauthenticated requests must return 401, not trigger lifecycle logic. The endpoint is idempotent: calling it twice in a minute is safe (handled by STEP-14's WHERE clauses).

**Implementation guidance**:
- Import `cronTick` from `../lib/auctionLifecycle`
- Apply `requireAdminToken` middleware
- Handler: `await cronTick(); res.json({ ok: true, timestamp: new Date().toISOString() })`
- Wrap in try/catch: on error, `res.status(500).json({ error: err.message })` and `console.error`

**Pattern reference**: `api/src/routes/cron.ts` skeleton (STEP-5)

**Verify clauses**:
- Level: integration | Given: cron tick called with wrong token | Action: POST /api/admin/cron/tick with bad Bearer | Outcome: 401

> **Standards**: S-1, S-3

**Depends on**: STEP-14
**Enables**: STEP-16
**Parallel with**: —

---

#### STEP-16: Test — lifecycle state machine transitions
MANUAL -> Test for STEP-14, STEP-15 | create `api/tests/auctionLifecycle.test.ts` | Effort: M

> **Intent**: The idempotency guarantee (NFR-3) is the primary risk — test that calling cronTick twice in succession does not double-transition any auction. Test all three reserve behaviors at close. Test seller_decision deadline expiry (requires mocking `Date.now`). The cron endpoint auth check must reject bad tokens with 401 — not 403 (403 would imply the token is valid but lacks permission).

**Implementation guidance**:
- Seed: create auction rows in DB with specific statuses and timestamps using `prisma.auction.create`
- Test 1: scheduled auction with past startAt → cronTick() → status = 'open'
- Test 2: cronTick() called again → status still 'open' (no double-transition)
- Test 3: open auction with past endsAt + high bid above reserve → cronTick() → status = 'sold'
- Test 4: closed, bid below reserve, reserveBehavior = 'auto_pass' → status = 'passed'
- Test 5: closed, bid below reserve, reserveBehavior = 'seller_decision' → status = 'seller_deciding', deadline set
- Test 6: POST /api/admin/cron/tick with invalid token → 401

**Pattern reference**: `api/tests/listings.test.ts` (STEP-12)

**Verify clauses**:
- Level: integration | Given: test suite for lifecycle | Action: `npm test` | Outcome: all 6 test cases pass

> **Standards**: S-1

**Depends on**: STEP-14, STEP-15
**Enables**: —
**Parallel with**: STEP-13

---

#### STEP-17: Implement seller accept/decline endpoint for seller_decision reserve mode
[FR-2 -> AC-2.4, FR-8 -> AC-8.1, FR-8 -> AC-8.3] | modify `api/src/routes/listings.ts` | Effort: S

> **Intent**: AC-2.4 requires the seller to receive a response window when an auction closes below reserve in `seller_decision` mode. The lifecycle sets the auction to `seller_deciding` and records `sellerDecisionDeadline` (STEP-14). This STEP adds the endpoint for the seller to respond. Accepting transitions to `sold` and triggers the settlement flow (invoice email). Declining transitions to `passed`. The endpoint must verify the requesting user is the listing's seller — not any authenticated user. Calling this endpoint after the deadline has passed (auction already auto-transitioned to `passed` by cron) returns 400.

**Implementation guidance**:
- POST `/api/listings/:id/seller-decision` with body `{ accept: boolean }`
- Check listing exists and `sellerId === userId` — 404 if not found, 403 if wrong seller
- Check linked `Auction.status === 'seller_deciding'` — 400 if not (expired or wrong state)
- If `accept`: update `Auction.status = 'sold'`; call `sendInvoiceEmail` for current high bidder (STEP-32)
- If `!accept`: update `Auction.status = 'passed'`
- Both paths: notify relevant parties via stubs

**Pattern reference**: `api/src/routes/listings.ts`

**Verify clauses**:
- Level: integration | Given: auction in seller_deciding status, seller JWT | Action: POST seller-decision with accept=true | Outcome: auction status = 'sold'
- Level: integration | Given: auction in seller_deciding, non-seller JWT | Action: POST seller-decision | Outcome: 403
- Level: integration | Given: auction already passed (deadline expired) | Action: POST seller-decision | Outcome: 400

> **Standards**: S-1, S-2

**Depends on**: STEP-14, STEP-32
**Enables**: —
**Parallel with**: STEP-16
