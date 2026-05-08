# Progress: Bundle 8 — Seller & Buyer Dashboard API

> Status: done | Bundle: 8 of 15 | Stage: depth | Parallel: yes

| Step | Title | Status | Notes |
|------|-------|--------|-------|
| STEP-27 | Implement GET /api/listings/mine — seller dashboard grouped by status with bidCount | done | bidCount/currentHighBid null (not 0) when no auction; tsc passes |
| STEP-28 | Implement GET /api/auctions/my-bids — buyer dashboard with bidStatus and auto-bids | done | bidStatus derived from auction.currentBidderId; separate auto-bids query; tsc passes |
