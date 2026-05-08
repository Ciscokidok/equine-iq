> Stage: Depth — Payment & Settlement | Parallel: yes (file-disjoint from listing, lifecycle, bidding, catalog, dashboard bundles) | Files: api/src/routes/auctions.ts, api/src/routes/auth.ts, api/src/lib/auctionNotifications.ts

**Bundle Verify**: Guest bidder can register and be approved; winning bidder receives invoice email on auction close; admin can confirm payment; next bidder offered on default
- **Level**: integration
- **Given**: Closed auction with high bidder, admin JWT
- **Action**: POST /api/admin/cron/tick (triggers sold transition) → invoice email sent (via SendGrid stub); POST /api/auctions/:id/confirm-payment; original winner defaults → POST /api/auctions/:id/offer-next-bidder
- **Outcome**: Invoice sent to winner (logged in test); payment confirmed updates Auction; next bidder offered at their bid price

---

#### STEP-31: Implement guest bidder registration and email verification
[FR-3 -> AC-3.4] | modify `api/src/routes/auth.ts` | Effort: S

> **Intent**: Guest bidders must verify their email before being approved to bid (AC-3.4). The `GuestBidder` model is separate from `User` (F-8) — the registration endpoint must not create a User record. The email verification token uses the same `claimToken` pattern already on the `User` model — a short-lived UUID stored in `verifyToken` with a 24h expiry. After verification, a `BidderApproval` record is created in `pending` status — the guest can then submit a deposit and await admin approval. The JWT issued for guest bidders must use a different `sub` claim prefix (`guest:${guestBidderId}`) to distinguish from user JWTs in the bid route.

**Implementation guidance**:
- POST `/api/auth/guest-register`: validate `{ email: z.string().email(), farmName: z.string().optional() }`; create `GuestBidder` with `emailVerified: false, verifyToken: uuid()`; send verification email (stub console.log); return 201
- POST `/api/auth/guest-verify`: validate `{ token: z.string() }`; find GuestBidder by verifyToken; if expired (>24h) return 400; update `emailVerified: true, verifyToken: null`; create `BidderApproval` with status 'pending'; issue guest JWT with `{ sub: 'guest:${guestBidderId}', role: 'guest' }`; return token
- Bid route (STEP-18) checks for guest JWT: `userId = req.user.sub.startsWith('guest:') ? null : req.user.sub`; `guestBidderId = req.user.sub.startsWith('guest:') ? req.user.sub.slice(6) : null`

**Pattern reference**: `api/src/routes/auth.ts` (existing JWT + verify token pattern)

**Verify clauses**:
- Level: integration | Given: valid email submitted to guest-register | Action: POST /api/auth/guest-register | Outcome: 201, GuestBidder created, emailVerified = false
- Level: integration | Given: guest-verify with correct token | Action: POST /api/auth/guest-verify | Outcome: JWT returned with 'guest:' sub prefix, BidderApproval created in pending status

> **Standards**: S-1

**Depends on**: STEP-5
**Enables**: STEP-18 (guests can bid after approval), STEP-33
**Parallel with**: STEP-13, STEP-14, STEP-18, STEP-23, STEP-27

---

#### STEP-32: Implement invoice generation and SendGrid settlement email
[FR-5 -> AC-5.3] | create `api/src/lib/auctionNotifications.ts` | Effort: S

> **Intent**: The invoice email is the primary payment instrument for the deposit-to-bid model (AD-4). It must include: hammer price, buyer's premium amount, total due (hammer + premium), 48h payment deadline, wire transfer instructions (placeholder for MVP), and the auction house contact. `buyersPremiumAmount = Math.round(auction.currentBid * listing.buyersPremiumPct / 100)` — integer cents, rounded (S-2). The seller notification must include only the hammer price (not the buyer's premium — that is platform revenue). Both emails use the existing `@sendgrid/mail` client pattern from `api/src/lib/mailer.ts`.

**Implementation guidance**:
- Export `sendInvoiceEmail({ auctionId, winnerEmail, hammerPrice, buyersPremiumPct })`: compute `premiumAmount`, `totalDue`; send SendGrid email with invoice details; `console.log` in test env (check `process.env.NODE_ENV === 'test'`)
- Export `sendSellerNotification({ sellerEmail, horseName, hammerPrice })`: send seller "Your horse sold!" email
- Export `sendOutbidNotification({ bidderEmail, horseName, auctionId })`: stub for STEP-39 to wire
- Export `sendStatusChangeNotification({ emails, auctionId, newStatus })`: stub for STEP-39
- All functions: catch errors, log, never throw — notification failure must not abort the calling action

**Pattern reference**: `api/src/lib/mailer.ts`

**Verify clauses**:
- Level: unit | Given: `sendInvoiceEmail` called with hammerPrice=50000 (cents) and buyersPremiumPct=10 | Action: call function | Outcome: premiumAmount = 5000, totalDue = 55000 (no floating-point error)
- Level: inspection | Given: SendGrid call in test env | Action: check NODE_ENV guard | Outcome: console.log used instead of actual SendGrid send

> **Standards**: S-1, S-2

**Depends on**: STEP-1
**Enables**: STEP-33, STEP-39
**Parallel with**: STEP-31

---

#### STEP-33: Implement payment confirmation and next-bidder offer routes
[FR-5 -> AC-5.1, FR-5 -> AC-5.4] | modify `api/src/routes/auctions.ts` | Effort: S

> **Intent**: The payment confirmation route transitions `Auction.status` from `sold` to `payment_confirmed` (add this to ListingStatus enum if not present — or use a `paymentConfirmedAt` timestamp). AC-5.4 (failed capture = next bidder offered) translates in the deposit-to-bid model to admin marking the winner as defaulted and offering the horse to the next highest bidder. The next-bidder offer must find the highest `Bid` where `status != 'won'` and `userId != winnerId` (or `guestBidderId != winnerGuestId`), then send them an offer email with a 24h acceptance window. Admin-only routes (requireAuth + requireAdmin).

**Implementation guidance**:
- POST `/:id/confirm-payment` (admin): update `Auction` set `paymentConfirmedAt = now()`; send seller payout notification (stub); send buyer confirmation email via `sendInvoiceEmail` (already sent — this confirms receipt)
- POST `/:id/offer-next-bidder` (admin): find next highest bid; update `Bid.status = 'won_pending'` for that bid; send offer email (stub via `sendOutbidNotification` with custom message); update `Auction.currentBidderId` to next bidder; set `sellerDecisionDeadline = now() + 24h` (reuse for offer deadline)
- Both routes require `requireAuth + requireAdmin`

**Pattern reference**: `api/src/routes/admin/vetting.ts` (STEP-11)

**Verify clauses**:
- Level: integration | Given: sold auction | Action: POST /api/auctions/:id/confirm-payment with admin JWT | Outcome: auction.paymentConfirmedAt set
- Level: integration | Given: sold auction with multiple bidders | Action: POST /api/auctions/:id/offer-next-bidder | Outcome: second-highest bidder's bid status = 'won_pending'

> **Standards**: S-1, S-2, S-3

**Depends on**: STEP-14, STEP-32
**Enables**: STEP-34
**Parallel with**: STEP-31

---

#### STEP-34: Test — invoice calculation, payment confirmation, next-bidder offer
MANUAL -> Test for STEP-32, STEP-33 | create `api/tests/settlement.test.ts` | Effort: S

> **Intent**: The buyer's premium calculation is a core business logic test — integer cents rounding at the boundary (e.g., hammerPrice=50001 cents at 10% = 5000.1 → rounded to 5000 or 5001 cents, must be consistent). Test that offering next bidder does not offer the current winner (even if they're also in the bid history). Test that non-admin cannot access payment confirmation or next-bidder offer routes.

**Implementation guidance**:
- Test 1: premiumAmount = round(hammerPrice * pct / 100) is integer cents, no float errors
- Test 2: confirm-payment sets paymentConfirmedAt
- Test 3: offer-next-bidder finds 2nd highest bidder, not the winner
- Test 4: non-admin JWT → 403 on both routes

**Verify clauses**:
- Level: integration | Given: settlement test suite | Action: `npm test` | Outcome: all 4 cases pass

> **Standards**: S-1, S-2

**Depends on**: STEP-32, STEP-33
**Enables**: —
**Parallel with**: STEP-27, STEP-28
