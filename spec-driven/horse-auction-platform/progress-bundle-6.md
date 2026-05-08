# Progress: Bundle 6 — Real-Time Bidding API

> Status: pending | Bundle: 6 of 15 | Stage: depth | Parallel: yes

| Step | Title | Status | Notes |
|------|-------|--------|-------|
| STEP-18 | Implement POST /api/auctions/:id/bid — approval gate, min bid, auto-bid chain, broadcast | blocked | Skipped — agent stalled. Retry: `/sds.execute horse-auction-platform --step STEP-18` |
| STEP-19 | Implement resolveAutoBids() — synchronous auto-bid chain with 50-iter guard | blocked | Depends on STEP-18 |
| STEP-20 | Tests for bid placement and auto-bid competition | blocked | Depends on STEP-18/19 |
| STEP-21 | Add Socket.io join-auction/leave-auction handlers; broadcastBidUpdate + broadcastStatusChange | blocked | Depends on STEP-18 |
| STEP-22 | Implement admin bidder approval routes — GET /pending, POST approve/suspend, PATCH deposit-confirmed | blocked | Skipped — agent stalled |
