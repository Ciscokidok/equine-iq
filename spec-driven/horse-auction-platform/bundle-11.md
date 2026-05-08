> Stage: Depth — Frontend Catalog & Dashboards | Parallel: yes (file-disjoint from API bundles and frontend bidding bundle) | Files: frontend/src/views/AuctionCatalog.tsx, frontend/src/views/SellerDashboard.tsx, frontend/src/views/BuyerDashboard.tsx, frontend/src/api/auctions.ts

**Bundle Verify**: AuctionCatalog renders without auth; filter controls update results; SellerDashboard groups listings by status; BuyerDashboard shows winning/outbid state
- **Level**: inspection
- **Given**: Running frontend with mocked API responses
- **Action**: Navigate to /auctions (no auth), apply breed filter, navigate to /my-listings (with auth), navigate to /my-bids
- **Outcome**: Catalog renders publicly; filtered view updates; seller groups visible; buyer status badges correct

---

#### STEP-26: Create frontend AuctionCatalog view
[FR-6 -> AC-6.1, FR-6 -> AC-6.2] | modify `frontend/src/views/AuctionCatalog.tsx` | Effort: M

> **Intent**: The catalog is the public entry point to the platform (AD-7). Filter controls must update immediately without page reload (AC-6.2) — use React Query's `queryKey` to include filter params, so changing a filter triggers a new query. The `currentBid` values are in cents (S-2) — convert to USD display with `(v/100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })`. Time remaining display: `endsAt - now()` converted to `Xh Ym` or "Starts [date]" for scheduled auctions.

**Implementation guidance**:
- In `api/auctions.ts`: add `useAuctionCatalog(filters)` using `useQuery({ queryKey: ['auction-catalog', filters], queryFn: () => api.get('/auctions/catalog', { params: filters }) })`
- `AuctionCatalog.tsx`: filter state for breed, discipline, status, minPrice, maxPrice using `useState`; pass to `useAuctionCatalog(filters)`
- Render listing cards: horse name, breed, current high bid (USD), time remaining, status badge (Open/Scheduled)
- Empty state: "No auctions match your filters"
- No auth required — do not wrap in auth check

**Pattern reference**: `frontend/src/views/StallionCatalog.tsx`

**Verify clauses**:
- Level: inspection | Given: AuctionCatalog rendered without auth token | Action: page loads | Outcome: renders without redirect to login
- Level: inspection | Given: filter applied | Action: change breed filter | Outcome: query key changes, new fetch triggered (React Query)

> **Standards**: S-5, S-2

**Depends on**: STEP-6, STEP-23
**Enables**: STEP-36 (detail view linked from catalog cards)
**Parallel with**: STEP-29, STEP-30

---

#### STEP-29: Create frontend SellerDashboard view
[FR-7 -> AC-7.1] | modify `frontend/src/views/SellerDashboard.tsx` | Effort: S

> **Intent**: The seller dashboard groups listings by status (AC-7.1). Each status group is a section with a count badge. Listings in `pending_review` show "Awaiting vetting" with no bid data. Listings in `open` show current high bid and bid count. Listings in `sold` show hammer price. The "Configure Auction" action links to the CreateListing configure step for `approved` listings.

**Implementation guidance**:
- Use `useMyListings()` from STEP-13's api/auctions.ts
- Group listings client-side by status using `reduce`
- Status sections in order: open → scheduled → approved → pending_review → sold → passed
- Each listing row: horse name, status badge, currentHighBid (USD, null → "—"), bidCount (null → "—"), action button
- Action buttons: `approved` → "Configure Auction" link; `open` → "View Live" link to /auctions/:auctionId

**Pattern reference**: `frontend/src/views/Pairings.tsx`

**Verify clauses**:
- Level: inspection | Given: seller with pending_review and open listings | Action: view SellerDashboard | Outcome: two sections rendered; pending_review shows "—" for bid fields; open shows numeric bid count

> **Standards**: S-5, S-2

**Depends on**: STEP-6, STEP-27
**Enables**: —
**Parallel with**: STEP-26, STEP-30

---

#### STEP-30: Create frontend BuyerDashboard view
[FR-7 -> AC-7.2] | modify `frontend/src/views/BuyerDashboard.tsx` | Effort: S

> **Intent**: The buyer dashboard shows active bids with status (winning/outbid/won) per AC-7.2. "Winning" auctions have an urgent visual indicator (green border or badge) to encourage continued engagement. Auto-bid configurations show the max amount and current bid in the same row. Won auctions show the invoice amount (hammer + premium) and payment status.

**Implementation guidance**:
- Use `useMyBids()` from api/auctions.ts (GET /api/auctions/my-bids)
- Add `useMyBids()` hook to `api/auctions.ts` — query key `['my-bids']`
- Sections: "Active Bids" (open auctions), "Won" (sold, payment pending), "History" (passed/outbid)
- Active bid row: horse name, current bid (USD), your bid status badge (Winning/Outbid), auto-bid max if set, link to auction
- "Winning" badge: green background; "Outbid" badge: yellow with "Bid Again" link

**Pattern reference**: `frontend/src/views/Pairings.tsx`

**Verify clauses**:
- Level: inspection | Given: buyer with winning and outbid bids | Action: view BuyerDashboard | Outcome: winning auction has green indicator, outbid has "Bid Again" link

> **Standards**: S-5, S-2

**Depends on**: STEP-6, STEP-28
**Enables**: —
**Parallel with**: STEP-26, STEP-29
