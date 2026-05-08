> Stage: Integration — External Auction House Adapter | Parallel: no (integration stage, must follow depth bundles) | Files: api/src/lib/adapters/registry.ts, api/src/lib/adapters/BidpathAdapter.ts, api/src/routes/admin/adapters.ts

**Bundle Verify**: AdapterRegistry activates/deactivates adapters via DB flag; BidpathAdapter stub throws "Partnership not active"; admin activate/deactivate routes change DB flag
- **Level**: integration
- **Given**: AdapterConfig table seeded with bidpath entry, active=false; admin JWT
- **Action**: PATCH /api/admin/adapters/bidpath/activate; check registry.listActive(); attempt registry.get('bidpath').connect()
- **Outcome**: DB flag flipped, registry.listActive() returns ['bidpath'], connect() throws 'Partnership not active'

---

#### STEP-44: Create AdapterRegistry singleton
[FR-9 -> AC-9.3, FR-9 -> AC-9.4] | create `api/src/lib/adapters/registry.ts` | Effort: S

> **Intent**: The `AdapterRegistry` is the only dependency that core auction routes have on the adapter layer (AD-5). It must be initialized at server startup from the `AdapterConfig` DB table so previously-activated adapters resume on restart. The registry's `activate()` calls `adapter.connect()` — if `connect()` throws (e.g., `BidpathAdapter` stub), the registry catches the error, logs it, and marks the adapter as inactive (does not crash the server). External lot state events received via `adapter.onLotStateUpdate()` must be broadcast on `auction:<internalAuctionId>` — the registry maps `externalLotId + auctionSource` to the internal auction ID via a DB lookup.

**Implementation guidance**:
- Module-level `Map<AuctionSource, AuctionHouseAdapter>` for registered adapters; `Set<AuctionSource>` for active adapters
- Export `initRegistry(): Promise<void>` — query `AdapterConfig WHERE active=true`; call `registry.activate(source)` for each
- `activate(source)`: find adapter by source; call `adapter.connect()`; on success mark active; on error: log, mark inactive, update DB flag to false
- `deactivate(source)`: call `adapter.disconnect()`; mark inactive; update DB flag
- `listActive()`: return array from active Set
- Call `initRegistry()` in `index.ts` after `initSocket()` and before `server.listen()`

**Pattern reference**: `api/src/lib/auctionSocket.ts` (singleton + init pattern)

**Verify clauses**:
- Level: unit | Given: registry with BidpathAdapter registered; BidpathAdapter.connect() throws | Action: registry.activate('bidpath') | Outcome: no server crash, adapter not in active list, DB flag set to false
- Level: integration | Given: AdapterConfig with bidpath active=true at startup | Action: initRegistry() | Outcome: bidpath in listActive() (even though connect throws — or not in list if connect fails — test the failure-safe path)

> **Standards**: S-1

**Depends on**: STEP-3, STEP-5
**Enables**: STEP-45, STEP-46, STEP-47
**Parallel with**: —

---

#### STEP-45: Create BidpathAdapter stub
[FR-9 -> AC-9.4] | create `api/src/lib/adapters/BidpathAdapter.ts` | Effort: XS

> **Intent**: N/A — structural step. The BidpathAdapter is a stub that implements `AuctionHouseAdapter` but throws `'Bidpath partnership not active — contact partnerships@equineiq.com'` from `connect()` and `placeBid()`. This allows the adapter architecture to be tested without a real Bidpath API key. The stub must implement all interface methods — TypeScript will catch any missing methods at compile time. `isHealthy()` returns false. `onLotStateUpdate()` and `onBidAck()` are no-ops (empty function registration).

**Implementation guidance**:
- `connect(): Promise<void>` — `throw new Error('Bidpath partnership not active — contact partnerships@equineiq.com')`
- `disconnect(): Promise<void>` — no-op (already disconnected)
- `placeBid()` — throw same error
- `onLotStateUpdate(handler)` — store handler in array (no-op, never called)
- `isHealthy()` — return false
- In `index.ts`: register BidpathAdapter with registry: `adapterRegistry.register(new BidpathAdapter())`

**Pattern reference**: `api/src/lib/adapters/types.ts` (STEP-3 interface)

**Verify clauses**:
- Level: inspection | Given: BidpathAdapter.ts created | Action: `tsc --noEmit` | Outcome: compiles — all interface methods implemented

> **Standards**: S-1

**Depends on**: STEP-3, STEP-44
**Enables**: STEP-46
**Parallel with**: —

---

#### STEP-46: Implement admin adapter management routes
[FR-9 -> AC-9.3] | modify `api/src/routes/admin/adapters.ts` | Effort: XS

> **Intent**: N/A — structural step. The adapter toggle routes allow partnerships to be activated without a redeploy (AD-5). PATCH `/activate` calls `adapterRegistry.activate(source)` — if connect() fails (e.g., BidpathAdapter stub), returns 422 with the error message rather than 500 (it's a known expected failure, not a server error).

**Implementation guidance**:
- GET `/`: return `{ registered: adapterRegistry.listRegistered(), active: adapterRegistry.listActive() }`
- PATCH `/:source/activate`: validate source against AuctionSource enum; call `adapterRegistry.activate(source)`; on success return 200; on connect failure return 422 `{ error: err.message }`
- PATCH `/:source/deactivate`: call `adapterRegistry.deactivate(source)`; return 200
- All routes require `requireAuth + requireAdmin`

**Pattern reference**: `api/src/routes/admin/vetting.ts`

**Verify clauses**:
- Level: integration | Given: admin activates bidpath | Action: PATCH /api/admin/adapters/bidpath/activate | Outcome: 422 with 'Bidpath partnership not active' (expected — stub throws)

> **Standards**: S-1, S-3

**Depends on**: STEP-4, STEP-44, STEP-45
**Enables**: STEP-47
**Parallel with**: —

---

#### STEP-47: Wire external lot state events to Socket.io rooms
[FR-9 -> AC-9.1, FR-9 -> AC-9.2] | modify `api/src/lib/adapters/registry.ts`, modify `api/src/lib/auctionSocket.ts` | Effort: S

> **Intent**: When an adapter fires `onLotStateUpdate`, the registry must look up the internal `Auction` record via `{ auctionSource, externalLotId }` and broadcast the normalized `LotStateEvent` on `auction:<internalAuctionId>` via Socket.io (F-6). If no internal auction matches the externalLotId, the event is dropped (external lot not yet synced). External bids from EquineIQ users go back through the adapter's `placeBid()` — the bid route detects `auction.auctionSource !== 'internal'` and routes to the adapter instead of local bid logic.

**Implementation guidance**:
- In registry `activate()`: after successful connect, call `adapter.onLotStateUpdate(async (event) => { const auction = await prisma.auction.findFirst({ where: { auctionSource: event.auctionSource, externalLotId: event.externalLotId } }); if (!auction) return; broadcastBidUpdate(auction.id, { currentBid: event.currentBid, bidderInitials: 'Floor', timeRemainingSeconds: ... }) })`
- In bid route (STEP-18): if `auction.auctionSource !== 'internal'`: const adapter = adapterRegistry.get(auction.auctionSource); if (!adapter?.isHealthy()) return 503; const ack = await adapter.placeBid({ externalLotId, equineIqUserId, amount, currency: 'USD' }); if (!ack.accepted) return 400 `{ error: ack.rejectionReason }`; return 200

**Pattern reference**: `api/src/lib/auctionSocket.ts` (STEP-21 broadcast helpers)

**Verify clauses**:
- Level: unit | Given: adapter fires onLotStateUpdate for known external lot | Action: mock broadcastBidUpdate | Outcome: broadcast called with correct internal auction ID
- Level: unit | Given: bid on external auction with inactive adapter | Action: POST bid | Outcome: 503 with error

> **Standards**: S-1, S-4

**Depends on**: STEP-44, STEP-45, STEP-46, STEP-21
**Enables**: —
**Parallel with**: —
