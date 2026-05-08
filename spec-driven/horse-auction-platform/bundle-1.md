> Stage: Foundation | Parallel: no (init-order constraint — all skeleton steps must complete before depth can start) | Files: api/package.json, frontend/package.json, api/prisma/schema.prisma, api/src/lib/adapters/types.ts, api/src/middleware/admin.ts, api/src/lib/auctionSocket.ts, api/src/index.ts

**Bundle Verify**: Foundation is wired — server starts with Socket.io attached, admin routes reject non-admin tokens, and adapter interface compiles
- **Level**: integration
- **Given**: API server started with `npm run dev`
- **Action**: `GET /health` returns 200; `POST /api/admin/vetting/queue` with user JWT returns 403; `tsc --noEmit` in api/ passes
- **Outcome**: All three checks pass, confirming server upgrade, admin middleware, and TypeScript compilation

---

#### STEP-1: Add auction platform dependencies + extend Prisma schema
[FR-1 -> AC-1.1, FR-2 -> AC-2.1, FR-3 -> AC-3.1, FR-5 -> AC-5.1] | create `api/prisma/schema.prisma` (modify), install deps | Effort: M

> **Intent**: The schema migration must add all new enums (`ListingStatus`, `ReserveBehavior`, `BidderApprovalStatus`, `AuctionSource`, `VettingDocType`, `VettingDocScanStatus`) and models (`AuctionListing`, `Auction`, `Bid`, `BidderApproval`, `GuestBidder`, `VettingDocument`, `AuctionWatcher`, `AdapterConfig`) plus a `role` field on `User`. All monetary fields must be stored as `Int` (cents) per S-2 — a single `Float` column will cause rounding errors at settlement. The `Auction` model carries a nullable `externalLotId` + `auctionSource` composite for external lots (F-6). `GuestBidder` is a separate model from `User` — do not conflate them (F-8).

**Implementation guidance**:
- Add `socket.io`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` to `api/package.json` deps; add `socket.io-client` to `frontend/package.json` deps
- Add `role String @default("user")` to the `User` model
- Add all new enums per design Data Model section — copy exact enum names/values (casing matters for Prisma)
- Add all new models with relations — monetary fields (`startingBid`, `reservePrice`, `bidIncrement`, `amount`, `depositAmount`) as `Int`, `buyersPremiumPct` as `Float`
- Run `npx prisma migrate dev --name add_auction_platform` to generate and apply migration

**Pattern reference**: `api/prisma/schema.prisma` (existing enum + model patterns)

**Verify clauses**:
- Level: integration | Given: migration applied to dev DB | Action: `npx prisma db push --force-reset && npx prisma migrate status` | Outcome: migration status shows applied, no pending migrations
- Level: inspection | Given: schema.prisma edited | Action: check all monetary STEP fields are `Int` not `Float` | Outcome: `salePrice`, `startingBid`, `reservePrice`, `amount`, `depositAmount` are all `Int`

> **Standards**: S-2 (monetary values as integer cents), S-1 (route handler pattern)

**Depends on**: —
**Enables**: STEP-2, STEP-3, STEP-4, STEP-5 (schema must exist before any route runs)
**Parallel with**: —

---

#### STEP-2: Upgrade Express server to http.createServer + initialize Socket.io
[FR-3 -> AC-3.2] | modify `api/src/index.ts`, create `api/src/lib/auctionSocket.ts` | Effort: S

> **Intent**: AD-1 requires wrapping Express in `http.createServer(app)` so Socket.io can intercept the HTTP upgrade event. The current `app.listen()` in `index.ts` does not expose the raw `http.Server` — replacing it directly breaks Socket.io. The `initSocket(httpServer)` + `getIO()` singleton pattern (F-1) allows routes to emit events without circular imports. `io.use()` middleware must verify the JWT from `socket.handshake.auth.token` before any socket joins a room — unauthenticated sockets must be disconnected immediately.

**Implementation guidance**:
- In `auctionSocket.ts`: export `initSocket(httpServer: http.Server)` that creates `new Server(httpServer, { cors: { origin: true } })`, stores the instance in a module-level variable, and adds `io.use()` JWT auth middleware
- JWT middleware: verify `socket.handshake.auth.token` using `verifyToken` from `../lib/auth`; attach `socket.data.user` on success; call `next(new Error('Unauthorized'))` on failure
- Export `getIO()` that returns the stored instance (throws if not initialized)
- In `index.ts`: `import { createServer } from 'http'`; wrap app: `const httpServer = createServer(app)`; call `initSocket(httpServer)`; replace `app.listen(PORT, ...)` with `httpServer.listen(PORT, ...)`
- Keep all existing route registrations unchanged — only the server creation changes

**Pattern reference**: `api/src/lib/auth.ts` (verifyToken pattern)

**Verify clauses**:
- Level: integration | Given: API started | Action: connect a Socket.io client with a valid JWT in `auth.token` | Outcome: connection accepted, `socket.data.user` populated
- Level: integration | Given: API started | Action: connect without a token | Outcome: connection refused with "Unauthorized" error

> **Standards**: S-1 (route handler pattern), S-4 (Socket.io room naming convention)

**Depends on**: STEP-1
**Enables**: STEP-18 (bid broadcast), STEP-21 (Socket.io room management)
**Parallel with**: STEP-3, STEP-4

---

#### STEP-3: Create AuctionHouseAdapter interface and types
[FR-9 -> AC-9.3] | create `api/src/lib/adapters/types.ts` | Effort: XS

> **Intent**: AD-5 requires the core auction routes to depend only on the `AuctionHouseAdapter` interface, never on concrete adapter classes. The `AuctionSource` enum must match the Prisma schema enum exactly — case mismatch will cause runtime errors when writing `auctionSource` to the `Auction` table. `LotStateEvent.currentBid` is in cents (matching S-2) — external adapters must convert to cents before emitting.

**Implementation guidance**:
- Define `AuctionSource` type union matching the Prisma enum values: `'internal' | 'bidpath' | 'keeneland' | 'fasig_tipton' | 'obs'`
- Define `LotStateEvent`, `BidRequest`, `BidAckEvent` interfaces per design AD-5 — use `number` for monetary amounts (cents)
- Define `AuctionHouseAdapter` interface with `source`, `connect()`, `disconnect()`, `placeBid()`, `onLotStateUpdate()`, `isHealthy()`
- Define `AdapterRegistry` interface with `register()`, `get()`, `activate()`, `deactivate()`, `listActive()`
- Export all types — this file is imported by registry, concrete adapters, and admin routes

**Pattern reference**: `api/src/lib/auth.ts` (TypeScript interface export pattern)

**Verify clauses**:
- Level: inspection | Given: types.ts created | Action: `tsc --noEmit` in api/ | Outcome: no TypeScript errors in types.ts or its importers

> **Standards**: S-1

**Depends on**: STEP-1
**Enables**: STEP-44 (registry + BidpathAdapter)
**Parallel with**: STEP-2, STEP-4

---

#### STEP-4: Create requireAdmin middleware
[FR-10 -> AC-10.1, FR-10 -> AC-10.2] | create `api/src/middleware/admin.ts` | Effort: XS

> **Intent**: F-7 requires a `role` field on User (added in STEP-1). The `requireAdmin` middleware must be applied *after* `requireAuth` — calling it without a prior auth check leaves `req.user` undefined, causing a runtime crash rather than a clean 403. Admin routes use `requireAuth` + `requireAdmin` in that order.

**Implementation guidance**:
- Import `AuthRequest`, `getUserId` from `./auth`
- Export `requireAdmin(req, res, next)`: reads `(req as AuthRequest).user.role`; if not `'admin'` returns `res.status(403).json({ error: 'Forbidden' })`; else calls `next()`
- Do not call `requireAuth` inside `requireAdmin` — they are separate middleware chained by the caller
- Export `requireAdminToken(req, res, next)` for cron routes: checks `Authorization: Bearer $ADMIN_TOKEN` against `process.env.ADMIN_TOKEN`

**Pattern reference**: `api/src/middleware/auth.ts`

**Verify clauses**:
- Level: unit | Given: `requireAdmin` called with a request where `user.role = 'user'` | Action: call middleware | Outcome: `res.status(403)` called, `next()` not called
- Level: unit | Given: `requireAdmin` called with `user.role = 'admin'` | Action: call middleware | Outcome: `next()` called

> **Standards**: S-3 (admin middleware guards)

**Depends on**: STEP-1
**Enables**: STEP-5, STEP-11, STEP-22, STEP-33, STEP-43, STEP-46
**Parallel with**: STEP-2, STEP-3
