---
title: "Tasks: Horse Auction Platform"
slug: horse-auction-platform
status: final
design_source: spec-driven/horse-auction-platform/design.md
design_hash: sha256:14c5f59ec85256d8dcb45e9343329dab088e687f9df6eec5d237efb97289fbb5
spec_source: spec-driven/horse-auction-platform/spec.md
spec_hash: sha256:272f593d08ffb1502869a7da03c9f8d2d97556d67e1f043ccce4802db664c65d
strategy: walking-skeleton
total_steps: 51
total_slices: 12
total_bundles: 15
validation: skipped
version: 2.0
date: 2026-05-08
---

# Tasks: Horse Auction Platform

> Design: spec-driven/horse-auction-platform/design.md | Spec: spec-driven/horse-auction-platform/spec.md | Strategy: Walking Skeleton | Generated: 2026-05-08 | Status: Draft

> Do not edit this document after finalization. Track execution in `spec-driven/horse-auction-platform/progress-bundle-N.md` files.

---

## Traceability

### Functional Requirements

| FR | Priority | AC | STEPs | Bundle |
|----|----------|----|-------|--------|
| FR-1 | Must-Have | AC-1.1, AC-1.2, AC-1.3, AC-1.4, AC-1.5 | STEP-1, STEP-8, STEP-9, STEP-10, STEP-11, STEP-12, STEP-13 | 1, 3, 4 |
| FR-2 | Must-Have | AC-2.1, AC-2.2, AC-2.3, AC-2.4, AC-2.5 | STEP-14, STEP-15, STEP-16, STEP-17, STEP-39, STEP-40 | 5, 10 |
| FR-3 | Must-Have | AC-3.1, AC-3.2, AC-3.3, AC-3.4, AC-3.5 | STEP-18, STEP-19, STEP-20, STEP-21, STEP-22, STEP-31, STEP-36, STEP-37, STEP-39 | 6, 9, 12 |
| FR-4 | Should-Have | AC-4.1, AC-4.2, AC-4.3 | STEP-19, STEP-20 | 6 |
| FR-5 | Must-Have | AC-5.1, AC-5.2, AC-5.3, AC-5.4 | STEP-31, STEP-32, STEP-33, STEP-34 | 9 |
| FR-6 | Must-Have | AC-6.1, AC-6.2, AC-6.3 | STEP-23, STEP-24, STEP-25, STEP-26 | 7, 11 |
| FR-7 | Must-Have | AC-7.1, AC-7.2 | STEP-27, STEP-28, STEP-29, STEP-30 | 8, 11 |
| FR-8 | Should-Have | AC-8.1, AC-8.2, AC-8.3 | STEP-14, STEP-17 | 5 |
| FR-9 | Nice-to-Have | AC-9.1, AC-9.2, AC-9.3, AC-9.4 | STEP-3, STEP-44, STEP-45, STEP-46, STEP-47 | 1, 14 |
| FR-10 | Must-Have | AC-10.1, AC-10.2, AC-10.3 | STEP-4, STEP-11, STEP-42, STEP-43 | 1, 3, 13 |

### Non-Functional Requirements

| NFR | Disposition | STEP / Mechanism | Verification |
|-----|-------------|------------------|--------------|
| NFR-1: Bid broadcast < 500ms | Implemented | STEP-21 | Verify clause on STEP-21 checks Socket.io in-process broadcast latency |
| NFR-2: Security (auth, virus scan) | Implemented | STEP-2 (JWT on handshake), STEP-7 (S3 key structure), STEP-9 (scan status gate) | Verify clauses on STEP-2 and STEP-9 |
| NFR-3: Idempotent state transitions | Implemented | STEP-14 (WHERE status = 'expected_source' pattern) | Verify clause on STEP-14 and STEP-16 |
| NFR-4: Cron reliability | Implemented | STEP-15 (Render Cron Service external trigger) | Platform — Render Cron fires independently of web service sleep state |
| NFR-5: Cloud document storage | Implemented | STEP-7, STEP-9 (S3 presigned URLs) | Verify clause on STEP-7 confirms no Render disk dependency |

---

## Slice 1: Foundation (Stage: skeleton)

> Proves the full-stack wiring end-to-end — schema, Socket.io init, admin middleware, adapter interface, skeleton routes.

### Bundle 1: Foundation — Schema, Socket.io, Admin Middleware, Adapter Types
> Stage: skeleton | Parallel: no (init-order constraint) | Files: api/package.json, frontend/package.json, api/prisma/schema.prisma, api/src/index.ts, api/src/lib/auctionSocket.ts, api/src/lib/adapters/types.ts, api/src/middleware/admin.ts

**Bundle Verify**: Server starts with Socket.io attached, admin routes reject non-admin tokens, TypeScript compiles clean
- **Level**: integration
- **Given**: API started with `npm run dev`
- **Action**: `GET /health` → 200; `POST /api/admin/vetting/queue` with user JWT → 403; `tsc --noEmit` passes
- **Outcome**: All three checks pass

See: `spec-driven/horse-auction-platform/bundle-1.md`

### Bundle 2: Foundation — Route Stubs and Frontend Skeleton
> Stage: skeleton | Parallel: no (route registration depends on Bundle 1) | Files: api/src/routes/auctions.ts, api/src/routes/listings.ts, api/src/routes/cron.ts, api/src/routes/admin/vetting.ts, api/src/routes/admin/bidders.ts, api/src/routes/admin/adapters.ts, api/src/index.ts, frontend/src/App.tsx, frontend/src/components/Layout.tsx

**Bundle Verify**: All auction route stubs registered and reachable; public catalog accessible without auth
- **Level**: integration
- **Given**: API server running
- **Action**: `GET /api/auctions/catalog` → 501; `POST /api/listings` with JWT → 501; `/auctions` in browser → no redirect to login
- **Outcome**: 501s confirm routes registered; public route accessible without auth

See: `spec-driven/horse-auction-platform/bundle-2.md`

---

## Slice 2: Listing & Vetting (Stage: depth)

> Seller can create listings, upload vetting documents to S3, and admin can review and approve.

### Bundle 3: Listing & Vetting API
> Stage: depth | Parallel: yes (file-disjoint from lifecycle, bidding, catalog, dashboard API bundles) | Files: api/src/lib/s3Upload.ts, api/src/routes/listings.ts, api/src/routes/admin/vetting.ts

**Bundle Verify**: Full listing → document upload → vetting approval flow works end-to-end via API
- **Level**: integration
- **Given**: Valid seller JWT, admin JWT, horse owned by seller in DB
- **Action**: POST /api/listings → POST /api/listings/:id/documents/upload-url (3 required docs) → POST /api/listings/:id/configure → GET /api/admin/vetting/queue → POST /api/admin/vetting/:id/approve
- **Outcome**: Listing progresses pending_review → scheduled; non-admin JWT on queue returns 403

See: `spec-driven/horse-auction-platform/bundle-3.md`

### Bundle 4: Listing Frontend (CreateListing View)
> Stage: depth | Parallel: yes (file-disjoint from API bundles) | Files: frontend/src/views/CreateListing.tsx, frontend/src/api/auctions.ts

**Bundle Verify**: Seller can complete listing creation flow in the UI including document upload and auction configure form
- **Level**: inspection
- **Given**: Frontend running, auth token present, horse in user's account
- **Action**: Navigate to /auctions/create; complete horse select + doc upload + configure form
- **Outcome**: Form renders all AC-1.1 + AC-1.4 fields; configure form only shown when listing is approved

See: `spec-driven/horse-auction-platform/bundle-4.md`

---

## Slice 3: Auction Lifecycle (Stage: depth)

> Auctions transition through states via idempotent cron ticks; reserve behaviors handled correctly.

### Bundle 5: Auction Lifecycle + Cron + Reserve Behaviors
> Stage: depth | Parallel: yes (file-disjoint from listing, bidding, catalog, dashboard bundles) | Files: api/src/lib/auctionLifecycle.ts, api/src/routes/cron.ts, api/src/routes/listings.ts

**Bundle Verify**: Cron tick is idempotent; all reserve behaviors transition correctly; seller can respond to seller_decision window
- **Level**: integration
- **Given**: Auctions in scheduled/open/seller_deciding states with past timestamps
- **Action**: POST /api/admin/cron/tick twice; POST /api/listings/:id/seller-decision with accept=true
- **Outcome**: Transitions fire once (idempotent); seller decision accepted → sold

See: `spec-driven/horse-auction-platform/bundle-5.md`

---

## Slice 4: Real-Time Bidding (Stage: depth)

> Live bid placement with bidder approval gate, auto-bid resolution, Socket.io broadcast, and bidder admin management.

### Bundle 6: Real-Time Bidding API
> Stage: depth | Parallel: yes (file-disjoint from listing, lifecycle, catalog, dashboard bundles) | Files: api/src/routes/auctions.ts, api/src/lib/auctionSocket.ts

**Bundle Verify**: Approved bidder places bid, auto-bid resolves correctly, Socket.io broadcasts final state, unapproved bidder rejected
- **Level**: integration
- **Given**: Open auction, approved bidder, auto-bidder with max 50000 cents
- **Action**: Place bid at startingBid; auto-bid fires; unapproved user attempts bid
- **Outcome**: Bids resolve correctly; Socket.io room receives bid event; unapproved bidder gets 403

See: `spec-driven/horse-auction-platform/bundle-6.md`

---

## Slice 5: Auction Catalog & Horse Passport (Stage: depth)

> Public browsable catalog with filters; auction detail includes full horse passport and vet documents.

### Bundle 7: Auction Catalog API
> Stage: depth | Parallel: yes (file-disjoint from listing, lifecycle, bidding, dashboard bundles) | Files: api/src/routes/auctions.ts

**Bundle Verify**: Public catalog returns filtered auctions; detail includes horse passport; non-public auctions return 404
- **Level**: integration
- **Given**: DB with open + scheduled + sold auctions; no auth token
- **Action**: GET /api/auctions/catalog; catalog with breed filter; GET /api/auctions/:id (sold auction)
- **Outcome**: Catalog returns open+scheduled only; filter narrows; sold auction detail → 404

See: `spec-driven/horse-auction-platform/bundle-7.md`

---

## Slice 6: Seller & Buyer Dashboards (Stage: depth)

> Seller views their listings grouped by status; buyer views bids with winning/outbid/won status.

### Bundle 8: Dashboard API
> Stage: depth | Parallel: yes (file-disjoint from listing, lifecycle, bidding, catalog bundles) | Files: api/src/routes/listings.ts, api/src/routes/auctions.ts

**Bundle Verify**: Seller dashboard groups listings by status with bid counts; buyer dashboard shows correct bid status
- **Level**: integration
- **Given**: Seller with listings in 3 statuses; buyer winning one auction, outbid on another
- **Action**: GET /api/listings/mine; GET /api/auctions/my-bids
- **Outcome**: Seller response groups correctly with bidCount; buyer shows 'winning'/'outbid' statuses

See: `spec-driven/horse-auction-platform/bundle-8.md`

---

## Slice 7: Payment & Settlement (Stage: depth)

> Deposit-to-bid guest registration, invoice generation, payment confirmation, and next-bidder offer.

### Bundle 9: Payment & Settlement
> Stage: depth | Parallel: yes (file-disjoint from listing, lifecycle, bidding, catalog, dashboard bundles) | Files: api/src/routes/auth.ts, api/src/lib/auctionNotifications.ts, api/src/routes/auctions.ts

**Bundle Verify**: Guest registers + verifies email; winner receives invoice; admin confirms payment; next bidder offered on default
- **Level**: integration
- **Given**: Guest email, closed sold auction with multiple bidders
- **Action**: POST /auth/guest-register → verify token; cronTick → sold; invoice sent (logged); POST confirm-payment; POST offer-next-bidder
- **Outcome**: Guest JWT issued; invoice calculation correct (integer cents); payment confirmed; next bidder identified

See: `spec-driven/horse-auction-platform/bundle-9.md`

---

## Slice 8: Notifications & Watchers (Stage: depth)

> Outbid and status-change notifications fan out to bidders and watchers via Socket.io + SendGrid.

### Bundle 10: Notifications & Watch Endpoint
> Stage: depth | Parallel: yes (depends on STEP-32 and STEP-18 being complete; file-disjoint from most depth bundles) | Files: api/src/lib/auctionNotifications.ts, api/src/routes/auctions.ts, api/src/lib/auctionLifecycle.ts

**Bundle Verify**: Outbid notification fires when displaced; watcher receives status change on auction close; watch is idempotent
- **Level**: integration
- **Given**: Open auction with watcher; bid placed that outbids watcher
- **Action**: POST bid (outbids watcher); POST /api/auctions/:id/watch twice
- **Outcome**: Outbid Socket.io event emitted; second watch returns 200, single watcher record

See: `spec-driven/horse-auction-platform/bundle-10.md`

---

## Slice 9: Frontend Core Views (Stage: depth)

> AuctionCatalog, SellerDashboard, BuyerDashboard public and protected frontend views.

### Bundle 11: Frontend Catalog & Dashboards
> Stage: depth | Parallel: yes (file-disjoint from frontend bidding and admin bundles) | Files: frontend/src/views/AuctionCatalog.tsx, frontend/src/views/SellerDashboard.tsx, frontend/src/views/BuyerDashboard.tsx, frontend/src/api/auctions.ts

**Bundle Verify**: Catalog renders publicly with filters; seller dashboard groups listings; buyer dashboard shows bid statuses
- **Level**: inspection
- **Given**: Frontend running, mocked API
- **Action**: /auctions without auth; /my-listings with seller JWT; /my-bids with buyer JWT
- **Outcome**: Catalog: no auth redirect; filters trigger refetch. Seller: status groups visible. Buyer: winning/outbid badges correct.

See: `spec-driven/horse-auction-platform/bundle-11.md`

---

## Slice 10: Frontend Bidding Interface (Stage: depth)

> AuctionDetail view with live Socket.io connection, bid form, horse passport, and bidder approval flow.

### Bundle 12: Frontend Bidding Interface
> Stage: depth | Parallel: yes (file-disjoint from catalog/dashboard and admin frontend bundles) | Files: frontend/src/views/AuctionDetail.tsx, frontend/src/api/auctions.ts

**Bundle Verify**: AuctionDetail connects to Socket.io, bid form works, unapproved user sees approval barrier
- **Level**: inspection
- **Given**: Open auction, authenticated approved bidder; unauthenticated user; pending-approval user
- **Action**: View AuctionDetail for all three user states
- **Outcome**: Approved user sees bid form. Unauthenticated sees sign-in prompt. Pending user sees deposit instructions.

See: `spec-driven/horse-auction-platform/bundle-12.md`

---

## Slice 11: Admin Frontend (Stage: depth)

> Admin views for vetting queue review and bidder approval management.

### Bundle 13: Admin Frontend — VettingQueue + BidderApproval
> Stage: depth | Parallel: yes (file-disjoint from catalog/bidding frontend bundles) | Files: frontend/src/views/admin/VettingQueue.tsx, frontend/src/views/admin/BidderApproval.tsx, frontend/src/api/auctions.ts

**Bundle Verify**: Admin can approve a listing from vetting queue and approve a bidder from approval queue
- **Level**: inspection
- **Given**: Admin user, listing in pending_review with 3 docs, bidder in pending approval
- **Action**: Navigate to /admin/vetting → approve listing; navigate to /admin/bidders → approve bidder
- **Outcome**: Both items removed from queues after approval. Non-admin sees "Access denied".

See: `spec-driven/horse-auction-platform/bundle-13.md`

---

## Slice 12: External Adapter & Final Wiring (Stage: integration)

> AuctionHouseAdapter interface, BidpathAdapter stub, registry, and full project wiring with tsc verification.

### Bundle 14: External Auction House Adapter
> Stage: integration | Parallel: no (integration stage) | Files: api/src/lib/adapters/registry.ts, api/src/lib/adapters/BidpathAdapter.ts, api/src/routes/admin/adapters.ts, api/src/lib/auctionSocket.ts

**Bundle Verify**: AdapterRegistry activates via DB flag; BidpathAdapter throws expected stub error; external lot events route to Socket.io rooms
- **Level**: integration
- **Given**: AdapterConfig table with bidpath active=false; admin JWT
- **Action**: PATCH /api/admin/adapters/bidpath/activate → 422 with stub error; adapter.onLotStateUpdate fires for known external lot
- **Outcome**: Registry handles activation failure gracefully; external lot event broadcasts to correct room

See: `spec-driven/horse-auction-platform/bundle-14.md`

### Bundle 15: Final Wiring & TypeScript Verification
> Stage: integration | Parallel: no (must follow all depth bundles) | Files: frontend/src/App.tsx, frontend/src/api/auctions.ts, api/src/index.ts

**Bundle Verify**: Zero TypeScript errors in both API and frontend; all routes wired in index.ts; all frontend routes in App.tsx with correct auth guards
- **Level**: inspection
- **Given**: All prior bundles complete
- **Action**: `node_modules/.bin/tsc --noEmit` in api/ and frontend/
- **Outcome**: Both exit 0 with zero errors

See: `spec-driven/horse-auction-platform/bundle-15.md`

---

## Conflict Analysis

> Note: Covers explicitly declared file paths only. Implicit touches (barrel/index files, package-lock.json, route registration) may require manual sequencing during execution.

| Hot File | Touched By | Strategy |
|----------|------------|----------|
| `api/src/routes/auctions.ts` | STEP-5 (Bundle 2), STEP-18 (Bundle 6), STEP-23 (Bundle 7), STEP-28 (Bundle 8), STEP-33 (Bundle 9), STEP-40 (Bundle 10) | Sequential — each bundle builds on the prior; depth bundles run after Bundle 2 |
| `api/src/routes/listings.ts` | STEP-5 (Bundle 2), STEP-8 (Bundle 3), STEP-17 (Bundle 5), STEP-27 (Bundle 8) | Sequential — Bundle 2 creates skeleton; Bundle 3 and 5 add handlers independently (different handler functions); Bundle 8 adds listings/mine |
| `api/src/index.ts` | STEP-2 (Bundle 1), STEP-5 (Bundle 2), STEP-50 (Bundle 15) | Sequential — Bundle 1 upgrades server; Bundle 2 registers routes; Bundle 15 adds final imports |
| `frontend/src/App.tsx` | STEP-6 (Bundle 2), STEP-48 (Bundle 15) | Sequential — Bundle 2 adds stub routes; Bundle 15 replaces with real components |
| `frontend/src/api/auctions.ts` | STEP-13 (Bundle 4), STEP-26 (Bundle 11), STEP-36 (Bundle 12), STEP-42 (Bundle 13), STEP-49 (Bundle 15) | Parallel depth bundles add hooks to same file — agents must add hooks without removing existing ones; Bundle 15 audits and consolidates |
| `api/src/lib/auctionSocket.ts` | STEP-2 (Bundle 1), STEP-21 (Bundle 6), STEP-47 (Bundle 14) | Sequential — Bundle 1 creates; Bundle 6 and 14 add broadcast helpers |
| `api/src/lib/auctionNotifications.ts` | STEP-32 (Bundle 9), STEP-39 (Bundle 10) | Sequential — Bundle 9 creates stubs; Bundle 10 implements them |
| `api/prisma/schema.prisma` | STEP-1 (Bundle 1) only | Single touch — all schema changes in one migration |

**Hot file note**: `frontend/src/api/auctions.ts` is touched by 5 parallel depth bundles (4, 11, 12, 13) and Bundle 15. Each parallel bundle appends new hooks without modifying existing ones. Bundle 15 (STEP-49) does a final consolidation pass. Agents working in parallel on this file must coordinate by only adding, not modifying, existing exports.

---

## Architecture Decisions

See: `spec-driven/horse-auction-platform/design.md`

Key decisions informing this decomposition:
- **AD-1** (http.createServer + Socket.io): drives Bundle 1 init-order constraint
- **AD-2** (Render Cron + DB poll): drives Bundle 5 idempotency requirement
- **AD-3** (S3 presigned URLs): drives Bundle 3 S3 utility STEP
- **AD-4** (Deposit-to-bid): drives Bundle 9 structure and removal of Stripe card holds
- **AD-5** (AuctionHouseAdapter): drives Bundle 14 separation from core logic
- **AD-6** (Auto-bid synchronous): drives STEP-19 being in same bundle as STEP-18

---

## File Structure

    spec-driven/horse-auction-platform/tasks.md          — This file (index only)
    spec-driven/horse-auction-platform/bundle-1.md        — Foundation: schema, Socket.io, admin middleware, adapter types
    spec-driven/horse-auction-platform/bundle-2.md        — Foundation: route stubs, frontend skeleton
    spec-driven/horse-auction-platform/bundle-3.md        — Listing & Vetting API
    spec-driven/horse-auction-platform/bundle-4.md        — CreateListing frontend
    spec-driven/horse-auction-platform/bundle-5.md        — Auction lifecycle + cron + reserve behaviors
    spec-driven/horse-auction-platform/bundle-6.md        — Real-time bidding API + Socket.io broadcast
    spec-driven/horse-auction-platform/bundle-7.md        — Auction catalog API
    spec-driven/horse-auction-platform/bundle-8.md        — Dashboard API (seller + buyer)
    spec-driven/horse-auction-platform/bundle-9.md        — Payment & settlement
    spec-driven/horse-auction-platform/bundle-10.md       — Notifications & watchers
    spec-driven/horse-auction-platform/bundle-11.md       — Frontend: catalog + dashboards
    spec-driven/horse-auction-platform/bundle-12.md       — Frontend: bidding interface + Socket.io client
    spec-driven/horse-auction-platform/bundle-13.md       — Frontend: admin views (vetting + bidder approval)
    spec-driven/horse-auction-platform/bundle-14.md       — External auction house adapter
    spec-driven/horse-auction-platform/bundle-15.md       — Final wiring + tsc verification
