# Progress: Bundle 9 — Payment & Settlement

> Status: done | Bundle: 9 of 15 | Stage: depth | Parallel: yes

| Step | Title | Status | Notes |
|------|-------|--------|-------|
| STEP-31 | Implement guest bidder registration + email verification; guest JWT issued on verify | done | guest-register creates GuestBidder; guest-verify issues JWT with guest: prefix; BidderApproval created pending; tsc passes |
| STEP-32 | Create api/src/lib/auctionNotifications.ts — sendInvoiceEmail, sendSellerNotification, sendOutbidNotification | done | Math.round for integer cents; NODE_ENV test guard; all functions catch+log, never throw; tsc passes |
| STEP-33 | Admin POST /api/auctions/:id/confirm-payment and POST /api/auctions/:id/offer-next-bidder | done | confirm-payment sets paymentConfirmedAt; offer-next-bidder updates auction.highBidderId to next bidder; admin-only; tsc passes |
| STEP-34 | Settlement tests — invoice calculation, payment confirmation, next-bidder offer | done | 4 tests: invoice math (integer cents), confirm-payment, offer-next-bidder, 403 non-admin; describe.skip guard; tsc passes |
