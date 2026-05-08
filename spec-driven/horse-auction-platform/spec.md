---
title: Horse Auction Platform
slug: horse-auction-platform
version: 1.0
status: final
created: 2026-05-08
---

# Horse Auction Platform

## Overview

**Current State:** EquineIQ supports mating analysis, foal outcome tracking, and auction sale price recording. There is no mechanism to list horses for sale, run live auctions, or connect to external auction house bidding systems.

**Change Delivered:** A full horse auction platform embedded in EquineIQ — enabling sellers to list any horse for auction with pre-sale vetting, buyers to bid in real-time (including guest bidders), and the platform to integrate with external auction houses (Keeneland, Fasig-Tipton, Tattersalls via Bidpath, OBS) as partnership agreements are established.

**Primary Goal:** Make EquineIQ the destination for buying and selling horses — extending beyond breeding advisory into a full equine marketplace with auction capability.

## Users

- **Sellers** — registered EquineIQ users listing horses for auction
- **Buyers** — registered EquineIQ users or guest bidders (email-verified) placing bids
- **Platform Admin** — EquineIQ staff who review vetting submissions, manage auction settings, and can intervene on any auction
- **External Auction Houses** — Keeneland, Fasig-Tipton, OBS, Tattersalls (via Bidpath adapter) who may feed live auction events into the platform

## Dependencies

- PostgreSQL — auction, listing, bid, vetting records
- Stripe — card authorization at bid time, capture at settlement
- WebSockets — real-time bid broadcasting during live auctions
- Bidpath API — primary integration target for external auction house connectivity (pending partnership)
- SendGrid — outbid notifications, auction alerts, settlement emails
- Existing: Horse/Foal/User models, JWT auth, requireAuth middleware

---

## Functional Requirements

### FR-1: Horse Listing & Vetting Submission
A seller can submit any horse in their account for auction. The horse must pass a vetting review before the listing goes live.

**AC-1.1** Given a seller on the listing creation page, when they select a horse and submit required vetting documents (Coggins test, vet certificate, registration papers; radiographs and endoscopy video optional), then a listing record is created with status `pending_review` and the platform admin is notified.

**AC-1.2** Given a listing in `pending_review`, when the platform admin approves it, then the listing status transitions to `approved` and the seller is notified with a confirmation email.

**AC-1.3** Given a listing in `pending_review`, when the platform admin rejects it with a reason, then the seller is notified with the rejection reason and can resubmit corrected documents.

**AC-1.4** Given an approved listing, when the seller configures auction settings (start time, duration, starting bid, reserve price, bid increment, reserve behavior), then the listing status transitions to `scheduled`.

**AC-1.5** Given a listing, the seller can list any horse type: foal, mare, or stallion.

---

### FR-2: Auction Lifecycle Management
Auctions progress through defined states managed by time and admin actions.

**AC-2.1** Given a `scheduled` listing, when the configured start time arrives, then the auction status automatically transitions to `open` and bidding becomes available.

**AC-2.2** Given an `open` auction, when the configured end time arrives, then the auction status transitions to `closed` and no further bids are accepted.

**AC-2.3** Given a `closed` auction where the high bid meets or exceeds the reserve, then the auction status transitions to `sold` and the settlement flow begins automatically.

**AC-2.4** Given a `closed` auction where the high bid does not meet the reserve, then behavior is determined by the reserve behavior setting configured at listing creation:
- `auto_pass` — auction transitions to `passed`; no sale
- `seller_decision` — seller receives a notification with a configurable time window (default 24h) to accept or decline the high bid
- `counter_offer` — system initiates a private negotiation thread between seller and high bidder

**AC-2.5** Given any auction state transition, then all participants who have bid or watched the listing receive an email and in-app notification.

---

### FR-3: Real-Time Bidding
Registered users and verified guest bidders can place bids during open auctions.

**AC-3.1** Given an open auction, when an authenticated user or verified guest submits a bid, then the bid is accepted only if it meets the minimum: `current_high_bid + bid_increment`.

**AC-3.2** Given a new valid bid, then all connected clients viewing that auction receive a real-time update via WebSocket within 500ms showing the new high bid, bidder (anonymized to initials), and time remaining.

**AC-3.3** Given a registered user who has not previously bid, when they attempt to place a bid, then they must have a valid payment method on file (Stripe card) before the bid is accepted.

**AC-3.4** Given a guest bidder, when they attempt to bid, then they must verify their email address and add a payment method before their first bid is accepted.

**AC-3.5** Given a user who has been outbid, then they receive an immediate email and in-app notification with a direct link back to the auction.

---

### FR-4: Proxy / Auto-Bid
Buyers can set a maximum bid and the system bids incrementally on their behalf.

**AC-4.1** Given a buyer who sets an auto-bid maximum, when another bidder places a bid, then the system automatically places the next increment bid on the buyer's behalf up to their maximum.

**AC-4.2** Given two auto-bidders competing, when both have overlapping maximums, then the higher maximum wins at one increment above the lower maximum — mirroring standard proxy bidding rules.

**AC-4.3** Given a buyer's auto-bid maximum is reached, then the buyer is notified that their maximum has been exceeded and they must manually bid to continue.

---

### FR-5: Payment Processing
Stripe authorizes cards at bid time and captures payment at settlement.

**AC-5.1** Given a winning bid, when the auction transitions to `sold`, then Stripe captures the authorized hold on the winning bidder's card for the final hammer price.

**AC-5.2** Given a passed or declined auction, then all Stripe holds placed during the auction are released within 24 hours.

**AC-5.3** Given a successful capture, then both buyer and seller receive a settlement email with sale details, and the seller's payout is initiated via Stripe Connect transfer.

**AC-5.4** Given a failed capture (card decline), then the auction admin is notified and the next highest bidder is offered the horse at their bid price.

---

### FR-6: Auction Catalog
All active and upcoming auctions are browsable without requiring login.

**AC-6.1** Given any visitor, when they navigate to the auction catalog, then they see all listings in `scheduled` or `open` status with horse name, photo (if uploaded), breed, discipline, current high bid, and time remaining.

**AC-6.2** Given a catalog visitor, when they filter by breed, discipline, price range, or auction status, then results update immediately without page reload.

**AC-6.3** Given a catalog visitor, when they click a listing, then they see the full horse passport (pedigree, conformation notes, vet documents summary, performance history from EquineIQ records) alongside the live bidding interface.

---

### FR-7: Seller & Buyer Dashboards

**AC-7.1** Given a seller, when they view their dashboard, then they see all their listings grouped by status (pending_review, scheduled, open, sold, passed) with bid counts and current high bids.

**AC-7.2** Given a buyer, when they view their dashboard, then they see all auctions they have bid on, their current status (winning / outbid), won auctions, and active auto-bid configurations.

---

### FR-8: Reserve Behavior Configuration
Auction administrators configure reserve behavior at listing creation time.

**AC-8.1** Given a seller configuring a listing, when they set reserve behavior to `auto_pass`, `seller_decision`, or `counter_offer`, then the auction behaves accordingly when it closes below reserve (per FR-2 AC-2.4).

**AC-8.2** Given `seller_decision` mode and a seller who does not respond within the configured window, then the auction automatically transitions to `passed`.

**AC-8.3** Given `counter_offer` mode, when a counter-offer is rejected by either party, then the auction transitions to `passed`.

---

### FR-9: External Auction House Integration
EquineIQ can connect to external auction house systems to stream live auction events and accept online bids alongside floor bidders.

**AC-9.1** Given a configured external auction feed (e.g. Bidpath adapter), when a live auction event is active at the partner auction house, then EquineIQ displays the real-time lot feed with current bid, increment, and time state synchronized from the external system.

**AC-9.2** Given an EquineIQ user viewing a synced external auction lot, when they place a bid, then the bid is forwarded to the external auction house's bidding system via the adapter and the response (accepted/outbid) is reflected in real-time.

**AC-9.3** Given the integration architecture, when a new auction house adapter is added, then it implements a standard `AuctionHouseAdapter` interface — no changes to core auction logic are required.

**AC-9.4** Given the Bidpath adapter (first connector target), when a Bidpath-powered auction (Tattersalls or other partner) is active, then EquineIQ users can participate as online bidders through the Bidpath API.

---

### FR-10: Vetting Administration
Platform admins manage the vetting review queue.

**AC-10.1** Given a platform admin, when they view the vetting queue, then they see all listings in `pending_review` with uploaded documents available for review.

**AC-10.2** Given a platform admin reviewing a submission, when they approve or reject, then the listing status updates and the seller is notified (per FR-1 AC-1.2 / AC-1.3).

**AC-10.3** Given a listing, the required vetting documents are: Coggins test result, veterinary health certificate, and registration/ownership papers. Radiographs and endoscopy video are optional but displayed prominently if provided.

---

## Out of Scope

- Physical delivery, transport, or logistics coordination
- International currency support (USD only at launch)
- Secondary market resales after settlement
- Breeding rights auctions (horses only, not semen or embryos — separate feature)

---

## Constraints

- Real-time bidding latency must be under 500ms for bid broadcast (WebSocket requirement)
- Stripe holds must comply with authorization window limits (7 days standard; long auctions require re-authorization)
- External auction house integration requires a signed data partnership agreement before a connector can go live — the adapter architecture is built speculatively; activation is gated on business agreements
- Guest bidders must verify email before placing any bid
- Vetting document uploads must support PDF, JPG, PNG, and video (MP4) formats

---

## Assumptions

- EquineIQ will add Stripe Connect to support seller payouts (currently only Stripe Charges in the options API)
- A WebSocket library (Socket.io or native ws) will be added to the Express backend
- Bidpath has an API that supports third-party bid submission — requires partnership confirmation
- Platform admin role will be a new `role` field on the User model (`user` / `admin`)

---

## Open Questions

- What is the platform commission rate on sales? (affects Stripe Connect payout calculation)
- Should EquineIQ hold funds in escrow or pass through immediately to seller on settlement?
- What is the seller decision window duration for `seller_decision` reserve mode — configurable per auction or platform-wide default?

---

## NFRs

- **NFR-1 Performance:** Bid broadcast to all connected clients within 500ms under 100 concurrent bidders per auction
- **NFR-2 Security:** Bid endpoints require authentication; Stripe webhooks verified by signature; document uploads virus-scanned before storage
- **NFR-3 Reliability:** Auction state transitions are idempotent — if a cron job or webhook fires twice, the auction does not double-transition
- **NFR-4 Availability:** Auction close events must fire on time even under load — use a dedicated job queue (Bull/BullMQ) rather than in-process timers
- **NFR-5 Storage:** Vetting documents stored in cloud object storage (S3 or Render Disk); not in the database

---

## Success Metrics

- First auction listed and settled end-to-end with real payment
- At least one external auction house adapter connected and live
- Bid broadcast latency under 500ms in load test with 50 concurrent bidders
- Vetting approval turnaround under 48 hours (operational target)
