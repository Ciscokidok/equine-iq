> Stage: Depth — Frontend Bidding Interface | Parallel: yes (file-disjoint from catalog/dashboard frontend bundles) | Files: frontend/src/views/AuctionDetail.tsx, frontend/src/api/auctions.ts

**Bundle Verify**: AuctionDetail renders live bid state with Socket.io; bid form submits and UI updates in real-time; outbid notification renders in UI
- **Level**: inspection
- **Given**: Open auction, authenticated approved bidder viewing AuctionDetail
- **Action**: Page loads with current bid; place bid via form; observe UI update without page reload
- **Outcome**: Current bid updates immediately after submission; bid history shows new entry; outbid badge appears for previous high bidder

---

#### STEP-36: Create frontend AuctionDetail view with Socket.io client
[FR-3 -> AC-3.1, FR-3 -> AC-3.2, FR-6 -> AC-6.3] | modify `frontend/src/views/AuctionDetail.tsx`, modify `frontend/src/api/auctions.ts` | Effort: M

> **Intent**: AuctionDetail is the most complex frontend component — it combines static horse passport data (React Query) with real-time bid updates (Socket.io). The Socket.io client connects once in `useEffect` on mount and disconnects on unmount (S-5 cleanup rule). The JWT from localStorage must be passed in `socket.handshake.auth.token` — not as a query param (F-1 security note). Bid state (currentBid, timeRemaining) is managed in `useState` and updated by the `'bid'` Socket.io event. The initial state is seeded from the React Query fetch result to avoid a flash of stale data.

**Implementation guidance**:
- In `api/auctions.ts`: add `useAuction(auctionId)` — GET /api/auctions/:id; add `usePlaceBid(auctionId)` mutation — POST /api/auctions/:id/bid
- `AuctionDetail.tsx`: 
  - Left panel: horse passport (name, breed, pedigree, conformationNotes, documents with download links, performanceRecords)
  - Right panel: live bidding — current bid, time remaining countdown, bid history (last 10), bid form (amount input + "Place Bid" button), auto-bid form (max amount input)
  - Socket.io: `useEffect(() => { const socket = io(API_URL, { auth: { token: localStorage.getItem('auth_token') } }); socket.emit('join-auction', auctionId); socket.on('bid', (data) => { setCurrentBid(data.currentBid); setBidHistory(prev => [data, ...prev].slice(0,10)) }); socket.on('status', (data) => setAuctionStatus(data.status)); return () => { socket.disconnect() }; }, [auctionId])`
- Bid form: `usePlaceBid` mutation; on error show error message; on success clear input
- Show minimum next bid: `(currentBid + bidIncrement) / 100` formatted as USD

**Pattern reference**: `frontend/src/views/StallionDetail.tsx` (detail view pattern)

**Verify clauses**:
- Level: inspection | Given: AuctionDetail renders for open auction | Action: check Socket.io connection setup | Outcome: socket connects with auth token; `join-auction` event emitted; disconnect called on unmount
- Level: inspection | Given: bid event received from socket | Action: check bid state | Outcome: currentBid state updates without page reload

> **Standards**: S-5, S-2, S-4

**Depends on**: STEP-6, STEP-21, STEP-24
**Enables**: STEP-37
**Parallel with**: STEP-29, STEP-30

---

#### STEP-37: Implement guest email verification and bidder approval UI flows
[FR-3 -> AC-3.4] | modify `frontend/src/views/AuctionDetail.tsx`, modify `frontend/src/api/auctions.ts` | Effort: S

> **Intent**: When a guest or unapproved user tries to bid, AuctionDetail must show the appropriate barrier screen instead of the bid form. Three cases: (1) unauthenticated → show "Sign in or register as guest to bid" with links; (2) authenticated but no BidderApproval → show "Apply to bid" form (name, farm, deposit acknowledgment); (3) BidderApproval in 'pending' → show "Awaiting approval" with deposit instructions. These states are determined by the 403 response from the bid endpoint + the user's bidder approval status from a separate query.

**Implementation guidance**:
- In `api/auctions.ts`: add `useBidderApproval()` — GET /api/auctions/my-approval-status (add this route to admin/bidders.ts: GET /api/bidders/my-status for the requesting user)
- In `AuctionDetail.tsx`: if `!token` → show guest/login prompt; if approval status = null → show "Apply to bid" form that POSTs to `/api/auth/guest-register` or links to BidderApproval request
- "Awaiting approval" state: show deposit wire instructions (static text for MVP), "Contact us" link

**Pattern reference**: `frontend/src/views/AuctionDetail.tsx` (STEP-36)

**Verify clauses**:
- Level: inspection | Given: unauthenticated user on AuctionDetail | Action: view bid section | Outcome: bid form replaced with "Sign in or register as guest" prompt
- Level: inspection | Given: authenticated user with BidderApproval.status = 'pending' | Action: view bid section | Outcome: "Awaiting approval" message with deposit instructions shown

> **Standards**: S-5

**Depends on**: STEP-36, STEP-31
**Enables**: —
**Parallel with**: —
