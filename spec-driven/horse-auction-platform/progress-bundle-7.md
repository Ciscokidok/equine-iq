# Progress: Bundle 7 — Auction Catalog API

> Status: done | Bundle: 7 of 15 | Stage: depth | Parallel: yes

| Step | Title | Status | Notes |
|------|-------|--------|-------|
| STEP-23 | Implement GET /api/auctions/catalog — public, filtered, scheduled+open only | done | zod-validated filters (breed, discipline enum, status, minPrice, maxPrice); tsc passes |
| STEP-24 | Implement GET /api/auctions/:id — horse passport with presigned doc URLs, anonymized bid history | done | clean docs with presigned URLs, last-10 bids anonymized, 404 for pending_review/rejected |
| STEP-25 | Tests for catalog filtering and presigned URL generation | done | 6 integration tests; S3 mocked via vi.mock |
