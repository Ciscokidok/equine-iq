---
title: Horse Auction Platform — Design
slug: horse-auction-platform
version: 1.0
status: final
created: 2026-05-08
spec_source: spec-driven/horse-auction-platform/spec.md
test_approach: test-after
test_capabilities:
  - unit
  - integration
---

# Horse Auction Platform — Design

## Findings

### F-1: Socket.io is the correct WebSocket primitive
The existing Express API (`api/src/index.ts`) calls `app.listen()` directly with no HTTP server abstraction. Socket.io requires a `http.createServer(app)` wrapper so both HTTP routes and WebSocket upgrades share the same port. Socket.io (over native `ws`) provides built-in rooms (`auction:<id>`), reconnection, and the `io.use()` middleware hook for JWT verification on handshake. Render's free tier runs a single web service instance, so in-memory room state is sufficient — no Redis adapter is needed.

### F-2: Render Cron + idempotent DB poll is the only free-tier lifecycle option
The auction lifecycle requires time-triggered state transitions (`scheduled → open`, `open → closed`). Three options were evaluated:
- **BullMQ + Redis**: Rejected — Redis is a paid Render add-on ($10+/month).
- **node-cron (in-process)**: Rejected — Render's free tier web service sleeps after 15 minutes of inactivity; in-process timers silently stop firing.
- **Render Cron Service + DB poll**: Free; Render Cron fires on schedule even if the web service was sleeping (it wakes it). The handler runs `UPDATE auctions SET status = 'open' WHERE status = 'scheduled' AND startAt <= now()` — idempotent by construction.

### F-3: AWS S3 + presigned URLs is the only viable document storage path
Three options evaluated for vetting documents (vet certs, Coggins tests, registration papers, video):
- **Render Persistent Disk**: Rejected — paid add-on only; not available on free tier. ClamAV daemon adds ~300MB memory pressure to the web process.
- **Cloudinary**: Rejected — signed access URLs (required for sensitive legal documents) require the Advanced plan ($89/month). Free tier assets are publicly accessible by URL.
- **AWS S3 + presigned URLs**: Recommended — browser uploads directly to S3 via short-lived presigned PUT URL (bypasses Express entirely). EventBridge → Lambda ClamAV scan runs async post-upload; document stays `pending_scan` until clean. Server issues short-lived presigned GET URLs for all doc reads — time-limited and unguessable. Fits within AWS free tier at low document volume.

### F-4: Deposit-to-bid is the correct model for high-value horse lots
Horse auction lots regularly exceed $250K–$500K. Stripe PaymentIntent manual capture (authorize at bid) is physically impossible at these values — most cards have limits of $10K–$50K and Stripe ACH caps at $250K by default. Industry practice (Keeneland, Fasig-Tipton, Tattersalls):
- Bidders pre-register and pass admin credit review OR wire a refundable deposit before being cleared to bid.
- At hammer fall, winner receives an invoice. Payment due within 48h via wire transfer or certified check.
- Default = deposit forfeited + buyer blacklisted. Next bidder offered the horse at their bid price.
- **Buyer's premium** (10–15% of hammer price) is added on top — buyer pays `hammer + premium`, seller receives full hammer price. Platform revenue = buyer's premium minus any direct costs.

Stripe is still used for: platform subscription billing (existing), and optionally for sub-$25K lot settlement where card payment is practical (future enhancement).

### F-5: No public auction house APIs confirmed; adapter architecture is speculative but correct
Research found no public APIs for Keeneland, Fasig-Tipton, or OBS. Bidpath (powers Tattersalls and ~200 other houses globally) is the primary integration target once a data partnership is established. The adapter interface is designed protocol-agnostic — `connect()` hides whether the underlying transport is WebSocket or REST polling. The `AdapterRegistry` is backed by a DB feature-flag table so connectors can be toggled without redeployment.

### F-6: External lot data model requires source isolation
External-sourced auction lots (Bidpath, Keeneland) must be distinguishable from internal EquineIQ listings. `auctionSource` (enum) and `externalLotId` form a composite natural key. External lots are **read-only** from EquineIQ's internal bid logic — all bids route through the adapter's `placeBid()` and the lot state is updated only on the next inbound `LotStateEvent`. This prevents EquineIQ's state machine from conflicting with the external system's authoritative state.

### F-7: Admin role requires User model extension
The spec requires a Platform Admin role. The existing `User` model has no role field. A new `role` enum (`user | admin`) is added to `User`. All admin routes use a `requireAdmin` middleware that checks `req.user.role === 'admin'` after `requireAuth`.

### F-8: Guest bidder requires a separate identity model
Guest bidders are not EquineIQ accounts. They need email verification but no password. A `GuestBidder` model (separate from `User`) holds email, verification state, and links to bids and bidder approval. Guest bidders receive a short-lived JWT for Socket.io and bid API calls, scoped to their guest identity. The `Bid` model carries nullable `userId` and `guestBidderId` — exactly one is non-null.

---

## Architecture Decisions

### AD-1: Upgrade HTTP server to `http.createServer()` for Socket.io
**Decision:** Wrap the Express app in `http.createServer(app)` and call `server.listen()` instead of `app.listen()`. Pass the `http.Server` instance to `new Server(httpServer, { cors: { origin: true } })`. Initialize Socket.io in a dedicated `api/src/lib/auctionSocket.ts` module that exports `initSocket(httpServer)` and `getIO()`.

**Rationale:** Socket.io requires direct access to the HTTP upgrade event, which is only available on the raw `http.Server`. The `getIO()` singleton pattern allows routes to emit events without circular imports.

**Alternative rejected:** Using a separate WebSocket port. Would require CORS configuration, load balancer changes on Render, and confuses clients.

### AD-2: Auction Lifecycle via Render Cron Service
**Decision:** Create a separate Render Cron Service that hits `POST /api/admin/cron/tick` with `Authorization: Bearer $ADMIN_TOKEN` every minute. The handler runs three idempotent queries in order:
1. `UPDATE Auction SET status='open' WHERE status='scheduled' AND startAt <= now()`
2. `UPDATE Auction SET status='closed' WHERE status='open' AND endsAt <= now()`
3. For each newly-closed auction: evaluate reserve and transition to `sold` or trigger reserve behavior.

**Rationale:** Free, reliable, and idempotent. A cron firing twice in the same minute is safe because the WHERE clause only matches rows in the expected source state.

**Alternative rejected:** pg-boss (PostgreSQL job queue) — adds operational complexity and the Render Cron pattern is simpler for this use case.

### AD-3: Document Upload via S3 Presigned PUT + Lambda ClamAV
**Decision:**
1. Seller requests a presigned PUT URL from `POST /api/listings/:id/documents/upload-url` with `{ docType, fileName, mimeType }`.
2. Browser uploads directly to S3 — no bytes flow through Express.
3. Server stores the `s3Key` in `VettingDocument` with `scanStatus: pending_scan`.
4. S3 EventBridge notification → Lambda ClamAV scan → Lambda calls back `POST /api/admin/documents/:id/scan-result` with `{ clean: boolean }`.
5. Only `clean` documents are shown to admin in the vetting queue.

**Access:** All document GET requests go through the API (`GET /api/documents/:id`), which generates a short-lived presigned GET URL (15-minute expiry) after auth check. Document S3 URLs are never exposed directly to clients.

**Rationale:** Zero disk dependency on Render. Virus scan is async and doesn't block the upload flow.

**Deferred:** Lambda and EventBridge setup are operational tasks. For MVP, ClamAV scan can be a stub that auto-marks all uploads `clean` — admin manually reviews documents regardless.

### AD-4: Deposit-to-Bid Payment Model with Buyer's Premium
**Decision:**
- To bid, a user or guest must have `BidderApproval.status = 'approved'`.
- Approval flow: bidder submits a registration form → admin reviews and approves OR bidder wires a deposit (refundable if they don't win) and admin confirms receipt.
- At hammer fall: EquineIQ generates an invoice PDF and sends it to the winner via email (SendGrid). Invoice = hammer price + buyer's premium (default 10% of hammer, configurable per auction).
- Payment confirmation: admin marks `Auction.paymentConfirmedAt` after verifying wire receipt. This triggers seller notification.
- No Stripe card holds during the auction. Stripe continues to be used only for platform subscription billing.

**Buyer's premium:** Configurable per listing at creation time (default 10%). Stored on `AuctionListing.buyersPremiumPct`. Displayed prominently on all auction views alongside the hammer price.

**Rationale:** Industry standard. Avoids Stripe authorization ceiling problem for high-value lots. Aligns with how Keeneland, Fasig-Tipton, and Tattersalls operate.

**Alternative rejected:** Stripe manual capture (hold at bid). Impossible for lots over ~$50K; creates re-authorization job complexity for auctions > 7 days.

### AD-5: AuctionHouseAdapter Interface + AdapterRegistry
**Decision:** Define a TypeScript `AuctionHouseAdapter` interface in `api/src/lib/adapters/types.ts`. Ship a `BidpathAdapter` stub in `api/src/lib/adapters/BidpathAdapter.ts`. The `AdapterRegistry` is a singleton (`api/src/lib/adapters/registry.ts`) that loads adapter activation state from the `AdapterConfig` table at startup. A `PATCH /api/admin/adapters/:source/activate` endpoint flips the DB flag and calls `registry.activate(source)`.

**Interface surface:**
```typescript
export interface AuctionHouseAdapter {
  readonly source: AuctionSource
  connect(): Promise<void>
  disconnect(): Promise<void>
  placeBid(request: BidRequest): Promise<BidAckEvent>
  onLotStateUpdate(handler: (event: LotStateEvent) => void): void
  isHealthy(): boolean
}
```

**Rationale:** Core auction routes depend only on `AdapterRegistry`, never on concrete adapters. Adding Keeneland requires implementing the interface and registering it — zero changes to bid routes or Socket.io broadcast logic.

### AD-6: Proxy Auto-Bid in Cron Tick, Not on WebSocket
**Decision:** Auto-bid processing runs inside the cron tick handler, not inside the Socket.io bid handler. When a new bid is placed, the handler checks for competing auto-bidders using a ranked query. If a higher auto-bid maximum exists, the system places a counter-bid immediately within the same transaction. Auto-bid chains resolve synchronously — the final state (after all auto-bid counter-bids resolve) is what gets broadcast on Socket.io.

**Rationale:** Running auto-bid resolution synchronously in the bid handler prevents race conditions where two concurrent bids trigger competing auto-bid loops. The transaction ensures only one final high-bid state is broadcast.

### AD-7: Auction Catalog is Public (No Auth Required)
**Decision:** `GET /api/auctions/catalog` and `GET /api/auctions/:id` are unauthenticated endpoints returning public auction data. Bidding endpoints require auth (or guest JWT). The frontend router exposes `/auctions` and `/auctions/:id` as public routes outside `ProtectedRoute`.

**Rationale:** FR-6 explicitly requires browsing without login. Makes the platform linkable and shareable.

### AD-8: Seller Decision Window via Cron
**Decision:** When a `seller_decision` auction closes below reserve, `sellerDecisionDeadline = closedAt + 24h` is recorded. The cron tick handler checks `WHERE status = 'seller_deciding' AND sellerDecisionDeadline <= now()` and auto-transitions to `passed`.

### AD-9: Notification Fan-Out via SendGrid
**Decision:** All auction notifications (outbid, status change, vetting approval, invoice) go through a `sendAuctionNotification()` helper in `api/src/lib/auctionNotifications.ts` that wraps `@sendgrid/mail`. In-app notifications are Socket.io events to the bidder's personal room `user:<id>`. Email + Socket.io fire in parallel (non-blocking — failures logged, not thrown).

---

## Standards

### S-1: Route Handlers Follow Existing Pattern
All new routes use `Router` from express, import `requireAuth` and `getUserId` from `../middleware/auth`, validate with `zod`, and use `prisma` from `../lib/prisma`. Error responses use `res.status(N).json({ error: 'message' })` — no custom error classes.

### S-2: Monetary Values Stored as Integer Cents
All bid amounts, reserve prices, stud fees, and buyer's premium amounts are stored as `Int` (cents) in Prisma. Display conversion (`/100`, `toLocaleString`) happens only in response serialization and frontend components — never in business logic.

### S-3: Admin Middleware Guards All `/api/admin/*` Routes
```typescript
export function requireAdmin(req, res, next) {
  const user = (req as AuthRequest).user
  if (user.role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return }
  next()
}
```
All admin routes apply `requireAuth` first, then `requireAdmin`.

### S-4: Socket.io Room Naming Convention
- `auction:<auctionId>` — bid updates, status changes, time updates for a specific auction
- `user:<userId>` — personal outbid notifications, approval status updates
- `guest:<guestBidderId>` — same as user room but for guest identity

### S-5: Frontend Follows Existing React Query Hook Pattern
All new API calls use `useQuery` / `useMutation` from `@tanstack/react-query`. Hooks live in `frontend/src/api/auctions.ts`. Mutations call `queryClient.invalidateQueries` on success. No direct `fetch` calls in component bodies. Socket.io client connection is initialized once in `AuctionDetail.tsx` via `useEffect` with cleanup.

---

## Data Model — New Schema

### New Enums
```prisma
enum ListingStatus {
  pending_review
  approved
  rejected
  scheduled
  open
  closed
  seller_deciding
  counter_offering
  sold
  passed
}

enum ReserveBehavior {
  auto_pass
  seller_decision
  counter_offer
}

enum BidderApprovalStatus {
  pending
  approved
  suspended
}

enum AuctionSource {
  internal
  bidpath
  keeneland
  fasig_tipton
  obs
}

enum VettingDocType {
  coggins_test
  vet_certificate
  registration_papers
  radiographs
  endoscopy_video
}

enum VettingDocScanStatus {
  pending_scan
  clean
  rejected
}
```

### New Models
```
AuctionListing  — horse + seller + vetting status + auction config + buyer's premium
VettingDocument — S3 key + doc type + scan status
Auction         — live state, currentBid, startAt, endsAt, auctionSource, externalLotId
Bid             — amount, userId/guestBidderId, isAutoBid, autoMaxAmount, status
BidderApproval  — userId/guestBidderId, status, depositAmount, depositReference
GuestBidder     — email, emailVerified, verifyToken
AuctionWatcher  — auctionId + userId/guestEmail (for notifications)
AdapterConfig   — source (PK), active, config JSON
```

### Modified Models
```
User            — add role String @default("user"), add sellerListings, bids, bidderApproval relations
```

---

## File Inventory

### New — API

| File | Action | Description |
|---|---|---|
| `api/src/routes/auctions.ts` | create | GET /catalog, GET /:id, POST /:id/bid, POST /:id/watch, POST /:id/auto-bid |
| `api/src/routes/listings.ts` | create | POST / (create listing), GET /mine, POST /:id/documents/upload-url, POST /:id/configure, POST /:id/cancel |
| `api/src/routes/admin/vetting.ts` | create | GET /queue, POST /:id/approve, POST /:id/reject |
| `api/src/routes/admin/bidders.ts` | create | GET /pending, POST /:id/approve, POST /:id/suspend, PATCH /:id/deposit-confirmed |
| `api/src/routes/admin/adapters.ts` | create | GET /, PATCH /:source/activate, PATCH /:source/deactivate |
| `api/src/routes/cron.ts` | create | POST /tick (ADMIN_TOKEN bearer) |
| `api/src/lib/auctionSocket.ts` | create | initSocket(httpServer), getIO(), room helpers |
| `api/src/lib/auctionLifecycle.ts` | create | cronTick(), transitionToOpen(), transitionToClosed(), evaluateReserve() |
| `api/src/lib/s3Upload.ts` | create | getPresignedUploadUrl(), getPresignedDownloadUrl() |
| `api/src/lib/adapters/types.ts` | create | AuctionHouseAdapter interface, LotStateEvent, BidRequest, BidAckEvent |
| `api/src/lib/adapters/registry.ts` | create | AdapterRegistry singleton |
| `api/src/lib/adapters/BidpathAdapter.ts` | create | Bidpath stub (connect/disconnect/placeBid no-ops with TODOs) |
| `api/src/lib/auctionNotifications.ts` | create | sendOutbidNotification(), sendStatusChangeNotification(), sendInvoiceEmail() |
| `api/src/middleware/admin.ts` | create | requireAdmin middleware |

### Modified — API

| File | Action | Description |
|---|---|---|
| `api/prisma/schema.prisma` | modify | Add new enums + models; add role field to User |
| `api/src/index.ts` | modify | Wrap in http.createServer(), call initSocket(), register new routes |

### New — Frontend

| File | Action | Description |
|---|---|---|
| `frontend/src/views/AuctionCatalog.tsx` | create | Public catalog — scheduled + open auctions, filter by breed/discipline/status |
| `frontend/src/views/AuctionDetail.tsx` | create | Live bidding interface — socket.io connection, bid form, horse passport |
| `frontend/src/views/CreateListing.tsx` | create | Seller listing form — horse select, document upload, reserve config |
| `frontend/src/views/SellerDashboard.tsx` | create | Seller listings grouped by status |
| `frontend/src/views/BuyerDashboard.tsx` | create | Buyer bids, approval status, won auctions |
| `frontend/src/views/admin/VettingQueue.tsx` | create | Admin vetting review queue |
| `frontend/src/views/admin/BidderApproval.tsx` | create | Admin bidder approval queue |
| `frontend/src/api/auctions.ts` | create | useAuctionCatalog, useAuction, usePlaceBid, useCreateListing, useRequestUploadUrl, useMyListings, useMyBids, useAuctionSocket |

### Modified — Frontend

| File | Action | Description |
|---|---|---|
| `frontend/src/App.tsx` | modify | Add public /auctions, /auctions/:id routes and protected seller/buyer/admin routes |
| `frontend/src/components/Layout.tsx` | modify | Add Auctions nav link |

---

## Dependencies and Coupling

### New npm Dependencies
| Package | Side | Purpose |
|---|---|---|
| `socket.io` | API | WebSocket server (bid broadcasting, notifications) |
| `socket.io-client` | Frontend | WebSocket client for live bid view |
| `@aws-sdk/client-s3` | API | S3 bucket operations |
| `@aws-sdk/s3-request-presigner` | API | Presigned URL generation |

### Coupling Map
- `auctionLifecycle.ts` → `prisma`, `auctionSocket.ts` (getIO), `auctionNotifications.ts`
- `auctions.ts` (route) → `auctionSocket.ts` (getIO for bid broadcast), `prisma`, auto-bid logic
- `index.ts` → `auctionSocket.ts` (initSocket — must run before routes that call getIO)
- `listings.ts` (route) → `s3Upload.ts`, `prisma`
- `AdapterRegistry` → `AdapterConfig` (DB), concrete adapters, `auctionSocket.ts` (for lot state broadcast)
- `cron.ts` (route) → `auctionLifecycle.ts`

### Init Order Constraint
`initSocket(httpServer)` must be called before any route that calls `getIO()`. In `index.ts`, the order is: create http.Server → initSocket → register routes → server.listen().

---

## NFR Traceability

| NFR | Disposition | Mechanism |
|---|---|---|
| NFR-1: Bid broadcast < 500ms | Implemented | Socket.io in-process room broadcast; single Render instance → no Redis hop; STEP in auctions route |
| NFR-2: Security (auth, webhooks, virus scan) | Implemented | requireAuth on all bid endpoints; Lambda ClamAV scan before doc visible; requireAdmin on admin routes |
| NFR-3: Idempotent state transitions | Implemented | WHERE status = 'expected_source' in all UPDATE queries; same transition cannot fire twice |
| NFR-4: Cron reliability | Implemented | Render Cron Service (external process, not in-process timer) |
| NFR-5: Document storage in cloud | Implemented | AWS S3 (not DB, not Render disk) |

---

## Constraints and Assumptions

**Constraints:**
- AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_REGION`) must be added to Render environment variables.
- `ADMIN_TOKEN` env var already exists (used by existing cron jobs) — reuse for cron tick authentication.
- Socket.io CORS must allow the frontend origin (existing `cors({ origin: true })` pattern).
- Guest bidder JWT is scoped to guest identity only — cannot access any User-scoped endpoints.

**Assumptions:**
- ClamAV Lambda scan can be stubbed for MVP — admin reviews documents manually regardless. Lambda setup is a post-MVP operational task.
- Invoice generation (PDF) can be a SendGrid HTML email for MVP; PDF attachment is a future enhancement.
- Buyer's premium default is 10%, configurable per listing at creation time.
- The `seller_decision` window default is 24 hours, platform-wide.
- External adapter activation requires a signed partnership agreement — BidpathAdapter ships as a stub with `connect()` throwing `"Partnership not active"`.
- No bulk CSV/API auction data import is in scope for this feature (deferred — separate feature).

---

## Open Questions

1. **Commission billing:** Does the platform collect the buyer's premium via wire transfer alongside the hammer price (simplest), or does it invoice separately? This affects how `AuctionListing.buyersPremiumPct` flows into the invoice template.
2. **Re-offer flow:** When the winner defaults (doesn't pay within 48h), the next bidder is offered the horse. Does this require a new auction, or is it a direct offer email with a 24h accept window?
3. **Seller Connect onboarding:** When (and whether) sellers complete Stripe Connect onboarding for future card-based payouts on small lots — deferred until Stripe settlement is re-introduced.
