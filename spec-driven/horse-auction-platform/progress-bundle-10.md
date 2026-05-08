# Progress: Bundle 10 — Notifications & Watch Endpoint

> Status: done | Bundle: 10 of 15 | Stage: depth | Parallel: yes

| Step | Title | Status | Notes |
|------|-------|--------|-------|
| STEP-39 | Wire outbid notification fan-out in bid handler + status change in lifecycle transitions | done | sendOutbidNotification/sendStatusChangeNotification with SendGrid+test guard; watcher fan-out in transitionToOpen/Closed; tsc passes |
| STEP-40 | Implement POST /api/auctions/:id/watch — idempotent upsert for AuctionWatcher | done | upsert on auctionId_userId or auctionId_email; no auth required; 501 stub removed; tsc passes |
