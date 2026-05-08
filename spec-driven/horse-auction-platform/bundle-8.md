> Stage: Depth — Seller & Buyer Dashboard API | Parallel: yes (file-disjoint from listing, lifecycle, bidding, catalog bundles) | Files: api/src/routes/listings.ts, api/src/routes/auctions.ts

**Bundle Verify**: Seller sees their listings grouped by status; buyer sees auctions they bid on with winning/outbid status
- **Level**: integration
- **Given**: Seller with listings in pending_review, open, sold; buyer with bids in two auctions (one winning, one outbid)
- **Action**: GET /api/listings/mine with seller JWT; GET /api/auctions/my-bids with buyer JWT
- **Outcome**: Seller response groups listings by status; buyer response shows current bid status per auction

---

#### STEP-27: Implement seller listings dashboard route
[FR-7 -> AC-7.1] | modify `api/src/routes/listings.ts` | Effort: S

> **Intent**: The seller dashboard groups listings by status (AC-7.1). Each listing entry shows `bidCount` (count of bids on the linked auction) and `currentHighBid` — these require joining to the `Auction` and `Bid` tables. A listing in `pending_review` has no Auction record — bidCount and currentHighBid must be null (not 0) for these. Listing statuses span both `AuctionListing.status` and `Auction.status` — for `open`/`closed`/`sold`/`passed` listings, the source of truth is `Auction.status`, not `AuctionListing.status`.

**Implementation guidance**:
- GET `/mine`: query `prisma.auctionListing.findMany({ where: { sellerId: userId }, include: { horse: { select: { name, breed } }, auction: { include: { _count: { select: { bids: true } } } } } })`
- Map response: group by status, include `bidCount: auction?._count.bids ?? null` and `currentHighBid: auction?.currentBid ?? null`
- Statuses to group: `pending_review`, `approved`, `scheduled`, `open`, `closed`, `seller_deciding`, `counter_offering`, `sold`, `passed`

**Pattern reference**: `api/src/routes/listings.ts`

**Verify clauses**:
- Level: integration | Given: seller with listings in 3 different statuses | Action: GET /api/listings/mine | Outcome: response contains listings grouped by status with correct bidCount
- Level: integration | Given: listing in pending_review (no auction) | Action: GET /api/listings/mine | Outcome: listing present with bidCount: null (not 0)

> **Standards**: S-1, S-2

**Depends on**: STEP-5, STEP-8
**Enables**: STEP-29
**Parallel with**: STEP-13, STEP-14, STEP-18, STEP-23, STEP-28, STEP-31

---

#### STEP-28: Implement buyer bids dashboard route
[FR-7 -> AC-7.2] | modify `api/src/routes/auctions.ts` | Effort: S

> **Intent**: The buyer dashboard shows auctions the user has bid on, their current bid status (winning/outbid), won auctions, and active auto-bid configurations (AC-7.2). A user is "winning" if their userId matches `auction.currentBidderId` and `auction.status = 'open'`. They are "outbid" if they have a bid on an open auction but are not the current high bidder. Auto-bid configurations are active `Bid` records with `isAutoBid = true` and `status = 'active'`.

**Implementation guidance**:
- GET `/my-bids`: query `prisma.bid.findMany({ where: { userId, status: { in: ['active', 'outbid', 'won'] } }, include: { auction: { include: { listing: { include: { horse: { select: { name } } } } } } }, distinct: ['auctionId'] })`
- Compute `bidStatus` per auction: `auction.currentBidderId === userId && auction.status === 'open'` → 'winning'; else if bid.status === 'outbid' → 'outbid'; auction.status === 'sold' && bid.status === 'won' → 'won'
- Include auto-bids: `isAutoBid = true, status = 'active'` → return `{ autoMaxAmount, currentBid }`

**Pattern reference**: `api/src/routes/listings.ts` (STEP-27 pattern)

**Verify clauses**:
- Level: integration | Given: buyer is current high bidder on open auction | Action: GET /api/auctions/my-bids | Outcome: auction appears with bidStatus 'winning'
- Level: integration | Given: buyer was outbid | Action: GET /api/auctions/my-bids | Outcome: auction appears with bidStatus 'outbid'

> **Standards**: S-1, S-2

**Depends on**: STEP-5, STEP-18
**Enables**: STEP-30
**Parallel with**: STEP-27
