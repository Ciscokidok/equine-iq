# Progress: Bundle 5 — Auction Lifecycle + Cron + Reserve Behaviors

> Status: done | Bundle: 5 of 15 | Stage: depth | Parallel: yes

| Step | Title | Status | Notes |
|------|-------|--------|-------|
| STEP-14 | Create api/src/lib/auctionLifecycle.ts — cronTick, transitionToOpen/Closed, evaluateReserve | done | idempotent updateMany+WHERE pattern; tryBroadcast swallows socket errors; all 3 reserve behaviors; tsc passes |
| STEP-15 | Implement POST /api/admin/cron/tick route with requireAdminToken | done | requireAdminToken guard; cronTick() call; try/catch 500; tsc passes |
| STEP-16 | Tests for lifecycle state machine — idempotency + all reserve behaviors | done | 6 tests: scheduled→open, idempotency, sold, auto_pass, seller_decision+deadline, 401 cron; describe.skip when DATABASE_URL absent |
| STEP-17 | Implement POST /api/listings/:id/seller-decision — seller accept/decline endpoint | done | ownership + seller_deciding status check; prisma.; invoice stub comment; tsc passes |
