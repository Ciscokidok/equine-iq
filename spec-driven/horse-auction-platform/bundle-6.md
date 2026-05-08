> Stage: Depth — Real-Time Bidding API | Parallel: yes (file-disjoint from listing, lifecycle, catalog bundles) | Files: api/src/routes/auctions.ts, api/src/lib/auctionSocket.ts

**Bundle Verify**: Authenticated approved bidder can place a bid on an open auction; bid is broadcast to Socket.io room; auto-bid counter-bids correctly resolve; non-approved bidder is rejected
- **Level**: integration
- **Given**: Open auction in DB, approved bidder user, second auto-bidder with max 50000 cents
- **Action**: Bidder 1 places bid at starting bid; auto-bidder's max exceeded by bidder 1 → auto-bid fires; bidder without BidderApproval attempts bid
- **Outcome**: Bids accepted/rejected correctly; Socket.io room receives bid update; unapproved bidder gets 403

---

#### STEP-18: Implement bid placement route with bidder approval gate
[FR-3 -> AC-3.1, FR-3 -> AC-3.3, FR-3 -> AC-3.4, FR-5 -> AC-5.4] | modify `api/src/routes/auctions.ts` | Effort: M

> **Intent**: The deposit-to-bid model (AD-4) means every bid must be gated on `BidderApproval.status = 'approved'` for the requesting user — there is no Stripe card hold. An unapproved bidder gets 403 with a message directing them to the approval flow. The minimum bid is `auction.currentBid + auction.bidIncrement` (not `startingBid`) — except for the first bid, where the minimum is `auction.startingBid`. An off-by-one here (checking `>=` vs `>`) will incorrectly reject valid bids or accept below-minimum bids. Auto-bid resolution (from STEP-19) is called synchronously within the same transaction to prevent race conditions (AD-6). After all auto-bid resolution settles, the final currentBid is broadcast via Socket.io.

**Implementation guidance**:
- Schema: `{ amount: z.number().int().positive() }`
- Check auction status === 'open' — 400 if not
- Check `BidderApproval` where `userId = req.user.sub AND status = 'approved'` — 403 with `{ error: 'Bidder approval required', approvalUrl: '/my-bids/approval' }` if not found
- Minimum bid: `auction.currentBid ? auction.currentBid + auction.bidIncrement : auction.startingBid`
- If `amount < minimumBid`: return 400 `{ error: 'Bid must be at least ${minimumBid}' }`
- Create `Bid` record; update `Auction.currentBid` and `currentBidderId`; mark previous high bid as `status = 'outbid'`
- Call `resolveAutoBids(auctionId)` from STEP-19 (synchronous, same request)
- Broadcast final state: `getIO().to('auction:${auctionId}').emit('bid', { currentBid, bidder: initials, timeRemaining })`
- Return 200 with `{ newCurrentBid, minimumNextBid }`

**Pattern reference**: `api/src/routes/foals.ts`

**Verify clauses**:
- Level: integration | Given: open auction, approved bidder, bid amount = startingBid | Action: POST /api/auctions/:id/bid | Outcome: 200, auction.currentBid updated
- Level: integration | Given: open auction, bid amount < minimumBid | Action: POST bid | Outcome: 400 with error
- Level: integration | Given: user without BidderApproval record | Action: POST bid | Outcome: 403

> **Standards**: S-1, S-2, S-4

**Depends on**: STEP-5, STEP-2
**Enables**: STEP-19, STEP-20, STEP-21
**Parallel with**: STEP-13, STEP-14, STEP-23, STEP-27, STEP-31

---

#### STEP-19: Implement auto-bid resolution logic
[FR-4 -> AC-4.1, FR-4 -> AC-4.2, FR-4 -> AC-4.3] | modify `api/src/routes/auctions.ts` | Effort: M

> **Intent**: Auto-bid resolution must run synchronously inside the bid handler (AD-6) — not as a background job — to prevent races where two concurrent bids both trigger auto-bid chains that diverge. The two-auto-bidder scenario (AC-4.2) is the hardest case: if bidder A has max 10000 and bidder B has max 8000, and bidder B places 6000, the system should counter to 8100 (one increment above B's max), then B is outbid. If both have the same max, the first-placed auto-bid wins. The `autoMaxAmount` ceiling check (AC-4.3) must notify the auto-bidder when their max is exceeded — this notification is a stub `console.log` until STEP-39.

**Implementation guidance**:
- Export `resolveAutoBids(auctionId: string): Promise<void>` — called from STEP-18's bid handler
- Query all active auto-bids for this auction ordered by `autoMaxAmount DESC` — pick the highest max that is above current bid
- If a competing auto-bid exists and its max > currentBid + increment: place a new Bid at `currentBid + increment`; update auction currentBid; mark previous bid as outbid
- Repeat until no auto-bid can counter (or only one auto-bidder remains above the current bid + increment)
- Dual-auto-bidder resolution: the higher max wins at `lower_max + bidIncrement`; mark the lower auto-bidder as outbid and notify (stub)
- Guard against infinite loops: max 50 iterations before breaking (should never hit in practice)

**Pattern reference**: `api/src/routes/auctions.ts` (STEP-18)

**Verify clauses**:
- Level: unit | Given: auction at 5000 cents, bidder A auto-max=10000, bidder B places 5500 | Action: `resolveAutoBids()` | Outcome: currentBid = 6500 (5500 + 1000 increment), bidder A is high bidder
- Level: unit | Given: bidder A auto-max=10000, bidder B auto-max=8000, new bid at 6000 | Action: `resolveAutoBids()` | Outcome: currentBid = 8100 (B's max + 100 increment), A wins, B outbid notification stub called

> **Standards**: S-1, S-2

**Depends on**: STEP-18
**Enables**: STEP-20
**Parallel with**: —

---

#### STEP-20: Test — bid placement, auto-bid resolution, bidder approval gate
MANUAL -> Test for STEP-18, STEP-19 | create `api/tests/bidding.test.ts` | Effort: M

> **Intent**: The auto-bid competition scenario (two competing auto-bidders) is the most complex business logic in the system — it must be tested explicitly. The idempotency of the approval gate check (approved vs. pending) must be tested for both user and guest bidder types. Test the minimum bid calculation for first bid (uses startingBid) vs subsequent bids (uses currentBid + increment) — these are different code paths.

**Implementation guidance**:
- Test 1: first bid = startingBid exactly → accepted
- Test 2: bid below startingBid → 400
- Test 3: bid = currentBid (no increment) → 400
- Test 4: user with no BidderApproval → 403
- Test 5: auto-bid placed → subsequent manual bid triggers auto-counter → currentBid jumps correctly
- Test 6: two auto-bidders compete → higher max wins at lower_max + increment

**Pattern reference**: `api/tests/listings.test.ts`

**Verify clauses**:
- Level: integration | Given: bidding test suite | Action: `npm test` | Outcome: all 6 test cases pass

> **Standards**: S-1

**Depends on**: STEP-18, STEP-19
**Enables**: —
**Parallel with**: STEP-21, STEP-22

---

#### STEP-21: Wire Socket.io bid broadcast and auction room joins
[FR-3 -> AC-3.2, FR-2 -> AC-2.5] | modify `api/src/lib/auctionSocket.ts` | Effort: S

> **Intent**: AD-1 specifies `auction:<id>` room naming (S-4). The Socket.io `bid` event must include bidder initials (not name — AC-3.2 requires anonymization), new high bid in cents, and remaining time in seconds. The broadcast is already called from STEP-18's handler via `getIO()` — this STEP adds the `join-auction` event handler so clients can subscribe to a specific auction's room after connecting. The 500ms latency requirement (NFR-1) is met by in-process broadcast — no Redis hop. Status change events (lifecycle transitions from STEP-14) also broadcast to `auction:<id>` — this STEP wires that connection.

**Implementation guidance**:
- In `initSocket()`, add `io.on('connection', socket => { socket.on('join-auction', (auctionId) => socket.join('auction:${auctionId}')); socket.on('leave-auction', (auctionId) => socket.leave('auction:${auctionId}')) })`
- Add personal room join: on connection, `socket.join('user:${socket.data.user.sub}')` for authenticated users
- Export `broadcastBidUpdate(auctionId, { currentBid, bidderInitials, timeRemainingSeconds })` helper used by STEP-18
- Export `broadcastStatusChange(auctionId, status)` helper used by STEP-14's lifecycle transitions
- Bidder anonymization: `getInitials(name: string)` — first initial + last initial from `socket.data.user.sub` (use first 2 chars of UUID for guests)

**Pattern reference**: `api/src/lib/auctionSocket.ts` (STEP-2 base)

**Verify clauses**:
- Level: integration | Given: client connected and joined 'auction:test-id' | Action: emit broadcastBidUpdate | Outcome: client receives 'bid' event within test timeout with correct shape `{ currentBid, bidderInitials, timeRemainingSeconds }`

> **Standards**: S-1, S-4

**Depends on**: STEP-2, STEP-18
**Enables**: STEP-36 (frontend listens to these events)
**Parallel with**: STEP-20, STEP-22

---

#### STEP-22: Implement bidder approval admin routes
[FR-3 -> AC-3.3, FR-3 -> AC-3.4] | modify `api/src/routes/admin/bidders.ts` | Effort: S

> **Intent**: The deposit-to-bid model (AD-4) requires admin to explicitly approve each bidder. The `PATCH /:id/deposit-confirmed` endpoint marks the deposit as received and must be idempotent (calling it twice doesn't change the already-confirmed state). The approve endpoint transitions `BidderApproval.status` from `pending` to `approved`. Guest bidder approval uses the same endpoint — `guestBidderId` is used instead of `userId`. A suspended bidder's existing bids remain in place but they cannot place new bids (bid route checks `status = 'approved'`).

**Implementation guidance**:
- GET `/pending`: query `BidderApproval WHERE status = 'pending'` with user/guestBidder relation included
- POST `/:id/approve`: update `status = 'approved'`, `reviewedBy`, `reviewedAt`; notify bidder (stub)
- POST `/:id/suspend`: update `status = 'suspended'`; notify bidder (stub)
- PATCH `/:id/deposit-confirmed`: update `depositConfirmedAt = now()`; if status is `pending`, auto-approve (deposit confirmation = approval)
- All endpoints require `requireAuth + requireAdmin`

**Pattern reference**: `api/src/routes/admin/vetting.ts` (STEP-11 pattern)

**Verify clauses**:
- Level: integration | Given: BidderApproval in pending status | Action: POST /api/admin/bidders/:id/approve with admin JWT | Outcome: status = 'approved'
- Level: integration | Given: deposit-confirmed on already-approved bidder | Action: PATCH deposit-confirmed | Outcome: 200, no state regression

> **Standards**: S-1, S-3

**Depends on**: STEP-4, STEP-5
**Enables**: STEP-18 (bid route checks approval status)
**Parallel with**: STEP-20, STEP-21
