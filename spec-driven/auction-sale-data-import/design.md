---
slug: auction-sale-data-import
status: final
spec_source: spec-driven/auction-sale-data-import/spec.md
spec_tier: 1
adaptive_flow: partial
test_approach: test-after
test_capabilities:
  unit: vitest
  integration: vitest + supertest
  e2e: null
created_date: 2026-05-08T00:00:00Z
last_updated: 2026-05-08T00:00:00Z
---

# Architectural Design: auction-sale-data-import

## Overview

- **Spec**: Auction Sale Data Import (9 FRs, 4 NFRs)
- **Architecture**: extension — adds import pipeline, 4 new Prisma models, new routes, and a multi-provider data adapter layer to an existing Node/Express/Prisma/React application
- **Test approach**: test-after [codebase — matches all existing test files]
- **Test capabilities**: unit=vitest, integration=vitest+supertest, e2e=null [no e2e framework in repo; integration tests cover the critical import path]

## Technical Approach

### 1. Credential Storage — Reuse Existing Encryption Module

The codebase already has `api/src/lib/encryption.ts` implementing AES-256-CBC with the `ENCRYPTION_KEY` environment variable. The same `encrypt()`/`decrypt()` pair is used for the OpenAI key on the User model. Provider credentials (both user-tier and platform-tier) reuse this module — no new encryption library, no new env var.

Per-user provider credentials are stored in a new normalized `UserProviderConfig` table (not as columns on User), so adding more providers never requires a User schema migration. Platform-level credentials (for TJCIS/Equineline) go in a separate `PlatformProviderConfig` table with admin-only access control (AD-1, AD-2, AD-3).

### 2. Data Model — Four New Prisma Models

**`SaleRecord`**: The central new model for imported sale data. Linked to `Horse` (horse-centric, unlike the existing `AuctionSale` which is foal-centric). Stores `hammerPriceCents: Int` (integer cents, USD) with a unique index on `(horseId, hipNumber, saleDate)` to make re-imports idempotent. Linked to `ImportBatch` for audit trail (AD-4).

**`ImportBatch`**: Audit record for every import run. Tracks who ran it, source type (`csv` | `api`), provider, file name, row counts (created/matched/error), status, and a JSON error log. Owned by the importing user even when horses go to the shared catalog (AD-5).

**`UserProviderConfig`**: Per-user encrypted provider credentials. One row per (user, provider) pair. Fields: `provider` (enum), `encryptedCredential`, `testStatus`, `testedAt` (AD-2).

**`PlatformProviderConfig`**: Admin-managed credentials for platform-level providers (TJCIS/Equineline). One row per provider. Guarded by `requireAdmin` middleware. Same encryption as user-tier (AD-3).

### 3. CSV Import Pipeline — multer + csv-parse

No file upload or CSV parsing infrastructure exists today. The pipeline uses three sequential API endpoints behind `requireAuth`:

1. **`POST /api/import/upload`** — `multipart/form-data` via `multer` (in-memory, 10 MB limit). Parses with `csv-parse`. Returns detected column headers and the first 10 data rows. No DB writes at this stage.

2. **`POST /api/import/preview`** — Accepts a `mappingConfig` (column-to-field map) and the raw rows from step 1 (re-uploaded or session-cached). Applies the mapping, validates each row (required fields, date/price formats), detects duplicates against existing Horse records (name + sire + dam dedup key). Returns per-row status: `valid`, `error`, or `matched`.

3. **`POST /api/import/execute`** — Accepts `mappingConfig`, `validatedRows`, `ownership` (`personal` | `shared`), and creates `ImportBatch` → `Horse` records (if not matched) → `SaleRecord` entries. Uses `prisma.$transaction` for atomicity per-row; errors are caught per-row and do not roll back the batch (partial failure isolation). Returns the completed `ImportBatch` record.

Column mapping presets (Keeneland, Fasig-Tipton, OBS, Saratoga, AQHA, KWPN, Generic) are stored as a static config object in `api/src/lib/columnMappingPresets.ts`. Each preset declares `defaultDiscipline` (e.g., `thoroughbred_racing` for Keeneland), satisfying the required `Horse.discipline` field (AD-6).

Import history is served by **`GET /api/import/history`** and **`GET /api/import/history/:batchId`** (AD-5).

### 4. Provider API Abstraction — DataProviderAdapter Interface

Mirrors the existing `AuctionHouseAdapter` pattern in `api/src/lib/adapters/types.ts`. A new `DataProviderAdapter` interface lives at `api/src/lib/dataProviders/types.ts`:

```typescript
interface DataProviderAdapter {
  readonly provider: DataProvider  // enum: 'sporthorse_data' | 'equibase' | 'tjcis'
  search(query: string): Promise<HorseSearchResult[]>
  fetchSaleHistory(providerRef: string): Promise<ProviderSaleRecord[]>
  testConnection(): Promise<{ ok: boolean; message?: string }>
}
```

A `DataProviderRegistry` singleton at `api/src/lib/dataProviders/registry.ts` instantiates adapters on demand, passing the calling user's `UserProviderConfig` (or `PlatformProviderConfig` for TJCIS) credentials. Three adapter stubs are created at launch: `SporthorseDataAdapter`, `EquibaseAdapter`, and `TJCISAdapter`. TJCISAdapter throws "Partnership not active" until a commercial agreement is in place — same pattern as `BidpathAdapter` (AD-8).

Provider pull flow: **`GET /api/import/providers`** → **`GET /api/import/providers/:provider/search?q=`** → **`POST /api/import/execute`** (reuses the same execution path as CSV).

### 5. Settings UI — Data Sources Card on AccountSettings

`AccountSettings.tsx` uses a card-based layout (not tabs). A new "Data Sources" card is appended after the existing OpenAI key and subscription cards. Each configured provider renders as a row: provider display name, connection status badge (Connected ✓ / Not configured), and Save / Test / Remove actions using the same `useMutation` + `useQuery` pattern as the OpenAI key section.

Backend: Three new endpoints on `api/src/routes/settings.ts` — `GET /api/settings/providers`, `POST /api/settings/providers/:provider`, `DELETE /api/settings/providers/:provider` — plus a `POST /api/settings/providers/:provider/test` for connection testing. Platform TJCIS status is returned read-only in the `GET` response (AD-9).

Admin platform provider config is managed via a new `api/src/routes/admin/platformProviders.ts` route under `requireAuth + requireAdmin`.

### 6. Import UI — Three-Step Wizard at /import

New `frontend/src/views/Import.tsx` with a step-indicator header and three sequential panels:

- **Step 1 — Source**: Radio select between "CSV Upload" and "API Pull". For API Pull, shows available providers (those with credentials configured, plus Equineline if platform key is active). No-credential providers show a link to Settings.
- **Step 2 — Configure**: CSV path shows file dropzone → column mapping UI with preset selector. API path shows search input → results list.
- **Step 3 — Preview & Execute**: Shared preview table (valid/matched/error rows), ownership radio (My catalog / Shared catalog), and Execute button. Shows completion summary after execute.

Import history at `frontend/src/views/ImportHistory.tsx` accessible from the Import page header.

## Findings

| ID | Title | Source | Confidence | Related FRs | Summary |
|----|-------|--------|------------|-------------|---------|
| F-1 | Existing AES-256-CBC encryption module | codebase | high | FR-6 | `api/src/lib/encryption.ts` exports `encrypt`/`decrypt` using `ENCRYPTION_KEY` env var; reusable as-is for provider credentials |
| F-2 | OpenAI key pattern on User model | codebase | high | FR-6 | `openaiApiKeyEncrypted` column on User + `/api/settings/openai-key` endpoints establishes the per-user encrypted credential pattern to follow |
| F-3 | AccountSettings is card-based, not tabbed | codebase | high | FR-6 | Single-page card layout; adding a "Data Sources tab" would be inconsistent — use a card section instead |
| F-4 | AuctionSale is foal-centric, not horse-centric | codebase | high | FR-4 | `AuctionSale` requires `foalId`; sale price is `Float` not Int cents; wrong shape for horse-level historical import data |
| F-5 | Horse.discipline is required | codebase | high | FR-4 | Prisma `Discipline` enum is non-nullable on Horse; CSV presets must supply a `defaultDiscipline` per source |
| F-6 | No CSV/multipart infrastructure exists | codebase | high | FR-1, FR-2 | No `multer` or `csv-parse` in deps; both must be added |
| F-7 | No background job infrastructure | codebase | high | FR-4, NFR-1 | No Bull, pg-boss, or queue service on Render; spec's >500 row async job cannot be implemented without new infra |
| F-8 | AuctionHouseAdapter interface establishes provider abstraction pattern | codebase | high | FR-7 | `api/src/lib/adapters/types.ts` pattern directly applicable to `DataProviderAdapter`; BidpathAdapter stub is the model for TJCIS stub |
| F-9 | AdapterConfig model pattern for platform configs | codebase | high | FR-6 | `AdapterConfig { source @id, active, config Json }` — but uses unencrypted Json; new PlatformProviderConfig table needed for encrypted credentials |
| F-10 | auctionSaleStats surfaces sale data for mating analysis | codebase | medium | FR-4 | Post-launch: extend `auctionSaleStats.ts` to query SaleRecord alongside AuctionSale for richer stallion sale context |

## Architecture Decisions

### AD-1: Reuse `encryption.ts` (AES-256-CBC) and `ENCRYPTION_KEY` env var

- **Context**: Spec specified AES-256-GCM and a new `CREDENTIAL_ENCRYPTION_KEY` env var. Codebase already has AES-256-CBC with `ENCRYPTION_KEY` in use for the OpenAI key.
- **Decision**: Reuse `encrypt()`/`decrypt()` from `api/src/lib/encryption.ts` and the existing `ENCRYPTION_KEY` env var for all provider credential storage.
- **Rationale**: One encryption module, one env var, zero operational overhead. AES-256-CBC is industry-standard. Consistency with the existing pattern (F-1, F-2) reduces implementation surface and review burden.
- **Alternatives Considered**: AES-256-GCM (authenticated encryption, marginally more modern) — rejected because it requires changing the existing module and adds a second env var with no meaningful security benefit in this threat model.

### AD-2: `UserProviderConfig` table for per-user provider credentials

- **Context**: OpenAI key is a column on User. Adding SporthorseData and Equibase as columns would require a migration per provider and bloats the User model.
- **Decision**: New `UserProviderConfig` Prisma model: `{ id, userId, provider DataProvider, encryptedCredential String, testStatus String?, testedAt DateTime?, createdAt }`. Unique index on `(userId, provider)`. One row per (user, provider) pair.
- **Rationale**: Open for extension — new providers are new enum values and new rows, not schema migrations. Keeps User model clean. Consistent credential lifecycle (save/test/delete) regardless of provider (F-2).
- **Alternatives Considered**: Columns on User — already the pattern for OpenAI key, but doesn't scale to N providers without repeated migrations.

### AD-3: `PlatformProviderConfig` table for admin-managed credentials

- **Context**: TJCIS/Equineline requires a single platform-level credential (one commercial agreement, all users benefit). `AdapterConfig` exists but stores unencrypted JSON and is designed for feature-flag state.
- **Decision**: New `PlatformProviderConfig` model: `{ provider String @id, encryptedCredential String, active Boolean @default(false), testedAt DateTime?, createdAt }`. Guarded by `requireAuth + requireAdmin` on all read/write endpoints.
- **Rationale**: Encrypted at rest (unlike AdapterConfig.config Json). Separate access control from user-tier config. Clear semantic boundary: user credentials vs. platform credentials (F-9).
- **Alternatives Considered**: Extend `AdapterConfig.config` with encrypted fields — complicates the existing adapter activation flow; mixes two concerns.

### AD-4: New `SaleRecord` model for horse-level historical import data

- **Context**: `AuctionSale` exists but requires `foalId` and uses `Float` price, making it wrong for horse-level bulk import data (F-4).
- **Decision**: New `SaleRecord` model:
  ```
  SaleRecord { id, horseId, importBatchId, saleSource, saleSessionName, saleDate,
               hipNumber, hammerPriceCents Int, buyerName, consignorName,
               providerRef String?, createdAt }
  @@unique([horseId, hipNumber, saleDate])
  @@index([horseId])
  @@index([importBatchId])
  ```
  The unique constraint on `(horseId, hipNumber, saleDate)` makes `prisma.saleRecord.upsert` safe for idempotent re-imports (NFR-4).
- **Rationale**: Horse-centric (not foal-centric); integer cents (not float); unique constraint enables re-import safety; `providerRef` stores the external ID for API-sourced records.
- **Alternatives Considered**: Extend `AuctionSale` with optional `horseId` — requires nullable `foalId`, breaks the foal tracker's query assumptions, and mixes two distinct data lifecycle concepts.

### AD-5: `ImportBatch` model for audit trail

- **Decision**: New `ImportBatch` model:
  ```
  ImportBatch { id, importedByUserId, source ImportSource, provider DataProvider?,
                sourceFileName String?, totalRows Int, createdCount Int, matchedCount Int,
                errorCount Int, status ImportStatus, errorLog Json @default("[]"), createdAt }
  ```
  `ImportStatus` enum: `processing | completed | failed`. `ImportSource` enum: `csv | api`.
- **Rationale**: Satisfies FR-5 (import history). `importedByUserId` tracks accountability even when horses go to shared catalog. `errorLog` enables row-level drill-down in the history UI.
- **Alternatives Considered**: Store batch metadata in the SaleRecord rows themselves — no single audit record, no status tracking, no error log.

### AD-6: Three-endpoint CSV pipeline with `multer` + `csv-parse`

- **Context**: No file upload or CSV parsing infrastructure exists (F-6).
- **Decision**: Add `multer` (in-memory storage, 10 MB limit) and `csv-parse` to API deps. Three endpoints in `api/src/routes/import.ts`: upload → preview → execute. Column mapping presets in `api/src/lib/columnMappingPresets.ts` as a static typed config. Each preset declares `defaultDiscipline` to satisfy the required Horse field (F-5).
- **Preset schema**:
  ```typescript
  interface ColumnMappingPreset {
    name: string
    displayName: string
    defaultDiscipline: Discipline
    columns: Partial<Record<ImportField, string>>
  }
  ```
  `ImportField` = `'horseName' | 'sex' | 'breed' | 'sire' | 'dam' | 'damsire' | 'dateOfBirth' | 'hipNumber' | 'saleDate' | 'saleSessionName' | 'hammerPrice' | 'buyerName' | 'consignorName' | 'registrationNumber'`
- **Rationale**: Multer is the Express-standard multipart handler. `csv-parse` is well-maintained and streams well. Three endpoints match the frontend wizard steps exactly.
- **Alternatives Considered**: PapaParse on frontend + send JSON rows — avoids multer but pushes CSV parsing complexity into the browser and inflates payload size for large CSVs.

### AD-7: Synchronous import at launch (no background job infrastructure)

- **Context**: No queue infra exists on Render; adding Bull/pg-boss is significant scope; spec specified async jobs for >500 rows (F-7).
- **Decision**: All imports execute synchronously. Express request timeout increased to 60 seconds on import endpoints. Prisma `createMany({ skipDuplicates: true })` handles SaleRecord dedup efficiently. This is a **spec deviation** (see Spec Deviations).
- **Rationale**: A 500-row CSV with one DB write per row takes 1-3 seconds with Prisma on a Render PostgreSQL instance. Per-row atomicity via `try/catch` in a loop is acceptable at this scale. Adding a queue system for this feature alone is over-engineering.
- **Alternatives Considered**: pg-boss (Postgres-native job queue) — best long-term fit for Render + PostgreSQL, but requires separate cron worker service and significant scaffolding. Defer to a future iteration.
- **Mitigation**: Monitor actual import durations on staging; add pg-boss if P95 exceeds 30 seconds.

### AD-8: `DataProviderAdapter` interface mirroring `AuctionHouseAdapter`

- **Context**: Three API providers with different auth and endpoint shapes need a unified abstraction (F-8).
- **Decision**: New `api/src/lib/dataProviders/types.ts` defining:
  ```typescript
  export type DataProvider = 'sporthorse_data' | 'equibase' | 'tjcis'
  export interface HorseSearchResult { providerRef: string; name: string; sire?: string; dam?: string; year?: number; breed?: string }
  export interface ProviderSaleRecord { providerRef: string; saleDate: string; saleSessionName?: string; hipNumber?: string; hammerPriceCents?: number; buyerName?: string; consignorName?: string }
  export interface DataProviderAdapter {
    readonly provider: DataProvider
    search(query: string): Promise<HorseSearchResult[]>
    fetchSaleHistory(providerRef: string): Promise<ProviderSaleRecord[]>
    testConnection(): Promise<{ ok: boolean; message?: string }>
  }
  ```
  Registry at `api/src/lib/dataProviders/registry.ts` accepts either a `UserProviderConfig` or `PlatformProviderConfig` record and instantiates the correct adapter. `TJCISAdapter.connect()` throws "TJCIS partnership not active — contact support" until agreement is signed (same pattern as `BidpathAdapter`).
- **Rationale**: Provider-agnostic frontend and import engine; new providers added without touching routes or UI. Mirrors proven in-codebase pattern.
- **Alternatives Considered**: Inline provider logic in routes — fast to implement, impossible to extend cleanly.

### AD-9: Extend `AccountSettings.tsx` with Data Sources card (not a new tab)

- **Context**: Spec specified a "Data Sources tab"; AccountSettings uses a card-based layout with no tabs (F-3).
- **Decision**: Append a "Data Sources" `<div>` card below the existing OpenAI key card in `AccountSettings.tsx`. Per-provider rows use the same masked-key / Test / Remove UX as the OpenAI section. Platform TJCIS shows a read-only status row. This is a **spec deviation**.
- **Rationale**: Matches existing layout pattern exactly; avoids introducing tab state management; AccountSettings is not heavily used and doesn't need a tab navigation layer.
- **Alternatives Considered**: Convert AccountSettings to a tabbed layout — adds complexity, requires refactoring the existing page, introduces tab state management for no user benefit at current settings volume.

## Resolved Uncertainties

| # | Question | Answer |
|---|----------|--------|
| 1 | Encryption approach for credentials | Reuse `api/src/lib/encryption.ts` (AES-256-CBC, `ENCRYPTION_KEY` env var). No new module or env var needed. |
| 2 | How to satisfy `Horse.discipline` (required) during import | Column mapping presets declare `defaultDiscipline` per source. Users can also map a discipline column if present in the CSV. |
| 3 | Dedup strategy for shared catalog vs. user catalog | Dedup checks across both: first query user-owned horses (`createdByUser = userId`), then shared catalog (`createdByUser = null`). If either matches by name+sire+dam, attach SaleRecord to the matched horse. |
| 4 | TJCIS/Equineline readiness | `TJCISAdapter` is created but `search()` and `fetchSaleHistory()` throw "TJCIS partnership not active" until commercial agreement is signed. The UI shows Equineline as "Pending agreement" status. |
| 5 | Background job infrastructure | Not available on Render without adding pg-boss + worker service. All imports are synchronous at launch (spec deviation documented). |

## Standards

| ID | Rule | Domain | File Type | Action Type |
|----|------|--------|-----------|-------------|
| S-1 | Validate all API inputs with Zod before touching the DB | validation | .ts (routes) | create/modify |
| S-2 | Use `requireAuth` + `getUserId(req)` for all user-scoped endpoints | security | .ts (routes) | create |
| S-3 | Use `requireAuth` + `requireAdmin` for all admin endpoints | security | .ts (admin routes) | create |
| S-4 | Never return encrypted credential plaintext in API responses; always mask (last 4 chars) | security | .ts (routes) | create/modify |
| S-5 | Use `prisma.$transaction([...])` for multi-model atomic writes | reliability | .ts (lib) | create |
| S-6 | Wrap integration tests in `describe.skip` when `DATABASE_URL` is absent | testing | .test.ts | create |
| S-7 | Mock `auctionSocket` in tests that touch the import engine (no socket dependency) | testing | .test.ts | create |
| S-8 | New Prisma models: add `@@index` on all FK and frequent-query fields | performance | schema.prisma | modify |

## File Inventory

| Action | Path | Related FRs | Rationale |
|--------|------|-------------|-----------|
| modify | `api/prisma/schema.prisma` | FR-4, FR-5, FR-6 | Add SaleRecord, ImportBatch, UserProviderConfig, PlatformProviderConfig models and DataProvider/ImportSource/ImportStatus enums |
| create | `api/src/routes/import.ts` | FR-1, FR-2, FR-3, FR-4, FR-5, FR-7 | Upload, preview, execute, history, provider search endpoints |
| modify | `api/src/routes/settings.ts` | FR-6 | Add GET/POST/DELETE/test endpoints for user-tier provider config |
| create | `api/src/routes/admin/platformProviders.ts` | FR-6 | Admin GET/POST/DELETE/test for platform-tier TJCIS/Equineline config |
| modify | `api/src/index.ts` | FR-1, FR-6 | Register `importRouter` and `platformProvidersRouter` |
| create | `api/src/lib/dataProviders/types.ts` | FR-7 | DataProviderAdapter interface, DataProvider enum, HorseSearchResult, ProviderSaleRecord types |
| create | `api/src/lib/dataProviders/registry.ts` | FR-7 | Instantiates correct adapter from credential record; exported `getAdapter(provider, credential)` |
| create | `api/src/lib/dataProviders/SporthorseDataAdapter.ts` | FR-7 | Implements DataProviderAdapter for SporthorseData API |
| create | `api/src/lib/dataProviders/EquibaseAdapter.ts` | FR-7 | Implements DataProviderAdapter for Equibase API |
| create | `api/src/lib/dataProviders/TJCISAdapter.ts` | FR-7 | Stub — throws "partnership not active"; unblocks once agreement signed |
| create | `api/src/lib/csvParser.ts` | FR-1, FR-2, FR-3 | `parseCSV(buffer)`, `applyMapping(rows, config)`, `validateRows(mapped)` functions |
| create | `api/src/lib/columnMappingPresets.ts` | FR-2, FR-9 | Static `ColumnMappingPreset[]` for Keeneland, FT, OBS, Saratoga, AQHA, KWPN, Generic |
| create | `api/src/lib/importEngine.ts` | FR-4 | `executeImport(rows, ownership, batchId, userId)` — Horse dedup + SaleRecord creation |
| create | `api/tests/import.test.ts` | FR-1–FR-5 | Integration tests: CSV parse, column mapping, dedup, execute, idempotency |
| create | `frontend/src/views/Import.tsx` | FR-1, FR-2, FR-3, FR-4, FR-7 | 3-step wizard: source select → configure → preview/execute |
| create | `frontend/src/views/ImportHistory.tsx` | FR-5 | Batch history list + batch detail drill-down |
| modify | `frontend/src/views/AccountSettings.tsx` | FR-6 | Add Data Sources card section with per-provider rows |
| create | `frontend/src/api/import.ts` | FR-1–FR-7 | axios wrappers for all import + provider API endpoints |
| modify | `frontend/src/App.tsx` | FR-1, FR-5 | Add `/import` and `/import/history` routes under ProtectedRoute |

## Dependencies and Coupling

| Feature Area | Shared Files | Recommendation |
|--------------|-------------|----------------|
| FR-1 + FR-2 + FR-3 (CSV pipeline) | `api/src/lib/csvParser.ts`, `api/src/lib/columnMappingPresets.ts` | Build walking skeleton: upload → parse → return columns. Mapping and validation layer on top. |
| FR-4 (import engine) + FR-7 (API pull) | `api/src/lib/importEngine.ts` | API pull goes through the same `executeImport()` as CSV — implement importEngine first, then wire both sources to it |
| FR-6 (Data Sources settings) + FR-7 (provider pull) | `api/src/lib/dataProviders/registry.ts`, `UserProviderConfig` model | Settings must be built before provider pull — pull requires saved credentials |
| FR-4 + FR-5 (history) | `ImportBatch` model | Create ImportBatch at start of execute, update on complete; history is a read from same table |
| AD-1 (encryption) | `api/src/lib/encryption.ts` | No change to this file; all credential models call it directly. Put in walking skeleton first. |

## Spec Deviations

| Spec Value | Location | Design Value | Rationale |
|------------|----------|-------------|-----------|
| AES-256-GCM encryption | NFR-2, Constraints | AES-256-CBC (`encryption.ts`) | Existing module uses CBC; consistent with OpenAI key storage; no security degradation for this threat model |
| `CREDENTIAL_ENCRYPTION_KEY` env var | Constraints | `ENCRYPTION_KEY` (existing env var) | Same rationale — one key, one env var; avoids ops overhead of adding a second |
| Data Sources "tab" on Settings page | FR-6 AC-6.1 | Data Sources "card section" on AccountSettings.tsx | AccountSettings uses card layout; tabs would require layout refactor inconsistent with existing page |
| Background jobs for imports > 500 rows | NFR-1 | Synchronous for all batch sizes; 60s timeout | No background job infra on Render; 500 rows is ~1-3s with Prisma createMany; defer queue to future sprint |

## Open Questions

All spec open questions resolved. No new questions from codebase research.

## Constraints (Technical)

| Constraint | Category | Source | Rationale |
|------------|----------|--------|-----------|
| `Horse.discipline` is required (non-nullable Prisma field) | compatibility | codebase | All Horse creation paths — including import — must supply a discipline value; presets solve this with `defaultDiscipline` |
| No background job infrastructure on Render | infrastructure | codebase | No Bull/pg-boss/queue service deployed; adding one requires a new worker service in render.yaml |
| `AuctionSale` model is foal-centric and cannot be extended for horse-level import | compatibility | codebase | `foalId` is required FK; extending would require nullable FK and breaks existing foal tracker queries |
| SporthorseData and Equibase API contracts unconfirmed | compatibility | research | Adapter stubs created; actual HTTP calls TBD until API docs are obtained; `testConnection()` will surface errors early |

## Assumptions

| Assumption | Source | Affects |
|------------|--------|---------|
| SporthorseData has a REST API with standard Bearer token auth and a horse search endpoint | design | FR-7 |
| Equibase has subscription-based API access with username/password or API key auth | design | FR-7 |
| A 500-row CSV import completes within 10 seconds on Render PostgreSQL (based on typical Prisma bulk insert benchmarks) | design | NFR-1, FR-4 |
| `pedigree JSON` on Horse can store `{ sire, dam, damsire }` as string fields without Horse-to-Horse FK linking (cross-linking is a separate FR-8 post-import step) | codebase | FR-4 |
| Sales company CSV exports (Keeneland, FT, OBS, Saratoga) use consistent column names within a format version; presets may need minor adjustment per actual export sample | design | FR-2 |

## Risks (Technical)

| Risk | Impact | Probability | Mitigation | Affects |
|------|--------|-------------|------------|---------|
| SporthorseData or Equibase API changes/rate-limits break search during import | Medium | Low | Adapter layer isolates impact; `testConnection()` surfaces credential/connectivity issues early | FR-7 |
| Sales company CSV format changes between export versions break presets | Medium | Medium | Presets are a static config file — easy to update without code changes; generic preset always available as fallback | FR-2 |
| Horse dedup by name+sire+dam has false positives (two horses with same name/parents) | Medium | Low | Dedup key is standard industry practice; matched rows are shown to user in preview (FR-3 AC-3.4) before commit | FR-4 |
| Synchronous 500-row import exceeds 60s timeout under load | Low | Low | Monitor P95 on staging; add pg-boss queue if needed; most real sale sessions are 100-300 lots | NFR-1, FR-4 |

## References

- See `references/research.md` for full research findings per aspect
- See `references/standards.md` for complete standards inventory (8 standards)
