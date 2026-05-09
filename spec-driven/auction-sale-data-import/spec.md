# Specification: Auction Sale Data Import

> Date: 2026-05-08
> Version: 1.1
> Location: spec-driven/auction-sale-data-import/spec.md
> Tracking: N/A
> Source: Interactive elicitation

> **Provenance Key**: Content sources are marked inline:
> - **[User]** — Directly stated by the user
> - **[Inferred]** — Synthesized by the agent from available context
> - **[Codebase]** — Derived from codebase analysis
> - **[Default]** — Standard default applied

## Project Context

**Parent Project**: EquineIQ — AI-powered mating advisor. See `CLAUDE.md` for stack, conventions, and build commands. **[Codebase]**

**Scope**: This spec covers bulk import of historical horse auction sale data into the platform — via CSV upload (with column mapping presets for major sales companies) and via multiple provider API integrations: SporthorseData and Equibase (user-configured credentials) plus TJCIS/Equineline (platform-level, admin-managed). It also covers a Data Sources settings area for managing per-user API credentials. **[User]**

## Overview

EquineIQ users — breeders and buyers — want to bring historical sale data into the platform to enrich horse profiles, inform mating decisions, and track market values over time. Today there is no way to import data from Keeneland, Fasig-Tipton, OBS, or other major sales companies short of manually creating each horse. **[User]**

This feature adds two import paths: (1) CSV upload with an interactive column-mapper that supports preset formats for the major Thoroughbred sales companies plus a generic mapper for any CSV, and (2) direct API integrations with multiple data providers. Provider integration uses a tiered model: SporthorseData and Equibase are user-configured (users bring their own subscription credentials), while TJCIS/Equineline is platform-level (one commercial agreement managed by the platform admin, available to all users). All paths result in Horse records and historical SaleRecord entries in the database. **[User + Inferred]**

Imported horses can be claimed by the importing user (private catalog) or contributed to the platform's shared reference catalog, which is visible to all users during mating analysis — enabling the stallion catalog to grow organically from community imports. Shared catalog contributions take effect immediately with no admin approval gate. **[User]**

### Current State

No import functionality exists. Users must create Horse records manually via the UI. The platform's shared stallion catalog is populated only from seed data (`createdByUser = null` records). There is no SaleRecord model — historical sale prices are not stored. **[Codebase]**

## Goals

### Primary Goal

Enable users to bulk-import historical auction sale data from CSV files and multiple provider APIs, enriching the platform's horse profiles and shared stallion catalog with real-world sale history. **[User]**

### Secondary Goals

1. Provide a Data Sources settings area where users manage their own API credentials (SporthorseData, Equibase) and admins manage the platform-level TJCIS/Equineline connection. **[User]**
2. Grow the shared stallion catalog through community contributions from user imports. **[Inferred]**
3. Surface sale history on horse passport pages for mating analysis context. **[Inferred]**

### Non-Goals (Explicitly Out of Scope)

- Creating live auction sessions or bids from imported data — imported records are historical only. **[User]**
- Creating User accounts for buyers or consignors named in sale records — names stored as plain strings only. **[User]**
- Automated/scheduled API polling — all imports are user-initiated. **[Default]**
- Direct API integrations with Keeneland, Fasig-Tipton, OBS, or Saratoga — CSV presets only for those sources. **[User]**
- Import of race performance data or EPD records (separate feature). **[Inferred]**
- Multi-currency support — all hammer prices stored in USD cents at launch. **[User]**

## Users

### Primary Users

| User Type | Description | Goals | Pain Points |
|-----------|-------------|-------|-------------|
| Breeder / User | Registered EquineIQ user, breeder or buyer | Import horses bought or sold at auction; enrich pedigree data; contribute stallions to shared catalog | Manual horse creation is slow; no sale price history available |
| API Subscriber | User with SporthorseData or Equibase subscription | Pull pedigree + sale history directly from configured provider without CSV export | Must export manually and reformat; data duplication |

### Secondary Users

| User Type | Description | Goals | Pain Points |
|-----------|-------------|-------|-------------|
| Platform Admin | Admin managing the platform-level TJCIS/Equineline connection | Configure one commercial API credential that all users benefit from; bulk-import stallion catalogs | No import tool; must use DB seed scripts |

## Functional Requirements

### FR-1: CSV Upload & Parse

**Description**: User uploads a CSV file of auction sale data. The system parses the file, detects column headers, and returns the first 10 rows as a preview. **[User]**

**User Story**: As a user, I want to upload a CSV export from Keeneland or any sales company so that I can import the data without manual entry.

**Acceptance Criteria**:

| ID | Criterion | Given | When | Then |
|----|-----------|-------|------|------|
| AC-1.1 | Upload accepted | A logged-in user is on the Import page | They select a valid CSV file (≤ 10 MB) and click Upload | The file is parsed; column headers and first 10 rows are returned as a preview |
| AC-1.2 | File size rejection | A user attempts to upload a CSV > 10 MB | The upload is submitted | The system returns a 400 with "File exceeds 10 MB limit" |
| AC-1.3 | Invalid file type | A user uploads a non-CSV file (e.g., .xlsx) | The upload is submitted | The system returns a 400 with "Only CSV files are accepted" |
| AC-1.4 | Empty file | A user uploads a CSV with headers but no data rows | The upload is submitted | The system returns a 400 with "CSV contains no data rows" |

**Priority**: Must Have

**Goal**: Primary

**Dependencies**: None

---

### FR-2: Column Mapping with Presets

**Description**: After upload, the user maps CSV columns to platform fields (horse name, sex, breed, sire, dam, damsire, DOB, hammer price, buyer name, consignor name, hip number, sale date, sale session name). Pre-built mapping presets are available for Keeneland, Fasig-Tipton, OBS, and Saratoga CSV formats, plus a generic/manual mode. **[User]**

**User Story**: As a user, I want to select a preset for the sales company I exported from so that I don't have to manually map every column.

**Acceptance Criteria**:

| ID | Criterion | Given | When | Then |
|----|-----------|-------|------|------|
| AC-2.1 | Preset auto-maps | A parsed CSV is on screen | The user selects the "Keeneland" preset | All Keeneland standard column names are auto-mapped to platform fields; unmapped columns are shown as "Ignore" |
| AC-2.2 | Available presets | The mapping UI is open | The user opens the preset selector | Presets listed: Keeneland, Fasig-Tipton, OBS/Ocala, Saratoga, Generic (manual) |
| AC-2.3 | Manual override | A preset has been applied | The user changes a column mapping | The change is accepted; the modified mapping overrides the preset for that field |
| AC-2.4 | Required fields flagged | Any mapping configuration is active | The user attempts to proceed without mapping "Horse Name" | The system blocks progression and highlights "Horse Name" as required |
| AC-2.5 | Mapping persisted per session | A user completes a mapping | The user navigates away and back | The mapping is preserved for the duration of the session |

**Priority**: Must Have

**Goal**: Primary

**Dependencies**: FR-1

---

### FR-3: Import Preview & Validation

**Description**: Before committing, the system shows a full paginated preview table of all rows with per-row validation status. Rows with errors (missing horse name, unparseable date, invalid price) are flagged red; valid rows are green. User can proceed with valid rows only or cancel. This preview flow is shared by both the CSV path and the provider API paths. **[Inferred]**

**User Story**: As a user, I want to see exactly what will be created before I commit the import so that I can catch bad data before it enters my catalog.

**Acceptance Criteria**:

| ID | Criterion | Given | When | Then |
|----|-----------|-------|------|------|
| AC-3.1 | Rows displayed | Column mapping is complete (CSV) or API results returned | The user clicks "Preview" | All rows appear in a table with mapped field values; error rows are highlighted red |
| AC-3.2 | Validation errors shown | A row is missing a required field or has an invalid value | The preview renders | The row shows an inline error message (e.g., "Missing: Horse Name", "Invalid date format") |
| AC-3.3 | Valid-only import | Some rows have errors | The user clicks "Import valid rows only" | Only rows without errors are submitted; errored rows are excluded and counted in the summary |
| AC-3.4 | Dedup preview | A row matches an existing horse (name + sire + dam) | The preview renders | The row is flagged "Matched — will add sale record to existing horse [Name]" |
| AC-3.5 | Cancel clears state | A preview is showing | The user clicks Cancel | The uploaded file/API results and mapping state are cleared; user returns to the import start |

**Priority**: Must Have

**Goal**: Primary

**Dependencies**: FR-1, FR-2 (CSV path); FR-7 (API path)

---

### FR-4: Bulk Import Execution

**Description**: On confirmation, the system bulk-creates Horse records and SaleRecord entries. Rows matching an existing horse (name + sire + dam dedup key) skip horse creation and attach the sale record to the existing horse. The user chooses whether imports are added to their personal catalog or contributed to the shared reference catalog (immediate, no approval gate). Returns a completion summary. **[User]**

**User Story**: As a user, I want to confirm the import and get a summary of what was created, matched, or skipped so that I know the import completed correctly.

**Acceptance Criteria**:

| ID | Criterion | Given | When | Then |
|----|-----------|-------|------|------|
| AC-4.1 | Ownership choice | The preview is confirmed | The user selects "Add to my catalog" or "Contribute to shared catalog" before executing | The import runs with the selected ownership mode |
| AC-4.2 | Horse creation | A row has no matching horse | The import executes | A new Horse record is created with name, sex, breed, sire/dam/damsire (stored in pedigree JSON), DOB, registrationNumber, and createdByUser set per ownership choice |
| AC-4.3 | SaleRecord creation | Any valid row (new or matched horse) | The import executes | A SaleRecord is created with: horseId, saleSource, saleSessionName, saleDate, hipNumber, hammerPrice (integer cents, USD), buyerName, consignorName, importBatchId |
| AC-4.4 | Dedup — match | A row's name + sire + dam matches an existing Horse | The import executes | No new Horse is created; a SaleRecord is attached to the existing Horse; row counted as "matched" in summary |
| AC-4.5 | Completion summary | Import finishes | The summary screen renders | Shows: X horses created, Y sale records created, Z matched to existing horses, W rows skipped with errors |
| AC-4.6 | Shared catalog — immediate | User selects "Contribute to shared catalog" | Import executes | Created Horse records have `createdByUser = null`; they appear immediately in the shared stallion/reference catalog for all users without admin approval |
| AC-4.7 | Partial failure isolation | One row fails to insert (DB error) | Import executes | The failing row is skipped and counted as error; other rows complete normally; no partial rollback of successful rows |

**Priority**: Must Have

**Goal**: Primary

**Dependencies**: FR-1, FR-2, FR-3

---

### FR-5: Import History

**Description**: Users can view a log of their past import batches, showing source, date, record counts, and status. Each batch is drillable to see which horses were created vs. matched vs. errored. **[Inferred]**

**User Story**: As a user, I want to see my import history so that I can audit what data entered the platform and when.

**Acceptance Criteria**:

| ID | Criterion | Given | When | Then |
|----|-----------|-------|------|------|
| AC-5.1 | History list | A user has completed at least one import | They navigate to Import > History | A list of batches appears: source file/provider, date, created, matched, errored counts, status |
| AC-5.2 | Batch detail | A batch appears in the history list | The user clicks on it | A detail view shows all rows in that batch with their individual outcomes |
| AC-5.3 | Empty state | A user has no imports | They navigate to the History tab | "No imports yet — upload a CSV or connect a data source to get started" is displayed |

**Priority**: Must Have

**Goal**: Secondary-2

**Dependencies**: FR-4

---

### FR-6: Data Sources Settings

**Description**: A "Data Sources" tab on the User Settings page where users enter, test, and manage API credentials for user-tier providers (SporthorseData, Equibase). A separate admin-only section manages the platform-level TJCIS/Equineline credential. All credentials are encrypted at rest using AES-256-GCM with a key from the `CREDENTIAL_ENCRYPTION_KEY` environment variable. **[User]**

**Supported providers at launch:**

| Provider | Tier | Who configures | Data coverage |
|----------|------|----------------|---------------|
| SporthorseData | User-configured | Each user adds their own key | Warmblood/sport horse pedigree + competition/sale results; free tier available |
| Equibase | User-configured | Each user adds their own subscription credentials | Thoroughbred race records + basic pedigree; Jockey Club family |
| TJCIS / Equineline | Platform-level | Admin configures once; all users benefit | Authoritative TB pedigree + sale history; requires commercial agreement with TJCIS |

**User Story**: As a user with a SporthorseData subscription, I want to enter my API key once in settings so that I can pull horse data directly without CSV exports.

**Acceptance Criteria**:

| ID | Criterion | Given | When | Then |
|----|-----------|-------|------|------|
| AC-6.1 | Data Sources tab exists | A logged-in user is on the Settings page | They click "Data Sources" | A tab appears listing user-tier providers (SporthorseData, Equibase) with credential entry forms per provider |
| AC-6.2 | Save user credentials | A user enters valid-format credentials for any provider | They click Save | Credentials are stored encrypted (AES-256-GCM); a masked representation is shown (e.g., `sd_****abcd`) |
| AC-6.3 | Test connection | Credentials are saved for any provider | The user clicks "Test Connection" | The system calls the provider API; reports "Connected ✓" or "Failed: [reason]" |
| AC-6.4 | Revoke credentials | Credentials are saved | The user clicks Remove | Credentials are deleted; the form resets to empty |
| AC-6.5 | Encrypted at rest | Credentials are saved to the DB | An admin queries the raw DB | The API key value is not stored in plaintext |
| AC-6.6 | Platform TJCIS status visible | TJCIS/Equineline platform credential is configured by admin | Any user views Data Sources | A read-only "Equineline (Platform)" section shows connected status; users cannot modify it |
| AC-6.7 | Admin TJCIS config | A platform admin navigates to the admin settings | They enter TJCIS credentials | The platform-level credential is saved encrypted; test connection reports status; all users gain Equineline access |

**Priority**: Must Have

**Goal**: Secondary-1

**Dependencies**: None

---

### FR-7: Provider API Pull

**Description**: Users with configured provider credentials (SporthorseData, Equibase, or via the platform TJCIS/Equineline connection) can search for a horse by name or registration number, preview the pedigree and sale history returned by the API, and import it — following the same ownership choice and dedup logic as CSV imports. **[User]**

**User Story**: As a user with SporthorseData or Equibase configured, I want to search for a horse by name and import its pedigree and sale history directly so that I don't need to export and reformat CSVs.

**Acceptance Criteria**:

| ID | Criterion | Given | When | Then |
|----|-----------|-------|------|------|
| AC-7.1 | Provider selector | A user navigates to Import > API Pull | The page loads | Available providers are listed (only those with credentials configured by the user, plus Equineline if platform credential is active) |
| AC-7.2 | No credentials prompt | A user selects a provider they haven't configured | They land on the provider's search screen | A prompt appears: "Connect [Provider] in Settings → Data Sources to use this feature" |
| AC-7.3 | Search by name | A user selects a configured provider | They enter a horse name and click Search | The system queries the provider API; matching horses are listed with name, sire, dam, and year |
| AC-7.4 | Search by registration | A user selects a configured provider that supports it | They enter a registration/ID number | The system returns the exact horse record |
| AC-7.5 | Preview before import | A search result is selected | The user clicks "Preview" | Pedigree fields and sale records from the provider are displayed in the shared FR-3 preview format |
| AC-7.6 | Import execution | Preview is shown | The user confirms with ownership choice | Horse and SaleRecord(s) are created per FR-4 logic; dedup applies |
| AC-7.7 | API error handling | A provider API returns an error | Any search or preview action | A user-friendly error is shown ("[Provider] returned an error: [message]"); no partial records are created |
| AC-7.8 | Provider abstraction | A new provider is added in future | Configuration is added | The search/preview/import flow works identically regardless of which provider is selected |

**Priority**: Should Have

**Goal**: Primary

**Dependencies**: FR-6, FR-4

---

### FR-8: Pedigree Cross-Link

**Description**: After import, the system flags horses in the batch where the sire or dam name matches an existing Horse in the platform DB. The importing user can confirm the link, replacing the plain-text pedigree entry with a pointer to the matched horse. **[Inferred]**

**User Story**: As a user, I want the system to detect when an imported horse's sire or dam is already in the platform so that I can link pedigree relationships instead of storing duplicate names.

**Acceptance Criteria**:

| ID | Criterion | Given | When | Then |
|----|-----------|-------|------|------|
| AC-8.1 | Link suggestions shown | An import batch completes | The completion summary renders | If any sire/dam name matches an existing Horse's name, a "Pedigree Links Suggested" section appears with match details |
| AC-8.2 | Confirm link | A suggestion is shown | The user clicks "Confirm Link" | The Horse's pedigree JSON is updated with the matched horse's ID; the match is recorded |
| AC-8.3 | Dismiss suggestion | A suggestion is shown | The user clicks "Dismiss" | The suggestion is removed; plain-text pedigree entry remains |

**Priority**: Should Have

**Goal**: Secondary-2

**Dependencies**: FR-4

---

### FR-9: Additional Column-Mapping Presets

**Description**: Extend the preset library to include AQHA (Quarter Horse) and KWPN/Warmblood auction formats, enabling non-Thoroughbred importers to use pre-built mappings. **[User]**

**User Story**: As a Quarter Horse or Warmblood breeder, I want a preset for my breed's sales company format so that I don't have to manually map every column.

**Acceptance Criteria**:

| ID | Criterion | Given | When | Then |
|----|-----------|-------|------|------|
| AC-9.1 | AQHA preset available | The column mapping preset selector is open | The user selects "AQHA Sales" | AQHA standard column names are auto-mapped |
| AC-9.2 | KWPN preset available | The column mapping preset selector is open | The user selects "KWPN/Warmblood" | KWPN standard column names are auto-mapped |

**Priority**: Nice to Have

**Goal**: Secondary-2

**Dependencies**: FR-2

---

## Non-Functional Requirements

### NFR-1: Import Throughput

**Category**: Performance

**Description**: A CSV import of up to 500 rows must complete within a reasonable time for a web request. Larger batches queue as background jobs.

**Metric**: End-to-end import latency for 500-row CSV

**Target**: ≤ 10 seconds synchronous; batches > 500 rows queue as background jobs with polling status

**Verification**: Load test with 500-row sample Keeneland CSV

---

### NFR-2: Credential Security

**Category**: Security

**Description**: Provider API credentials stored in the DB must be encrypted at rest using AES-256-GCM with a server-side key from the `CREDENTIAL_ENCRYPTION_KEY` environment variable. Credentials must never be returned in plaintext via any API endpoint. **[User]**

**Metric**: Plaintext API key visible in DB or API response

**Target**: Zero plaintext occurrences

**Verification**: Direct DB query + API response inspection during code review

---

### NFR-3: Data Isolation

**Category**: Security

**Description**: A user's imported horses and credentials must not be accessible to other users unless explicitly contributed to the shared catalog. **[Inferred]**

**Metric**: Cross-user data access attempt

**Target**: 403 on all cross-user access attempts

**Verification**: Integration tests with two distinct user sessions

---

### NFR-4: Idempotent Imports

**Category**: Reliability

**Description**: Running the same CSV twice must not create duplicate horses or duplicate sale records for the same event (same horse + hip # + sale date). **[Inferred]**

**Metric**: Duplicate records created on re-import

**Target**: Zero duplicates; re-import of same batch produces 0 new horses, 0 new sale records

**Verification**: Integration test — import a CSV, import it again, assert counts unchanged

---

## Scope

### In Scope

- CSV upload with interactive column mapping and pre-built presets (Keeneland, Fasig-Tipton, OBS, Saratoga, Generic)
- Provider API pull with a provider-abstracted search/preview/import flow
  - User-configured: SporthorseData (warmblood/sport horse), Equibase (Thoroughbred race + pedigree)
  - Platform-level: TJCIS/Equineline (admin-managed, available to all users)
- Data Sources tab in User Settings for managing user-tier provider credentials
- Admin-only section for platform-level TJCIS/Equineline credential
- AES-256-GCM credential encryption via `CREDENTIAL_ENCRYPTION_KEY` env var
- Horse record creation (user-owned or shared catalog, immediate) with pedigree JSON storage
- SaleRecord model for historical sale data (USD cents, not connected to live auction flow)
- Import batch history and row-level audit log
- Dedup by name + sire + dam; skip with report
- Pedigree cross-link suggestions post-import
- AQHA and KWPN/Warmblood presets (Nice to Have)

### Out of Scope

- Creating live auctions, bids, or AuctionListing records from imported data
- Creating User platform accounts for buyers or consignors
- Automated or scheduled data pulls from any provider
- Direct API integrations with Keeneland, Fasig-Tipton, OBS, or Saratoga (CSV presets only)
- Race performance data import
- Import update/merge — existing records are never overwritten, only supplemented with new SaleRecords
- Multi-currency support (GBP, EUR) — USD only at launch

### Constraints

- Credentials encrypted at rest with AES-256-GCM; key from `CREDENTIAL_ENCRYPTION_KEY` env var. **[User]**
- Historical SaleRecord entries must not affect live auction state or bidding workflows. **[User]**
- Buyer and consignor names stored as plain strings — no User account creation from import data. **[User]**
- CSV file size limit: 10 MB (~5,000 rows). **[Inferred]**
- Must integrate with existing Prisma + PostgreSQL schema; new models added via migration. **[Codebase]**
- TJCIS/Equineline platform-level integration requires a commercial agreement before implementation can begin; FR-7 Equineline path is blocked until that agreement is in place. **[Inferred]**

### Assumptions

- SporthorseData provides a developer-accessible REST API with standard API key authentication; free tier is available.
- Equibase provides subscription-based programmatic access for pedigree and race record queries.
- Major sales companies (Keeneland, Fasig-Tipton, OBS) export CSV files with consistent column naming within a format version; presets will target their current standard export formats.
- Horse dedup by name + sire + dam is sufficient for launch; collision rate is acceptable for initial rollout.
- The `pedigree` JSON field on the Horse model can store sire, dam, damsire, and extended pedigree as unstructured JSON without schema migration.

### Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| TJCIS commercial agreement takes long to secure | High | Medium | Ship CSV + SporthorseData + Equibase first; Equineline path blocked behind agreement |
| SporthorseData or Equibase API terms restrict commercial use | Medium | Low | Verify TOS before beginning FR-7 implementation for each provider |
| Sales company CSV formats change between export versions | Medium | Medium | Build preset versioning into mapping config; make presets easily updatable without deploys |
| Large imports (> 500 rows) time out HTTP request | Medium | Low | Background job pattern for large batches with polling endpoint |
| Encrypted credential key rotation | Medium | Low | Use standard envelope encryption; document key rotation procedure |

## Success Metrics

### Primary Metrics

| Metric | Current Baseline | Target | Measurement Method |
|--------|------------------|--------|-------------------|
| Time to import a 100-row Keeneland CSV end-to-end | No baseline | < 2 minutes total UX time | Manual timing on staging |
| Horse profiles enriched with sale history | 0 | Measurable growth 30 days post-launch | DB count of SaleRecord rows |

### Secondary Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Shared catalog growth | Measurable increase in `createdByUser = null` Horse records | DB count delta |
| Provider API connection success rate | > 95% for valid credentials | Test connection log |

## Dependencies

### External Systems

- **SporthorseData** ([sporthorse-data.com](https://sporthorse-data.com)): Warmblood/sport horse pedigree + competition/sale data. Developer API with free tier. User self-configures.
- **Equibase**: Thoroughbred race records + basic pedigree. Subscription-based access. User self-configures.
- **TJCIS / Equineline (The Jockey Club Information Systems)**: Authoritative TB pedigree + sale history. Platform-level; requires commercial agreement before implementation.

### Internal Dependencies

- User Settings page must support a tabbed layout with a new "Data Sources" tab.
- Horse model and Prisma schema must be extended with new `SaleRecord` and `ImportBatch` models (migration required).
- A `UserProviderConfig` model is needed to store encrypted provider credentials per user.
- A `PlatformProviderConfig` model (admin-only) is needed for TJCIS/Equineline platform-level credentials.

### Data Dependencies

- Column mapping presets for Keeneland, Fasig-Tipton, OBS, and Saratoga must be researched against current export formats before implementation.
- SporthorseData and Equibase API contracts (endpoints, auth, rate limits) must be confirmed before FR-7 implementation begins.

## Open Questions

> All open questions resolved during elicitation.

| # | Question | Resolution |
|---|----------|------------|
| OQ-1 | Equineline API contract — consumer API availability | Equineline has no consumer API. Replaced with provider-tiered model: SporthorseData + Equibase (user-configured), TJCIS platform-level (commercial agreement required). |
| OQ-2 | Credential encryption approach | AES-256-GCM with server-side key from `CREDENTIAL_ENCRYPTION_KEY` env var. Simpler than KMS; works on Render. |
| OQ-3 | SaleRecord currency | USD only at launch. Multi-currency deferred. |
| OQ-4 | Shared catalog moderation | Immediate — no admin approval gate. |

## Agent Decisions

> Decisions made by the agent during elicitation. Review these — they represent assumptions that may need validation.

| # | Decision | Context | Rationale | Affects |
|---|----------|---------|-----------|---------|
| 1 | New `SaleRecord` model (not extend AuctionListing) | Historical sale data doesn't fit AuctionListing — requires nullable sellerId and bypasses the full vetting/approval lifecycle | Cleaner separation; AuctionListing reserved for live platform auctions; SaleRecord is a lightweight read-only history record | FR-4, Dependencies |
| 2 | Dedup key = name + sire + dam | No universal horse ID reliably available; registration number often absent in CSVs | Name + sire + dam is the standard industry matching key; works across all breeds | FR-4 |
| 3 | CSV uploads synchronous ≤ 500 rows, background job > 500 rows | Web request timeout risk for large batches | Keeps the simple case simple; 500 rows covers the majority of sale sessions | NFR-1, FR-4 |
| 4 | Multi-provider tiered architecture (user-configured + platform-level) | Equineline has no consumer API; multiple providers needed for broad coverage | SporthorseData/Equibase support user self-service; TJCIS requires commercial agreement and is admin-managed; provider abstraction layer allows adding more without UI changes | FR-6, FR-7 |
| 5 | `PlatformProviderConfig` separate from `UserProviderConfig` | Admin-managed credentials are shared across all users; different access control and lifecycle from per-user credentials | Avoids confusion between user-scoped and platform-scoped credentials; platform config is not exposed to regular user settings UI | FR-6, Dependencies |
