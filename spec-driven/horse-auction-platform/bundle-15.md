> Stage: Integration — Final Wiring & Verification | Parallel: no (all depth bundles must complete before wiring) | Files: frontend/src/App.tsx, frontend/src/api/auctions.ts, api/src/index.ts

**Bundle Verify**: TypeScript compiles clean across both API and frontend; all auction routes in index.ts; all frontend routes in App.tsx with correct auth guards; nav link present
- **Level**: inspection
- **Given**: All prior bundles complete
- **Action**: `node_modules/.bin/tsc --noEmit` in api/ and frontend/
- **Outcome**: Zero TypeScript errors in both projects

---

#### STEP-48: Replace App.tsx stub routes with real components
MANUAL -> structural wiring — replace stub components with real implementations across all auction routes | modify `frontend/src/App.tsx` | Effort: S

> **Intent**: N/A — structural step. By the time this STEP runs, all frontend view components exist. This STEP replaces the stub `<div>Coming soon</div>` placeholders from STEP-6 with imports of the real components. Routing correctness matters: `/admin/vetting` and `/admin/bidders` must be inside `ProtectedRoute` (admin users are authenticated). Admin routes should also check `user.role === 'admin'` client-side — unauthenticated access already blocked, but a non-admin user navigating to `/admin/vetting` should see "Access denied" (handled in the component from STEP-42, not the router).

**Implementation guidance**:
- Import all new view components: `AuctionCatalog`, `AuctionDetail`, `CreateListing`, `SellerDashboard`, `BuyerDashboard`, `VettingQueue`, `BidderApproval`
- Replace stub components in-place — keep same route paths from STEP-6
- `/auctions` and `/auctions/:id` remain outside ProtectedRoute (public)
- `/auctions/create`, `/my-listings`, `/my-bids` inside ProtectedRoute
- `/admin/vetting`, `/admin/bidders` inside ProtectedRoute (auth check only; admin check inside components)
- Add missing StepUp: the `/auctions/create` route must be BEFORE `/auctions/:id` to prevent the router matching 'create' as an auctionId — following the `/stallions/compare` before `/stallions/:id` pattern already in App.tsx

**Pattern reference**: `frontend/src/App.tsx`

**Verify clauses**:
- Level: inspection | Given: App.tsx updated | Action: verify route order | Outcome: `/auctions/create` appears before `/auctions/:id` in the route list

> **Standards**: S-5

**Depends on**: STEP-6, STEP-13, STEP-26, STEP-29, STEP-30, STEP-36, STEP-37, STEP-42, STEP-43
**Enables**: STEP-51
**Parallel with**: STEP-49, STEP-50

---

#### STEP-49: Consolidate frontend auction API hooks
MANUAL -> structural consolidation — ensure all auction hooks are exported from api/auctions.ts and properly typed | modify `frontend/src/api/auctions.ts` | Effort: XS

> **Intent**: N/A — structural step. Various depth bundles have added hooks incrementally to `api/auctions.ts`. This STEP audits the file to ensure all hooks are exported, have correct TypeScript return types, and follow the existing React Query pattern (S-5). No new functionality — consolidation only.

**Implementation guidance**:
- Verify these hooks are exported: `useAuctionCatalog`, `useAuction`, `usePlaceBid`, `useCreateListing`, `useRequestUploadUrl`, `useConfigureListing`, `useMyListings`, `useMyBids`, `useVettingQueue`, `useApproveVetting`, `useRejectVetting`, `usePendingBidders`, `useApproveBidder`, `useSuspendBidder`, `useConfirmDeposit`, `useBidderApproval`, `useStallionSaleStats` (existing — do not remove)
- Add TypeScript return types to any hooks missing them
- Verify `queryClient.invalidateQueries` calls use string array keys not string: `['auction-catalog']` not `'auction-catalog'`

**Pattern reference**: `frontend/src/api/auctionSales.ts`

**Verify clauses**:
- Level: inspection | Given: api/auctions.ts | Action: `node_modules/.bin/tsc --noEmit` | Outcome: no TypeScript errors

> **Standards**: S-5

**Depends on**: STEP-13, STEP-26, STEP-29, STEP-30, STEP-36, STEP-42, STEP-43
**Enables**: STEP-51
**Parallel with**: STEP-48, STEP-50

---

#### STEP-50: Wire all new API routes in index.ts and add initRegistry call
MANUAL -> structural wiring — import and register all new routers, call initRegistry at startup | modify `api/src/index.ts` | Effort: XS

> **Intent**: N/A — structural step. `initRegistry()` must be called after `initSocket()` and before `server.listen()`. If `initRegistry()` itself fails (e.g., DB unreachable), the server should still start — log the error, continue. Adapter failures during init are expected (stubs throw) and must not abort startup.

**Implementation guidance**:
- Import all new routers: `auctionsRouter`, `listingsRouter`, `cronRouter`, `vettingRouter`, `biddersRouter`, `adaptersRouter`
- Mount: `/api/auctions`, `/api/listings`, `/api/admin/cron`, `/api/admin/vetting`, `/api/admin/bidders`, `/api/admin/adapters`
- After `initSocket(httpServer)`: `initRegistry().catch(err => console.error('Adapter registry init failed:', err))`
- `server.listen(PORT, ...)` is the final call

**Pattern reference**: `api/src/index.ts`

**Verify clauses**:
- Level: inspection | Given: index.ts updated | Action: check import and mount order | Outcome: initSocket called before route registration; initRegistry before server.listen

> **Standards**: S-1

**Depends on**: STEP-5, STEP-44
**Enables**: STEP-51
**Parallel with**: STEP-48, STEP-49

---

#### STEP-51: TypeScript compilation verification
MANUAL -> final build gate — verifies zero TS errors in both API and frontend | Effort: XS

> **Intent**: TypeScript compilation is the integration safety net for this feature. Common failure modes at this stage: missing return types on async route handlers, `getIO()` called before `initSocket` (caught by the singleton null check), `AuctionSource` string literal mismatch between Prisma enum and adapter types, React hooks rules violations in frontend view components.

**Implementation guidance**:
- In api/: `cd api && node_modules/.bin/tsc --noEmit`
- In frontend/: `cd frontend && node_modules/.bin/tsc --noEmit`
- Fix any errors before marking STEP done — do not skip

**Pattern reference**: existing tsc check pattern from prior bundles

**Verify clauses**:
- Level: inspection | Given: all bundles complete | Action: `node_modules/.bin/tsc --noEmit` in both api/ and frontend/ | Outcome: both exit 0 with no errors

> **Standards**: S-1, S-5

**Depends on**: STEP-48, STEP-49, STEP-50
**Enables**: —
**Parallel with**: —
