> Stage: Depth — Notifications & Watchers | Parallel: yes (file-disjoint from most API bundles; modifies auctionNotifications.ts started in Bundle 9) | Files: api/src/lib/auctionNotifications.ts, api/src/routes/auctions.ts, api/src/lib/auctionLifecycle.ts

**Bundle Verify**: Bidder who is outbid receives outbid notification; auction state change triggers notification to all watchers; watch endpoint adds user to watcher list
- **Level**: integration
- **Given**: Open auction with watcher; bid placed that outbids the watcher
- **Action**: POST /api/auctions/:id/bid (outbids watcher) → POST /api/auctions/:id/watch; then close auction via cronTick
- **Outcome**: Watcher receives outbid Socket.io event on user room; auction close sends status notification to all watchers

---

#### STEP-39: Wire outbid and status-change notification fan-out
[FR-3 -> AC-3.5, FR-2 -> AC-2.5] | modify `api/src/lib/auctionNotifications.ts`, modify `api/src/lib/auctionLifecycle.ts`, modify `api/src/routes/auctions.ts` | Effort: S

> **Intent**: AC-3.5 requires outbid notifications to fire "immediately" when a user is displaced as high bidder — this means within the same bid handler request, before returning 200. AC-2.5 requires all participants (bidders + watchers) to receive status change notifications on every auction state transition. Notification failures must not abort the bid or transition — wrap all notification calls in try/catch (matching the pattern in STEP-32's intent). Socket.io personal room (`user:<id>`) handles in-app notifications; SendGrid handles email.

**Implementation guidance**:
- In bid handler (STEP-18): after updating currentBid, find the displaced high bidder; call `getIO().to('user:${displcedBidderId}').emit('outbid', { auctionId, horseName, currentBid })` and `sendOutbidNotification({ bidderEmail, horseName, auctionId })`
- In `transitionToOpen/transitionToClosed` (STEP-14): after each batch update, query watchers for affected auctions; call `sendStatusChangeNotification({ emails, auctionId, newStatus })` for each
- In `auctionNotifications.ts`: implement the stubbed `sendOutbidNotification` and `sendStatusChangeNotification` using `@sendgrid/mail` (following `mailer.ts` pattern); in test env, use console.log
- Watch endpoint (see STEP-40) populates `AuctionWatcher` — notification fan-out reads from this table

**Pattern reference**: `api/src/lib/auctionNotifications.ts` (STEP-32 stubs)

**Verify clauses**:
- Level: unit | Given: bid handler displaces current high bidder | Action: mock getIO and sendOutbidNotification | Outcome: both called with correct auctionId and displaced bidder identifiers
- Level: unit | Given: notification function throws | Action: call bid handler | Outcome: bid handler still returns 200 (notification failure doesn't abort)

> **Standards**: S-1, S-4

**Depends on**: STEP-18, STEP-32, STEP-40
**Enables**: —
**Parallel with**: STEP-27, STEP-28, STEP-31

---

#### STEP-40: Implement auction watch endpoint
[FR-2 -> AC-2.5] | modify `api/src/routes/auctions.ts` | Effort: XS

> **Intent**: N/A — structural step. The watch endpoint creates an `AuctionWatcher` record linking a user (or guest email) to an auction. It must be idempotent — watching an already-watched auction returns 200 without creating a duplicate record (use `upsert` or unique constraint check). Unauthenticated users can watch by email (guest watch) — this does not require a verified email or BidderApproval.

**Implementation guidance**:
- POST `/:id/watch`: if authenticated — `upsert AuctionWatcher WHERE { auctionId, userId }`; if unauthenticated with `{ email }` body — `upsert AuctionWatcher WHERE { auctionId, guestEmail }`
- Return 200 `{ watching: true }`

**Pattern reference**: `api/src/routes/auctions.ts` (STEP-5 skeleton)

**Verify clauses**:
- Level: integration | Given: user watches an auction | Action: POST /api/auctions/:id/watch twice | Outcome: second call returns 200, only one AuctionWatcher record exists

> **Standards**: S-1

**Depends on**: STEP-5
**Enables**: STEP-39
**Parallel with**: STEP-39
