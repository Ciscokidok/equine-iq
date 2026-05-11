# EquineIQ — Data Licensing & Go-to-Market Guide

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

### What Equineline Provides
- Complete Thoroughbred pedigree database (every registered TB)
- Sale history across all major auctions (Keeneland, Fasig-Tipton, OBS, Tattersalls)
- Racing performance records
- Breeding records and produce records (what foals each mare/stallion has produced)
- Progeny performance summaries — exactly what the Mating Advisor needs

### API Access
The Jockey Club Information System (TJCIS) already has a connector stub in the EquineIQ codebase (`src/lib/dataProviders/`). The platform provider config for `tjcis` is in the database schema. The integration point exists — it just needs credentials.

To get access:
1. Go to equineline.com and click "Data Licensing" or call (800) 333-1778
2. Request commercial API access for a breeding/sales analytics application
3. Expect a per-query fee or monthly subscription; cost depends on query volume

### Cost Range
- Individual subscriptions: ~$25–$50/month (not suitable for a platform)
- Commercial API/data licensing: negotiated, typically $500–$5,000/year for a small platform
- Revenue-share arrangements are possible for early-stage companies

### Why This Is the Right Long-Term Path
Equineline is the authoritative source for Thoroughbred data. Every serious buyer and seller in the TB market trusts it. A platform backed by Equineline data has instant credibility with the people you're trying to sell to.

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
