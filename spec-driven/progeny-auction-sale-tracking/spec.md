# Specification: Progeny Auction Sale Tracking

> Date: 2026-05-08
> Version: 1.0
> Location: spec-driven/progeny-auction-sale-tracking/spec.md
> Tracking: N/A
> Source: Interactive elicitation

> **Provenance Key**: Content sources are marked inline:
> - **[User]** — Directly stated by the user
> - **[Inferred]** — Synthesized by the agent from available context
> - **[Default]** — Standard default applied
> - **[Codebase]** — Derived from codebase analysis

## Project Context

**Parent Project**: EquineIQ — AI-powered mating advisor for horse breeders. See `CLAUDE.md` for project-wide principles and patterns. **[Codebase]**

**Scope**: This specification defines requirements for recording and querying auction sale prices for foals (progeny) produced by stallion × mare pairings. **[User]**

## Overview

Breeders who use EquineIQ to plan matings currently have no way to close the loop — to record what those pairings actually produced at auction and what that progeny sold for. This feature adds structured auction sale tracking for foals, enabling breeders to see whether the stallions they are considering have consistently produced commercially valuable offspring. **[User]**

A dedicated `AuctionSale` entity captures sale price, auction house, sale date, sale type (weanling, yearling, etc.), hip number, and optional buyer details for any foal tracked in the system. Aggregate statistics (average, median, high, low) roll up per stallion and per stallion × mare combination, and the highest-value summary surfaces inline in the mating analysis output when running a new pairing. **[Inferred]**

### Current State

A `FoalResult` model exists for tracking competition performance results (event, eventDate, placement, score, earnings). While the generic `earnings` field could hold a sale price, it carries no auction-specific structure — no auction house, hip number, sale type, or buyer. There is no aggregate query capability and no integration with the mating analysis. Breeders currently have no mechanism inside EquineIQ to track or query progeny sale data. **[Codebase]**

## Goals

### Primary Goal
Give breeders a closed-loop view: record what progeny from specific stallion × mare combinations sold for at auction, and surface that market signal when evaluating future matings. **[User]**

### Secondary Goals
1. Enable per-stallion market value benchmarking so breeders can compare stud fee against historic progeny sale prices. **[Inferred]**
2. Surface progeny sale averages inline in mating analysis to make the recommendation more commercially grounded. **[Inferred]**

### Non-Goals (Explicitly Out of Scope)
- Private treaty / negotiated sale tracking. **[Open Question — user did not specify; assumed out of scope for v1]**
- Integration with third-party auction house APIs (Keeneland, Fasig-Tipton, OBS, etc.). **[Inferred]**
- Multi-currency support. All sale prices stored in USD. **[Inferred]**

## Users

### Primary Users
| User Type | Description | Goals | Pain Points |
|-----------|-------------|-------|-------------|
| Breeder | Small to mid-size horse breeder (3–30 mares); existing EquineIQ subscriber | Track what their foals sell for; evaluate stallion commercial value against stud fee | No structured way to record or query auction sale data inside the app today **[Codebase]** |

## Functional Requirements

### FR-1: Record an auction sale for a foal

**Description**: A breeder can record one or more auction sales against an existing foal in the system, capturing sale price, sale date, sale type, and optional descriptive fields. **[User]**

**User Story**: As a breeder, I want to record an auction sale for one of my foals so that I can track what the progeny produced by a specific pairing actually sold for.

**Acceptance Criteria**:

| ID | Criterion | Given | When | Then |
|----|-----------|-------|------|------|
| AC-1.1 | Required fields accepted | A foal record exists for the user | The breeder submits a sale with `salePrice`, `saleDate`, and `saleType` | The sale is created and returned with a generated ID **[User]** |
| AC-1.2 | Optional fields stored | The breeder provides `auctionHouse`, `hipNumber`, `buyer`, or `notes` | The sale is created | Those optional fields are stored and returned **[User]** |
| AC-1.3 | Validation on bad input | The breeder submits a `salePrice` ≤ 0 or omits `saleDate` | The API is called | A 400 error is returned with a descriptive validation message **[Inferred]** |

**Priority**: Must Have

**Goal**: Primary

**Dependencies**: None

---

### FR-2: View auction sale history for a foal

**Description**: The foal detail response includes the full list of auction sales recorded for that foal, ordered by sale date descending. **[Inferred]**

**User Story**: As a breeder, I want to see all auction sales recorded for a foal so that I have a complete sale history for that animal.

**Acceptance Criteria**:

| ID | Criterion | Given | When | Then |
|----|-----------|-------|------|------|
| AC-2.1 | Sales returned in foal detail | A foal has one or more auction sales | The breeder requests the foal detail | The response includes a full list of auction sales ordered by `saleDate` descending **[Inferred]** |
| AC-2.2 | Empty array for unsold foals | A foal has no auction sales | The breeder requests the foal detail | The response includes an empty `auctionSales` array (not an error) **[Inferred]** |

**Priority**: Must Have

**Goal**: Primary

**Dependencies**: FR-1

---

### FR-3: Aggregate sale statistics per stallion

**Description**: A stats endpoint returns average, median, high, and low auction sale prices for all progeny of a given stallion recorded across the user's account. **[Inferred]**

**User Story**: As a breeder, I want to see average, median, high, and low auction prices for a stallion's progeny so that I can evaluate his commercial value against his stud fee.

**Acceptance Criteria**:

| ID | Criterion | Given | When | Then |
|----|-----------|-------|------|------|
| AC-3.1 | Stats returned for stallion with sales | A stallion has progeny with recorded auction sales | The breeder requests stallion sale stats | The response includes `count`, `avg`, `median`, `high`, `low` sale price **[Inferred]** |
| AC-3.2 | Null stats for stallion with no sales | A stallion has no recorded auction sales | The breeder requests stallion sale stats | The response returns `{ count: 0 }` with null aggregate fields (not an error) **[Inferred]** |
| AC-3.3 | Stallion catalog visibility | The stallion is a shared catalog entry not owned by the requesting user | The API is called | Stats are visible — the stallion catalog is shared; only the sales themselves are user-scoped **[Codebase]** |

**Priority**: Must Have

**Goal**: Primary

**Dependencies**: FR-1

---

### FR-4: Aggregate sale statistics for a stallion × mare combination

**Description**: A cross-specific stats endpoint returns count, average, high, and low sale prices for foals from a specific stallion × mare combination, with a low-sample warning when fewer than 3 sales exist. **[Inferred]**

**User Story**: As a breeder, I want to see sale stats for a specific stallion × mare cross so that I can evaluate whether this particular combination has historically produced commercially valuable progeny.

**Acceptance Criteria**:

| ID | Criterion | Given | When | Then |
|----|-----------|-------|------|------|
| AC-4.1 | Stats returned for cross with sales | A stallion × mare combination has foals with recorded sales | The breeder requests cross-specific stats | The response includes `count`, `avg`, `high`, `low` for that specific cross **[Inferred]** |
| AC-4.2 | Low-sample warning | The combination has fewer than 3 recorded sales | The stats are returned | A `lowSampleWarning: true` flag is included in the response **[User]** |

**Priority**: Should Have

**Goal**: Secondary-1

**Dependencies**: FR-1, FR-3

---

### FR-5: Surface sale stats in mating analysis output

**Description**: When a mating analysis is run for a stallion that has recorded progeny sale data in the system, the per-stallion analysis result includes a `progenySaleStats` summary (average price and count). **[Inferred]**

**User Story**: As a breeder, I want the mating analysis to show historical progeny sale averages for each stallion so that commercial value is part of how I evaluate the recommendation.

**Acceptance Criteria**:

| ID | Criterion | Given | When | Then |
|----|-----------|-------|------|------|
| AC-5.1 | Stats included when data exists | A stallion has recorded progeny sales in the system | A mating analysis is run | The analysis result for that stallion includes a `progenySaleStats` field with `avg` and `count` **[Inferred]** |
| AC-5.2 | Graceful absence when no data | A stallion has no recorded progeny sales | A mating analysis is run | The `progenySaleStats` field is `null` or absent — the analysis proceeds normally **[Inferred]** |

**Priority**: Should Have

**Goal**: Secondary-2

**Dependencies**: FR-3

---

### FR-6: Dashboard stallion auction performance panel

**Description**: A dashboard panel shows each stallion the breeder has used (i.e., has foals linked to) ranked by average auction sale price, allowing quick comparison of commercial returns across studs. **[Inferred]**

**User Story**: As a breeder, I want a dashboard view comparing auction performance across stallions I've used so that I can see which pairings delivered the best market returns.

**Acceptance Criteria**:

| ID | Criterion | Given | When | Then |
|----|-----------|-------|------|------|
| AC-6.1 | Panel renders with data | The breeder has auction sales recorded for multiple stallions | The breeder opens the dashboard | A panel displays each stallion with average sale price and sale count, sortable by avg price **[Inferred]** |
| AC-6.2 | Empty state | The breeder has no auction sales recorded | The breeder opens the dashboard | The panel shows an empty-state prompt to record a sale **[Inferred]** |

**Priority**: Nice to Have

**Goal**: Secondary-1

**Dependencies**: FR-3

---

## Non-Functional Requirements

### NFR-1: API Response Time

**Category**: Performance

**Description**: Auction sale CRUD endpoints must respond within target latency bounds at the 95th percentile. **[User]**

**Metric**: p95 response time

**Target**: Create/read/update/delete operations < 200ms; stats aggregation endpoints (FR-3, FR-4) < 500ms

**Verification**: Load test or manual timing in staging environment

---

### NFR-2: Data Authorization

**Category**: Security

**Description**: All auction sale data must be user-scoped. A breeder must not be able to read, create, or delete auction sales belonging to another user's account. **[Codebase]**

**Metric**: All `/foals/:id/auction-sales` routes enforce `requireAuth` and validate `userId` ownership of the foal before operating on its sales

**Target**: Zero cross-user data leakage

**Verification**: Integration test — attempt to access another user's foal sales with a different JWT; expect 404

---

### NFR-3: Reliability

**Category**: Reliability

**Description**: Auction sale data must be durably stored with no data loss on successful API response. Stats queries must degrade gracefully (return null stats) rather than error when no data exists. **[Default]**

**Metric**: No data loss on successful 201 response; zero 500 errors on empty-state stats queries

**Target**: Standard Render PostgreSQL durability guarantees

**Verification**: Unit test null-data paths in stats aggregation; rely on Render managed PostgreSQL for durability

---

## Scope

### In Scope
- `AuctionSale` model: new entity linked to `Foal` via required foreign key
- CRUD API for auction sales nested under `/api/foals/:id/auction-sales`
- Aggregate stats API: per-stallion (`GET /api/stallions/:id/auction-sale-stats`) and per-cross (`GET /api/stallions/:id/auction-sale-stats?mareId=:mareId`)
- `progenySaleStats` field added to mating analysis output (FR-5)
- Frontend: foal detail view shows sale history; dashboard panel shows stallion comparison (FR-6, Nice to Have)

### Out of Scope
- Private treaty / negotiated sale tracking
- Third-party auction house API integration
- Multi-currency support
- Buyer identity analytics or market intelligence features

### Constraints
- Auction sale record requires an existing `Foal` record — standalone sale entry without a foal is not supported. **[User]**
- Single-currency (USD) — no currency field needed in v1. **[Inferred]**
- Must follow existing route authorization pattern: `requireAuth` + `getUserId` ownership check. **[Codebase]**

### Assumptions
- Breeders will create a `Foal` record before logging an auction sale — the UI flow will guide this.
- A single foal may appear in multiple auction sessions (e.g., passed at one sale, sold at another) — multiple `AuctionSale` records per foal are valid.
- `saleType` enum covers the most common sale categories: `weanling`, `yearling`, `two_year_old_in_training`, `mixed_age`. **[Agent Decision]**

### Risks
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Low adoption — breeders don't record sales consistently, leaving stats sparse | Medium | Medium | Low-sample warning on FR-4; `progenySaleStats` gracefully absent rather than misleading |
| Stats in mating analysis (FR-5) slow down `/analyze` response time | Medium | Low | Pre-compute or query stats as a separate parallel DB call; return null rather than waiting if query exceeds budget |
| `saleType` enum doesn't cover niche sale categories | Low | Low | Store as enum but include `notes` field for freeform context |

## Success Metrics

### Primary Metrics
| Metric | Current Baseline | Target | Measurement Method |
|--------|------------------|--------|-------------------|
| Breeders with at least one auction sale recorded per foal tracked | 0 (feature doesn't exist) | ≥ 1 sale per foal entered in the system within 60 days of launch | DB query: `COUNT(DISTINCT foalId) FROM AuctionSale` vs `COUNT(*) FROM Foal` |

## Dependencies

### Internal Dependencies
- `Foal` model — `AuctionSale` requires a valid `foalId` FK
- `Horse` model (stallion) — stats queries join through `Foal.stallionId`
- `MatingPairing` — FR-5 augments the pairing analysis response; `pairingId` on `Foal` is optional

### Data Dependencies
- Prisma migration to add `AuctionSale` table
- No seed data required

## Open Questions

> Questions that need stakeholder input before implementation

1. **Non-goals undefined**: The user did not specify explicit non-goals for this feature. The non-goals listed (private treaty, API integration, multi-currency) are agent assumptions. Validate before design begins.
2. **`buyer` field**: The spec includes an optional `buyer` string field on `AuctionSale`. Confirm whether capturing buyer identity is desirable or raises any privacy concerns.
3. **Stats scope**: FR-3 stats are user-scoped (only the requesting user's sales). Should stallion sale stats aggregate across all users' data (global market signal), or remain per-user? Global aggregation would significantly increase the value of the stats but requires a deliberate data-sharing decision.

## Agent Decisions

> Decisions made by the agent during elicitation. Review these — they represent assumptions that may need validation.

| # | Decision | Context | Rationale | Affects |
|---|----------|---------|-----------|---------|
| 1 | New `AuctionSale` model rather than extending `FoalResult` | `FoalResult` exists but uses a generic event/placement/score structure | Auction sales have distinct required fields (auctionHouse, hipNumber, saleType) that don't map to the generic model without contorting the schema | FR-1, FR-2 |
| 2 | `saleType` as enum: `weanling`, `yearling`, `two_year_old_in_training`, `mixed_age` | No guidance provided on sale age categories | Standard categories used in major North American auction houses (Keeneland, Fasig-Tipton, OBS) | FR-1, AC-1.1 |
| 3 | Stats are user-scoped by default | No guidance on whether sale data should be shared across accounts | User privacy default — a breeder's sale records are their own data; global aggregation is a deliberate product decision | FR-3, FR-4 |
