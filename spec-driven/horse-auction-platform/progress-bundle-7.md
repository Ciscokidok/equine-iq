# Progress: Bundle 7 — Auction Catalog API

> Status: pending | Bundle: 7 of 15 | Stage: depth | Parallel: yes

| Step | Title | Status | Notes |
|------|-------|--------|-------|
| STEP-23 | Implement GET /api/auctions/catalog — public, filtered, scheduled+open only | blocked | Skipped — agent stalled. Retry: `/sds.execute horse-auction-platform --step STEP-23` |
| STEP-24 | Implement GET /api/auctions/:id — horse passport with presigned doc URLs, anonymized bid history | blocked | Depends on STEP-23 |
| STEP-25 | Tests for catalog filtering and presigned URL generation | blocked | Depends on STEP-23/24 |
