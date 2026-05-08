# Progress: Bundle 14 — External Auction House Adapter

> Status: done | Bundle: 14 of 15 | Stage: integration | Parallel: no

| Step | Title | Status | Notes |
|------|-------|--------|-------|
| STEP-44 | Create api/src/lib/adapters/registry.ts — AdapterRegistry singleton with initRegistry() | done | activate/deactivate/listActive/listRegistered; failure-safe init (connect errors caught); tsc passes |
| STEP-45 | Create api/src/lib/adapters/BidpathAdapter.ts — stub that throws 'Bidpath partnership not active' | done | full interface implemented; registered on startup in index.ts; tsc passes |
| STEP-46 | Implement admin adapter management routes — GET /, PATCH activate (422 on stub), PATCH deactivate | done | 422 on connect failure (not 500); requireAuth+requireAdmin; tsc passes |
| STEP-47 | Wire onLotStateUpdate events to Socket.io rooms; external bid routing in bid handler | done | lot state → broadcastBidUpdate fan-out; added broadcastBidUpdate/broadcastStatusChange (Bundle 6 was skipped); tsc passes |
