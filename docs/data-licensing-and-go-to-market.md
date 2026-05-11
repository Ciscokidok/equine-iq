# EquineIQ — Data Licensing, Auction Revenue & Go-to-Market Guide

## Current Data Situation

EquineIQ pulls Keeneland sale results from two internal endpoints (`GenerateJson.do` and `report/Run.do`). These are not documented public APIs. They work today but carry three risks for a commercial product:

1. **Breakage** — Keeneland can change the format anytime with no notice to you
2. **Terms of service** — using their auction data in a paid analytics product is a gray area; Keeneland monetizes their own data through Equineline
3. **Coverage** — only Keeneland sales are ingested; Fasig-Tipton, OBS, and private treaty sales are not covered

Racing performance data (Equibase) is completely blocked by Incapsula bot protection and is not currently available.

---

## Option 1 — License Directly from Keeneland / NTRA

### Contact
- **Keeneland Data Licensing**: Contact their business development team at keeneland.com or call (859) 254-3412
- **NTRA (National Thoroughbred Racing Association)**: ntra.com — they coordinate data licensing across tracks and can introduce you to the right people at member organizations

### What You'd Get
- Official CSV/API access to historical and current sale results
- Permission to use data commercially without legal exposure
- Potentially live feeds for sales in progress

### Typical Cost
Expect a negotiated annual licensing fee. For a small startup, Keeneland may offer a revenue-share or a flat annual fee in the range of $2,000–$10,000/year depending on the scope of use. NTRA relationships are worth pursuing even before a licensing deal — they have a startup/innovation track and are generally supportive of technology that promotes the industry.

### How to Approach the Conversation
Frame it as a platform that drives breeder demand toward listed stallions and Keeneland consignors — you're sending them business, not competing with them. Ask for a "data partner" arrangement rather than a standard licensing deal.

---

## Option 2 — The Jockey Club / Equineline (Recommended for Thoroughbreds)

**Website**: equineline.com  
**Parent organization**: The Jockey Club (jockeyclub.com)  
**Phone**: (800) 333-1778  
**Commercial licensing contact**: data@jockeyclub.com

### What Equineline Provides
- Complete Thoroughbred pedigree database (every registered TB going back generations)
- Sale history across all major auctions: Keeneland, Fasig-Tipton, OBS, Tattersalls, Goffs
- Racing performance records — starts, wins, earnings, graded stakes placings
- Breeding records and produce records (every foal each mare/stallion has produced)
- Progeny performance summaries — career earnings, race records for offspring
- Sire and broodmare sire statistics — exactly what powers a credible mating advisor

### Step-by-Step: How to Get Access

**Step 1 — Start with an individual account to evaluate the data**
Go to equineline.com and sign up for a personal subscription ($25–$50/month). This gives you access to the lookup interface and lets you verify the data quality and depth before entering licensing negotiations. Use it to look up horses in your existing catalog and confirm the fields match what EquineIQ needs.

**Step 2 — Contact The Jockey Club for commercial licensing**
Email data@jockeyclub.com or call (800) 333-1778. Ask specifically for:
- **TJCIS (The Jockey Club Information System) API access** — this is the programmatic interface used by industry applications
- A **commercial data licensing agreement** for a SaaS breeding analytics platform
- Their **data dictionary** — the full list of fields and endpoints available

In your email, describe:
- What EquineIQ does (breeding management + auction analytics platform)
- Approximate query volume you expect (start low — 1,000 lookups/month)
- That you have an existing TJCIS connector in your codebase ready to receive credentials

**Step 3 — What the TJCIS API looks like**

TJCIS is a SOAP/XML web service (older style, but stable and well-documented once you have access). The primary queries you need:

| Query | What it returns | Use in EquineIQ |
|---|---|---|
| `GetHorseByName` | Pedigree, basic race record | Mating Advisor — sire/dam lookup |
| `GetProgenyList` | All offspring of a sire or dam | Stallion ROI — progeny stats |
| `GetSaleHistory` | Auction results for a horse | Sale Comparables — replaces Keeneland scraping |
| `GetRaceRecord` | Career starts, wins, earnings | Racing Earnings — replaces manual entry |
| `GetSireStats` | Aggregate progeny performance | Mating Advisor scoring |

**Step 4 — Wire it into EquineIQ**

The connector stub already exists at `api/src/lib/dataProviders/`. The database schema has a `PlatformProviderConfig` table with a `tjcis` provider row. The admin can store encrypted TJCIS credentials there. The Settings page already has a "Data Sources" section.

Once you have TJCIS credentials, the implementation steps are:
1. Add `TJCIS_ENDPOINT`, `TJCIS_USERNAME`, `TJCIS_PASSWORD` to Render environment variables
2. Complete the TJCIS provider in `api/src/lib/dataProviders/` — replace stub responses with real SOAP calls using the `soap` npm package
3. Wire the provider into the Mating Advisor scoring to pull live progeny stats
4. Replace the Keeneland scraping in the import route with TJCIS sale history queries
5. Add a background sync job that enriches newly imported horses with TJCIS pedigree data overnight

**Step 5 — Negotiate pricing**

TJCIS pricing is not published. It is negotiated based on:
- Query volume per month
- Which data products you need (pedigree only vs. full sale + performance)
- Whether you're reselling the data or just using it internally to power features

**Ballpark ranges** (based on industry knowledge — confirm with The Jockey Club):
- Pedigree lookups only: $0.05–$0.15 per query
- Full data package (pedigree + performance + sales): $500–$2,000/month flat for small platforms
- Revenue-share model: 5–10% of platform revenue in exchange for lower per-query cost — worth asking about for an early-stage company

At $99/month per breeder subscriber, even a $1,000/month TJCIS fee is covered by 10–11 professional subscribers. It becomes a fixed cost that improves the product for everyone.

### Cost Range
- Individual subscription (evaluation only): $25–$50/month
- TJCIS commercial API: $500–$2,000/month depending on volume and data scope
- Revenue-share arrangement: possible for early-stage companies — ask for it

### Why This Is the Right Long-Term Path
Equineline is the authoritative source for Thoroughbred data. Every serious buyer and seller in the TB market trusts it. A platform backed by Equineline data has instant credibility with the people you're trying to sell to. It also eliminates the legal and technical fragility of scraping Keeneland's internal endpoints.

---

## Option 3 — Brisnet

**Website**: brisnet.com  
**Best for**: Racing performance data, speed figures, past performances

### What Brisnet Provides
- Past performance data (race results, times, class ratings)
- Speed figures (Beyer, Brisnet Speed)
- Trainer and jockey statistics
- Breeding stats tied to performance

### What Brisnet Does NOT Provide Well
- Auction sale prices (not their focus)
- Pedigree depth (Equineline is better)
- Breeding recommendations

### How to Get Access
Email data@brisnet.com or use the commercial licensing form on their website. Brisnet is more oriented toward handicapping/wagering than breeding, but their performance data could supplement Equineline pedigree data to give a complete picture of a stallion's racing record and what his progeny run like on the track.

### Cost
Commercial data feeds typically run $200–$1,000/month depending on data volume and endpoints.

---

## Option 4 — Fasig-Tipton Data

Fasig-Tipton is the second major Thoroughbred auction house after Keeneland. Contact their sales department directly (fasigtipton.com) to request sale result data. They have less formal data licensing infrastructure than Keeneland but are generally willing to provide historical results to legitimate industry platforms.

---

## Recommended Path for EquineIQ

| Phase | Action |
|---|---|
| **Now (pre-revenue)** | Keep the Keeneland scraping for development/demo. Make clear in the UI that data is sourced from public Keeneland results. |
| **First paying customer** | Approach Keeneland for a data partner conversation. Frame it around co-marketing (their consignors want analytics buyers). |
| **$5k ARR** | License Equineline API. Replace the pedigree scraping with authoritative data. Unlock deeper mating advisor scoring. |
| **$25k ARR** | Add Brisnet performance data to complete the racing earnings picture. Remove all remaining scraped data. |

---

## Go-to-Market: Reaching Horsemen

### Who to Target First

**Tier 1 — Small-to-mid breeders (5–50 mares)**
These are the Lee Pokoiks of the industry. They have real breeding programs, make real money, and currently rely on Blood-Horse, Thoroughbred Daily News, and their own notebooks. They're underserved by technology. A subscription at $49–$99/month is easy to justify if it saves one bad breeding decision per year.

**Tier 2 — Stallion owners / farm managers**
The listing-fee model targets this group. A stallion owner at a mid-sized farm currently pays $2,000–$10,000/year to advertise in Blood-Horse. A platform listing at $500–$1,500/year with buyer-side analytics is a compelling alternative.

**Tier 3 — Bloodstock agents**
Agents buy and sell horses for clients. They'd use Valuation and Comparables daily. A professional tier at $150–$200/month is appropriate.

---

### Where to Find Them

**Publications and media**
- **Blood-Horse** (bloodhorse.com) — the trade publication of record for Thoroughbreds. Editorial coverage is more valuable than advertising here. Pitch a story about data-driven breeding to their tech desk.
- **Thoroughbred Daily News** (thoroughbreddailynews.com) — daily industry news; accepts press releases and has a technology section
- **The Horse** (thehorse.com) — health and management focus, broader audience including sport horse and quarter horse
- **Horse & Hound** (horseandhound.co.uk) — if targeting UK/European market later

**Organizations**
- **The Jockey Club** (jockeyclub.com) — annual conference; innovation initiatives; a data partnership opens doors here
- **NTRA** (ntra.com) — their TIP (Thoroughbred Idea Foundation) and TIF are always looking for tech that helps the industry
- **AQHA** (aqha.com) — 275,000 members; own API for quarter horse registry; huge breeding community separate from Thoroughbred world
- **APHA** (apha.com) — paint horse equivalent
- **NRHA** (nrha.com) — reining horse; very active breeding and stallion market

**Events**
- **Keeneland September Sale** — the biggest Thoroughbred yearling sale of the year; walk the barns, talk to consignors and buyers
- **Fasig-Tipton Saratoga** — boutique elite sale; buyers and sellers are exactly Tier 1 and 2 targets
- **AQHA World Show** — Oklahoma City, November; massive quarter horse gathering
- **Reining by the Numbers / NRHA Futurity** — Oklahoma City, November; serious reining breeders

**Online communities**
- **COTH (Chronicle of the Horse) forums** — active hunter/jumper and eventing community
- **NRHA Facebook groups** — reining breeders are very active on Facebook
- **TBA (Thoroughbred Breeders' Association) regional groups** — every state has one; most have Facebook presence and newsletters
- **Reddit r/Equestrian** — younger demographic, less commercial but good for awareness

---

### Positioning

**Tagline options**
- "The breeding decisions your grandfather made on instinct. Now backed by data."
- "Auction intelligence for serious breeders."
- "Know what a stallion's foals actually sell for before you book him."

**Core value props by persona**

| Persona | What they care about | Your pitch |
|---|---|---|
| Small breeder | Not overpaying for a fashionable sire whose foals don't hold value | Stallion ROI tab shows stud fee vs avg progeny sale price |
| Farm manager | Mare scheduling, foaling calendar, not dropping the ball | Stud Book — due dates, status board, no more spreadsheets |
| Bloodstock agent | Finding undervalued horses before clients ask | Sale Comparables — flag horses selling below sire group average |
| Stallion owner | Getting in front of more breeders | Listing fee model — analytics buyers are pre-qualified leads |

---

### Pricing Model (Suggested)

| Tier | Price | Target | What's included |
|---|---|---|---|
| **Breeder** | $49/month | Small breeders, hobbyists | Stud Book, Mating Advisor (5 analyses/mo), Valuation read-only |
| **Professional** | $99/month | Active breeders, agents | Unlimited Mating Advisor, full Valuation, import, CSV export |
| **Stallion Listing** | $75/month per stallion | Stallion owners | Listed in catalog, booking requests, analytics on inquiry traffic |
| **Farm** | $299/month | Operations with 20+ mares | All of above, unlimited stallion listings, API access |

The stallion listing tier is recurring revenue that doesn't depend on transaction volume — easier to sell and predict.

---

### First 10 Customers Strategy

1. **Start with people you know in the horse world** — warm introductions convert. Lee's network is worth more than any ad spend.
2. **Offer a free 90-day trial to a regional TB breeders' association** — in exchange for a testimonial and newsletter feature
3. **Find one bloodstock agent willing to be a public case study** — agents have credibility with breeders
4. **Post in COTH and NRHA Facebook groups** with a specific use case ("I built a tool that shows you whether a stallion's stud fee is justified by what his foals actually sell for") — not a sales pitch, a demonstration
5. **Contact a mid-size stallion farm directly** — offer free listing for the first season in exchange for feedback and a reference

---

## Cold Outreach Templates

### Email to a Breeder (Tier 1)

**Subject:** Built something you might find useful — Keeneland ROI on any stallion

Hi [Name],

I came across your program through [referral / publication / show results] and wanted to reach out directly.

I've been building a platform called EquineIQ that does one thing most breeders don't have access to: it shows you what a stallion's foals actually sell for at Keeneland versus what he charges to breed. Before you book a $50,000 stud fee, you can see whether his progeny average $30,000 or $80,000 at auction — and how that compares to every other stallion in the same price range.

It also has a stud book for managing your mares through the breeding season — status tracking, due dates, foal records — so you're not juggling spreadsheets during foaling.

I'd like to offer you free access for 90 days. No credit card, no obligation. If it saves you one bad breeding decision it'll pay for itself many times over.

Would a 20-minute call this week work? I can walk you through it with live Keeneland data.

[Your name]
[equineiq.app or your domain]

---

### Email to a Stallion Owner / Farm Manager (Tier 2)

**Subject:** Free listing offer — EquineIQ stallion directory

Hi [Name],

I'm reaching out because [Farm Name]'s stallions deserve to be in front of breeders who make decisions based on data, not just advertising.

EquineIQ is a breeding platform where breeders use auction analytics and an AI mating advisor to evaluate stallions before they book. The breeders who find a stallion through our platform have already reviewed his progeny's sale history and decided he's a fit for their mare — they're not browsing, they're ready to book.

I'd like to offer [Farm Name] a complimentary listing for your first season — no charge, no commitment. In exchange I'd ask for 30 minutes of feedback on the platform and permission to mention you as an early partner.

Happy to jump on a call or send more information. Let me know what works.

[Your name]
[equineiq.app or your domain]

---

### Email to a Bloodstock Agent (Tier 3)

**Subject:** Tool that might be useful for your clients

Hi [Name],

I know you evaluate a lot of horses under time pressure. I built a platform that might make the research side faster.

EquineIQ pulls Keeneland sale data and shows you how any horse priced relative to its sire group — so you can spot horses selling at a discount to their bloodlines before your clients ask. It also has a mating advisor that runs AI analysis against the stallion catalog and flags pedigree concerns.

Would love to get your take on it. I'll give you free professional access for 90 days and genuinely want the feedback from someone who does this for a living.

15 minutes this week?

[Your name]
[equineiq.app or your domain]

---

## In-Person Demo Script (Sales / Shows)

Use this at Keeneland, AQHA World Show, NRHA Futurity, or any barn conversation. Takes 5–7 minutes.

---

**Opening (30 seconds)**

> "Can I show you something quick? I built a tool that answers the question breeders always have but rarely get a straight answer on — is this stallion's stud fee actually worth it based on what his foals sell for?"

Pull up the Valuation page on your phone or laptop.

---

**The hook — Stallion ROI tab (60 seconds)**

> "This is every sire with offspring sold at Keeneland. See this column — that's his average stud fee. This one is what his foals actually hammer for on average. This badge tells you if he's undervalued or overvalued relative to what the market returns."

Point to a well-known stallion they'd recognize. If they know the horse personally, even better.

> "A lot of breeders pay a premium for a fashionable name and the foals don't hold that value at auction. This shows you that before you write the check."

---

**The pain point (30 seconds)**

> "How are you tracking this today? Most people I talk to have a spreadsheet — maybe. A lot of it's in their head or in a notebook."

Let them respond. If they say spreadsheet: *"Right, and that spreadsheet doesn't know what Curlin foals averaged at the September sale last year."*

---

**The stud book (60 seconds)**

> "The other thing it does — and this is what breeders tell me saves them the most time — is this."

Pull up the Stud Book.

> "Every mare, her status, who she's bred to, when she's due. Mares foaling in the next 30 days get flagged right here. You can update status from your phone when you're in the barn."

---

**Close (30 seconds)**

> "I'm giving free access to the first breeders who try it and give me feedback. Takes about 5 minutes to set up your mares. If it's not useful after 90 days you've lost nothing."

Hand them a card or have them put their email in on the spot.

> "What's your email — I'll set you up today."

---

**Handling common objections**

| Objection | Response |
|---|---|
| "I already know which stallions I like" | "This doesn't tell you who to use — it tells you if the price is right for the one you already like." |
| "The data is only Keeneland" | "For Thoroughbreds that's where the market is made. I'm adding Fasig-Tipton next." |
| "I don't trust AI for breeding decisions" | "The AI is a research assistant, not the decision-maker. It surfaces things to consider — you still make the call." |
| "I'm not very technical" | "If you can use your phone you can use this. The stud book is basically a smarter version of what you're already doing in a notebook." |
| "How much does it cost?" | "Free for 90 days. After that it's $49/month — less than one vet call." |

---

## Online Auction Revenue

### What's Already Built

EquineIQ has a full online auction system in production. This is not a future roadmap item — the infrastructure exists today:

- **Real-time bidding engine** via Socket.io — bids broadcast live to all connected buyers in an auction room
- **Auto/proxy bidding** — buyers set a maximum and the system bids on their behalf up to that ceiling
- **Bid increment management** — configurable minimum raise per auction
- **Bidder approval queue** (`/admin/bidders`) — admin vets and approves buyers before they can place bids
- **Listing vetting queue** (`/admin/vetting`) — admin approves consignments before they go live
- **Reserve price support** — lots can have a reserve with auto-pass or auto-decline behavior
- **Seller dashboard** — consignors manage their listings
- **Buyer dashboard** — bidders track their activity and won lots
- **Bidpath adapter** — integration point for Bidpath's professional auction platform (see below)

**What still needs to be built to go live:**
- Buyer's premium calculation applied at hammer and collected via Stripe
- Seller payment disbursement (Stripe Connect or manual ACH)
- Public sale catalog pages visible without login — so non-members can browse and register to bid
- Sale event landing page with dates, catalog preview, and registration CTA
- Auctioneer licensing compliance (see Legal section below)

---

### Revenue Model

The industry standard is a **5% buyer's premium** — the buyer pays 5% on top of the hammer price. The seller typically pays a **2–3% seller's commission** or a flat **listing fee per lot**. Both flow to the platform.

**Projected auction revenue by sale type (annual):**

| Sale | Frequency | Lots | Avg Hammer | GMV | 5% Premium |
|---|---|---|---|---|---|
| Sport horse / warmblood | 4x/year | 50 | $8,000 | $1.6M | $80k |
| Quarter horse / reining | 4x/year | 75 | $5,000 | $1.5M | $75k |
| TB yearling online | 2x/year | 100 | $15,000 | $3M | $150k |
| Breeding stock | 4x/year | 60 | $10,000 | $2.4M | $120k |
| **Total** | | | | **$8.5M GMV** | **$425k/year** |

Add 2% seller commission on the same volume: another **$170k/year**.

At scale this is the largest single revenue line in the business — larger than subscriptions. The strategic advantage is that EquineIQ's subscription breeders are pre-qualified buyers. A consignor listing on EquineIQ gets access to buyers who already use the Mating Advisor and Valuation tools — they are not casual browsers, they are serious breeders actively evaluating horses. That's a premium audience and justifies premium consignment fees.

---

### Legal: Auctioneer Licensing

Several states require a licensed auctioneer to conduct a public auction. The major horse states:

| State | Requirement | Notes |
|---|---|---|
| **Kentucky** | Auctioneer license required | Apply through KY Board of Auctioneers; $200 fee, exam required |
| **Texas** | Auctioneer license required | TDLR; exam + bond required |
| **Florida** | Auctioneer license required | DBPR; exam required |
| **California** | License required for certain auctions | Check CA Sec of State |
| **Oklahoma** | License required | Key state for reining/cutting |

**Options to address this:**
1. **Get licensed yourself** — exam-based, takes 2–4 months, costs $500–$2,000 depending on state
2. **Partner with a licensed auctioneer** — they serve as the auctioneer of record; you provide the platform; split the premium (e.g., 1% to them, 4% to you)
3. **Use Bidpath** — as an established auction technology provider, Bidpath has existing relationships with licensed auctioneers and can advise on compliance in each state

Option 2 or 3 is the fastest path to going live. A licensed auctioneer partner also adds credibility with consignors.

---

### Bidpath Integration

#### What Bidpath Is

Bidpath (bidpath.com) is a B2B auction technology company that powers online auctions across livestock, equipment, and collectibles markets. They provide:
- White-label real-time bidding infrastructure
- Auctioneer tools (clerking software, bid calling interface)
- Buyer registration and KYC workflows
- Payment processing and settlement
- Compliance support for state auctioneer licensing

Several livestock and specialty auction companies use Bidpath as their backend while presenting their own brand to buyers and sellers.

#### Current Status in EquineIQ

The `BidpathAdapter` is already scaffolded in the codebase at `api/src/lib/adapters/BidpathAdapter.ts`. The adapter interface (`connect`, `placeBid`, `onLotStateUpdate`, `isHealthy`) is defined and wired into the server. The adapter currently throws `"Bidpath partnership not active"` on all calls — it is a stub waiting for credentials and a signed agreement.

The `AuctionSource` type already includes `'bidpath'` alongside `'internal'`, `'keeneland'`, `'fasig_tipton'`, and `'obs'` — the architecture was designed from the start to support multiple auction backends.

#### How to Activate the Integration

**Step 1 — Contact Bidpath**
- Website: bidpath.com
- Email: info@bidpath.com or use the contact form under "Partners"
- Ask for: a **white-label partnership agreement** for an online equine auction platform
- Mention: you have existing technology infrastructure and need their real-time bidding engine and settlement services

**Step 2 — What to ask for in the agreement**
- API credentials (WebSocket endpoint, API key, seller/lot management endpoints)
- Sandbox/test environment access before going live
- Their fee structure — typically a per-transaction fee or monthly platform fee
- Auctioneer licensing support or referrals to licensed auctioneers in KY/TX/FL/OK

**Step 3 — Technical implementation (2–3 days of work)**

The `BidpathAdapter` stub needs to be completed with three real implementations:

```
connect()         — WebSocket connection to Bidpath's real-time feed
placeBid()        — POST to Bidpath's bid submission API
onLotStateUpdate() — Handle incoming lot state events (current bid, time remaining, sold)
```

Bidpath's API is WebSocket-based for live events and REST for lot/sale management. Once you have credentials and their API docs, the adapter can be completed quickly because the interface is already defined — it's just filling in the HTTP/WS calls.

**Step 4 — Environment variables to add**
```
BIDPATH_API_KEY=
BIDPATH_WEBSOCKET_URL=
BIDPATH_API_BASE_URL=
BIDPATH_SELLER_ID=
```

**Step 5 — What activating Bidpath unlocks**
- EquineIQ-hosted sales that run on Bidpath's proven real-time infrastructure
- Their buyer registration and payment settlement (removes the need to build buyer's premium collection from scratch)
- Access to their existing user base of auction buyers — cross-promotion opportunity
- Auctioneer compliance handled through their licensed partners

#### Alternative: Run Fully Internal

The internal auction engine (Socket.io + PostgreSQL) is fully functional for smaller sales. The trade-off:

| | Internal Engine | Bidpath |
|---|---|---|
| Setup time | Ready now | 2–3 days after agreement |
| Cost | None beyond Render | Per-transaction fee |
| Auctioneer licensing | Your problem | Their support |
| Proven at scale | Small sales only | Yes |
| Buyer's premium collection | Needs to be built | Included |
| Existing buyer base | None | Some |

**Recommendation:** Use the internal engine for the first 2–3 sales to prove the model and build consignor relationships. Activate Bidpath once you're running regular sales and the transaction fee is justified by volume.

---

### Five-Year Revenue Model (Combined)

Adding auction revenue to the subscription model:

| Year | Subscription ARR | Auction Revenue | Total ARR |
|---|---|---|---|
| Y1 | $21k | $15k (2 small sales) | $36k |
| Y2 | $83k | $60k (8 sales) | $143k |
| Y3 | $226k | $175k (20 sales) | $401k |
| Y4 | $505k | $350k (40 sales) | $855k |
| Y5 | $952k | $595k (60 sales, larger lots) | **$1.55M** |

The auction side scales with consignor relationships and reputation — the first few sales are the hardest. Once you have 3–4 completed sales with documented results, consignors start coming to you.
