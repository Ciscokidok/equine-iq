# Progress: Bundle 3 — Listing & Vetting API

> Status: pending | Bundle: 3 of 15 | Stage: depth | Parallel: yes

| Step | Title | Status | Notes |
|------|-------|--------|-------|
| STEP-7 | Create api/src/lib/s3Upload.ts — getPresignedUploadUrl + getPresignedDownloadUrl | done | Lazy env validation; key format listings/{listingId}/{docType}/{ts}-{name}; tsc passes |
| STEP-8 | Implement POST /api/listings — create AuctionListing with status pending_review | done | Horse ownership check via createdByUser; 404 on missing; tsc passes |
| STEP-9 | Implement POST /api/listings/:id/documents/upload-url — presigned S3 PUT URL | done | Ownership + status check; VettingDocument created with scanStatus=clean (MVP stub); tsc passes |
| STEP-10 | Implement POST /api/listings/:id/configure — create Auction, transition to scheduled | done | reservePrice/reserveBehavior/buyersPremiumPct on AuctionListing; Auction gets timing+bid fields; tsc passes |
| STEP-11 | Implement admin vetting queue GET + approve/reject POST endpoints | pending | |
| STEP-12 | Tests for full listing → document upload → vetting approval flow | pending | |
