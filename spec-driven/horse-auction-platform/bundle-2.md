> Stage: Foundation | Parallel: no (skeleton stubs must exist before depth agents implement them) | Files: api/src/index.ts, api/src/routes/auctions.ts, api/src/routes/listings.ts, api/src/routes/cron.ts, api/src/routes/admin/vetting.ts, api/src/routes/admin/bidders.ts, api/src/routes/admin/adapters.ts, frontend/src/App.tsx

**Bundle Verify**: All auction route stubs registered and reachable; public catalog route accessible without auth
- **Level**: integration
- **Given**: API server running
- **Action**: `GET /api/auctions/catalog` returns 501 (stub); `POST /api/listings` with valid JWT returns 501; `GET /api/admin/vetting/queue` with admin JWT returns 501
- **Outcome**: All three return 501 (not 404), confirming routes are registered

---

#### STEP-5: Register skeleton auction route stubs in Express
MANUAL -> structural route registration — all auction routes return 501 stubs until depth slices implement them | create `api/src/routes/auctions.ts`, `api/src/routes/listings.ts`, `api/src/routes/cron.ts`, `api/src/routes/admin/vetting.ts`, `api/src/routes/admin/bidders.ts`, `api/src/routes/admin/adapters.ts`, modify `api/src/index.ts` | Effort: S

> **Intent**: N/A — structural step. The init-order constraint (AD-1) requires all routes to be registered *after* `initSocket()` is called. Depth agents will implement the actual handlers — this STEP only establishes the route files and registration. Creating `admin/` as a subdirectory of `routes/` establishes the convention that all admin routes require `requireAuth + requireAdmin`.

**Implementation guidance**:
- Create `mkdir -p api/src/routes/admin`
- Each route file exports a `Router` with all defined endpoints returning `res.status(501).json({ error: 'Not implemented' })`
- `auctions.ts`: GET `/catalog`, GET `/:id`, POST `/:id/bid`, POST `/:id/auto-bid`, POST `/:id/watch`
- `listings.ts`: POST `/`, GET `/mine`, POST `/:id/documents/upload-url`, POST `/:id/configure`, POST `/:id/cancel`
- `cron.ts`: POST `/tick` (uses `requireAdminToken`)
- `admin/vetting.ts`: GET `/queue`, POST `/:id/approve`, POST `/:id/reject` (uses `requireAuth + requireAdmin`)
- `admin/bidders.ts`: GET `/pending`, POST `/:id/approve`, POST `/:id/suspend`, PATCH `/:id/deposit-confirmed`
- `admin/adapters.ts`: GET `/`, PATCH `/:source/activate`, PATCH `/:source/deactivate`
- Register all in `index.ts` after `initSocket(httpServer)` call

**Pattern reference**: `api/src/routes/auth.ts`

**Verify clauses**:
- Level: inspection | Given: index.ts edited | Action: check all 6 new routers are imported and mounted with correct base paths | Outcome: `/api/auctions`, `/api/listings`, `/api/admin/cron`, `/api/admin/vetting`, `/api/admin/bidders`, `/api/admin/adapters` all present

> **Standards**: S-1

**Depends on**: STEP-2, STEP-4
**Enables**: STEP-8, STEP-11, STEP-14, STEP-18, STEP-23, STEP-27, STEP-31, STEP-44
**Parallel with**: STEP-6

---

#### STEP-6: Add public auction routes to frontend App.tsx
MANUAL -> structural route registration — adds /auctions and /auctions/:id as public routes outside ProtectedRoute | modify `frontend/src/App.tsx`, modify `frontend/src/components/Layout.tsx` | Effort: XS

> **Intent**: N/A — structural step. AC-7.1 (catalog browsable without login) requires `/auctions` outside `ProtectedRoute`. The `/auctions/:id` detail route must also be public — unauthenticated users can browse and watch (but not bid). Stub components are empty `<div>Coming soon</div>` placeholders until frontend depth bundles create the real views. Layout.tsx gets an "Auctions" nav link.

**Implementation guidance**:
- Create placeholder components: `frontend/src/views/AuctionCatalog.tsx` and `frontend/src/views/AuctionDetail.tsx` each returning `<div>Auction coming soon</div>`
- In `App.tsx`: import the placeholders; add `<Route path="/auctions" element={<AuctionCatalog />} />` and `<Route path="/auctions/:id" element={<AuctionDetail />} />` **outside** the `ProtectedRoute` wrapper (alongside `/login`, `/pricing`)
- In `App.tsx`: add protected routes for `/auctions/create` (CreateListing), `/my-listings` (SellerDashboard), `/my-bids` (BuyerDashboard), `/admin/vetting` (VettingQueue), `/admin/bidders` (BidderApproval) — all as `<div>Coming soon</div>` stubs
- In `Layout.tsx`: add "Auctions" link to nav pointing to `/auctions`

**Pattern reference**: `frontend/src/App.tsx` (existing route structure)

**Verify clauses**:
- Level: inspection | Given: App.tsx edited | Action: verify `/auctions` route is outside ProtectedRoute | Outcome: AuctionCatalog renders without login redirect

> **Standards**: S-5

**Depends on**: STEP-2
**Enables**: STEP-26, STEP-36, STEP-48
**Parallel with**: STEP-5
