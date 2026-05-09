---
slug: auction-sale-data-import
status: final
strategy: walking-skeleton
spec_source: spec-driven/auction-sale-data-import/spec.md
design_source: spec-driven/auction-sale-data-import/design.md
design_hash: 916e0df1cd36e6a7a56c4a76bbecd6430594f6a338abcecddab3c3814db47771
created_date: 2026-05-08T00:00:00Z
total_steps: 24
---

# Tasks: auction-sale-data-import

## Summary

- **Strategy**: Walking Skeleton — schema → CSV pipeline → import engine → provider settings → API pull → frontend
- **Slices**: 10 (5 skeleton → 2 depth → 2 integration → 1 nice-to-have)
- **Total STEPs**: 24 (19 implementation + 5 test-after pairs)
- **Test approach**: test-after (vitest unit + vitest+supertest integration)
- **Bundles**: 10 (sequential — dependency chain prevents parallelism)
- **Must-Have coverage**: FR-1 ✓, FR-2 ✓, FR-3 ✓, FR-4 ✓, FR-5 ✓, FR-6 ✓
- **Should-Have coverage**: FR-7 ✓, FR-8 ✓
- **Nice-to-Have coverage**: FR-9 ✓

---

## Slice 1 — Foundation (skeleton)

**Goal**: Schema migration compiles; multer + csv-parse wired; routes registered.
All depth slices depend on the four new Prisma models being present.

---

### STEP-1: Extend Prisma schema — 4 models + 3 enums

**Trace**: [FR-4 → AC-4.2, AC-4.3] [FR-5 → AC-5.1] [FR-6 → AC-6.2, AC-6.5] [NFR-4]
**Informed by**: AD-2, AD-3, AD-4, AD-5, S-8

| Action | File | Repo |
|--------|------|------|
| modify | `api/prisma/schema.prisma` | equine-iq |

**Effort**: M

**Intent**: The `@@unique([horseId, hipNumber, saleDate])` on SaleRecord is the idempotency guarantee — without it, re-importing the same CSV silently duplicates records (NFR-4). All four models must land in one migration to satisfy FK relationships (SaleRecord → Horse, SaleRecord → ImportBatch). The `DataProvider` enum must be declared before UserProviderConfig and PlatformProviderConfig reference it.

**Implementation guidance**:
- Add `DataProvider` enum: `sporthorse_data | equibase | tjcis`
- Add `ImportSource` enum: `csv | api`
- Add `ImportStatus` enum: `processing | completed | failed`
- Add all four models per AD-4 (SaleRecord), AD-5 (ImportBatch), AD-2 (UserProviderConfig), AD-3 (PlatformProviderConfig)
- On SaleRecord: `@@unique([horseId, hipNumber, saleDate])` + `@@index([horseId])` + `@@index([importBatchId])`
- On UserProviderConfig: `@@unique([userId, provider])` + `@@index([userId])`
- On ImportBatch: `@@index([importedByUserId])`

**Pattern reference**: Existing `AuctionSale`, `AdapterConfig` models in `api/prisma/schema.prisma`

**Verify**:
- Level: inspection | Given: schema.prisma is modified | Action: Run `npx prisma validate` | Outcome: exits 0 with no errors
- Level: inspection | Given: schema.prisma is modified | Action: Run `npx prisma migrate dev --name add-sale-import-models` | Outcome: migration file generated; Prisma client regenerated with new model types

> **Standards**: S-8 — `@@index` on all FK columns (horseId, importBatchId, userId, importedByUserId) and frequent-query fields

**Depends on**: —
**Enables**: STEP-2, STEP-6, STEP-8, STEP-12
**Parallel with**: —

---

### STEP-2: Install multer + csv-parse; register routes in api/src/index.ts

**Trace**: MANUAL → package dependencies and route wiring for FR-1–FR-7
**Informed by**: AD-6, AD-7

| Action | File | Repo |
|--------|------|------|
| modify | `api/package.json` | equine-iq |
| modify | `api/src/index.ts` | equine-iq |

**Effort**: XS

**Intent**: Structural wiring step. multer must use `memoryStorage()` — Render's ephemeral filesystem means disk-based temp files would not survive a restart. The execute endpoint needs a custom 60-second timeout via a route-level `req.setTimeout(60000)` call to satisfy AD-7's synchronous-at-launch decision.

**Implementation guidance**:
- Install: `npm install multer csv-parse` and `npm install -D @types/multer` in `api/`
- In `index.ts`: `import importRouter from './routes/import'` and mount at `/api/import`
- In `index.ts`: `import platformProvidersRouter from './routes/admin/platformProviders'` and mount at `/api/admin/platform-providers`
- multer configuration: `multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })`

**Pattern reference**: `api/src/index.ts` (existing router registrations for `/api/horses`, `/api/admin/adapters`)

**Verify**:
- Level: inspection | Given: changes applied | Action: Run `npm run build` in api/ | Outcome: TypeScript compiles with 0 errors

**Depends on**: —
**Enables**: STEP-3, STEP-4, STEP-5
**Parallel with**: —

---

## Slice 2 — CSV Parsing Utilities (skeleton)

**Goal**: parseCSV, applyMapping, validateRows functions unit-tested and ready for route consumption.

---

### STEP-3: Column mapping presets configuration

**Trace**: [FR-2 → AC-2.1, AC-2.2]
**Informed by**: AD-6, F-5

| Action | File | Repo |
|--------|------|------|
| create | `api/src/lib/columnMappingPresets.ts` | equine-iq |

**Effort**: S

**Intent**: The `defaultDiscipline` field on each preset is what satisfies `Horse.discipline` non-nullable during import — without it, a Keeneland CSV import would fail with a Prisma validation error. Generic preset uses `other`, which users can override by mapping a discipline column. Discipline mapping: Keeneland/FT/OBS/Saratoga → `thoroughbred_racing`, AQHA → `quarter_horse`, KWPN → `warmblood`, Generic → `other`.

**Implementation guidance**:
- Export `ColumnMappingPreset` interface and `ImportField` union type per AD-6 schema
- Export `PRESETS: Record<string, ColumnMappingPreset>` with keys: `keeneland | fasig_tipton | obs | saratoga | generic`
- Column name mappings should match known current export formats (approximate — comment that field names may need adjustment per actual export sample)
- Export `getPreset(name: string): ColumnMappingPreset | null`

**Pattern reference**: N/A — new pattern

**Verify**:
- Level: inspection | Given: file is created | Action: Review exported types and PRESETS object | Outcome: All 5 presets present; each has `defaultDiscipline`; Generic has `other`

**Depends on**: STEP-1 (Discipline enum from Prisma client)
**Enables**: STEP-4, STEP-14
**Parallel with**: —

---

### STEP-4: CSV parser utilities (parseCSV, applyMapping, validateRows)

**Trace**: [FR-1 → AC-1.1, AC-1.2, AC-1.3, AC-1.4] [FR-3 → AC-3.1, AC-3.2, AC-3.4]
**Informed by**: AD-6, F-5

| Action | File | Repo |
|--------|------|------|
| create | `api/src/lib/csvParser.ts` | equine-iq |

**Effort**: M

**Intent**: `validateRows` does in-memory validation only — DB dedup (name+sire+dam lookup) happens in the import engine, not here. The `hammerPrice` column must be normalized to integer cents to match `SaleRecord.hammerPriceCents: Int` — a value of `"5,000.00"` must become `500000`. Missing horseName is the only hard-block; missing sire/dam reduces dedup accuracy but should not block import.

**Implementation guidance**:
- `parseCSV(buffer: Buffer): { headers: string[], rows: Record<string, string>[] }` — uses csv-parse sync parse
- `applyMapping(rows, config: ColumnMappingConfig): MappedRow[]` — maps CSV column names to ImportField keys; unmapped columns become `ignored`
- `validateRows(rows: MappedRow[]): ValidatedRow[]` — each row gets `status: 'valid' | 'error'`, `errors: string[]`; validates: horseName required, date format (ISO or MM/DD/YYYY), price parseable as number
- `normalizePrice(raw: string): number` — strips commas/currency symbols, parses float, returns Math.round(parsed * 100) cents
- Export `ColumnMappingConfig` and `MappedRow` types

> **Standards**: S-1 — input validation for all mapped row fields before they reach the DB

**Pattern reference**: N/A — new pattern

**Verify**:
- Level: unit | Given: Buffer of valid CSV | Action: parseCSV(buffer) | Outcome: returns correct headers and row count
- Level: unit | Given: MappedRow with missing horseName | Action: validateRows([row]) | Outcome: row status is 'error', errors includes 'Missing: Horse Name'
- Level: unit | Given: price string "5,000.00" | Action: normalizePrice("5,000.00") | Outcome: returns 500000
- Level: unit | Given: row with date "03/15/2024" | Action: validateRows([row]) | Outcome: row is valid; date normalized to ISO

**Depends on**: STEP-2 (csv-parse package available)
**Enables**: STEP-5
**Parallel with**: STEP-3

---

### STEP-T4: Unit tests for CSV parser utilities

**Trace**: MANUAL → Test for STEP-4

| Action | File | Repo |
|--------|------|------|
| create | `api/tests/csvParser.test.ts` | equine-iq |

**Effort**: S

**Intent**: N/A — structural test step

**Implementation guidance**:
- Test `parseCSV` with valid CSV, empty-body CSV, non-CSV buffer
- Test `applyMapping` with Keeneland preset applied to matching headers
- Test `validateRows` with missing horseName, invalid date, invalid price
- Test `normalizePrice` with comma-formatted price, dollar-sign, already-integer string

> **Standards**: S-6 — no DATABASE_URL dependency; these are pure unit tests, no describe.skip needed

**Verify**:
- Level: unit | Given: test file exists | Action: Run `npm test -- csvParser.test` in api/ | Outcome: all tests pass

**Depends on**: STEP-4
**Enables**: STEP-5
**Parallel with**: —

---

## Slice 3 — Upload & Preview Endpoints (skeleton)

**Goal**: CSV upload and preview endpoints return column headers, row previews, and dedup status without writing to the DB.

---

### STEP-5: CSV upload and preview endpoints

**Trace**: [FR-1 → AC-1.1, AC-1.2, AC-1.3, AC-1.4] [FR-2 → AC-2.1, AC-2.3, AC-2.4] [FR-3 → AC-3.1, AC-3.2, AC-3.4]
**Informed by**: AD-6

| Action | File | Repo |
|--------|------|------|
| create | `api/src/routes/import.ts` | equine-iq |

**Effort**: M

**Intent**: The upload endpoint returns headers + first 10 rows only — no DB write at this stage (the preview must be stateless; orphaned upload state is a session leak risk). The preview endpoint applies mapping and validates rows; dedup check queries Horse by name+sire+dam across both user-owned (`createdByUser = userId`) and shared catalog (`createdByUser = null`) — a match in either set counts as "matched" and should be shown to the user before they commit.

**Implementation guidance**:
- `POST /api/import/upload` — multer single('file') middleware; validate MIME type and extension; call parseCSV; return `{ headers, preview: rows.slice(0,10), totalRows }`
- `POST /api/import/preview` — Zod schema for `{ mappingConfig, rows }`; call applyMapping then validateRows; for each valid row, query `prisma.horse.findFirst({ where: { name, AND: [pedigree contains sire/dam] } })` — flag matched rows
- Return `{ validCount, errorCount, matchedCount, rows: ValidatedRow[] }`
- Zod reject non-CSV MIME type or extension with 400
- Zod reject empty rows (length === 0) with 400

> **Standards**: S-1 — Zod validation on upload (mimetype check) and preview request body; S-2 — requireAuth + getUserId on both endpoints

**Pattern reference**: `api/src/routes/horses.ts` (route structure + Zod pattern)

**Verify**:
- Level: integration | Given: valid 10-row CSV | Action: POST /api/import/upload | Outcome: returns 200 with headers array and 10 preview rows
- Level: integration | Given: file > 10MB | Action: POST /api/import/upload | Outcome: returns 400 "File exceeds 10 MB limit"
- Level: integration | Given: non-CSV file | Action: POST /api/import/upload | Outcome: returns 400 "Only CSV files are accepted"
- Level: integration | Given: mappingConfig with horseName column mapped | Action: POST /api/import/preview | Outcome: returns rows with valid/error/matched status

**Depends on**: STEP-4
**Enables**: STEP-6, STEP-7
**Parallel with**: —

---

### STEP-T5: Integration tests for upload and preview endpoints

**Trace**: MANUAL → Test for STEP-5

| Action | File | Repo |
|--------|------|------|
| create | `api/tests/import.upload.test.ts` | equine-iq |

**Effort**: M

**Intent**: N/A — structural test step

**Implementation guidance**:
- Wrap in `describe.skip` when `!process.env.DATABASE_URL` (S-6)
- Mock `auctionSocket` (S-7): `vi.mock('../src/lib/auctionSocket', ...)`
- Test: valid CSV → 200 with correct structure; >10MB → 400; empty body → 400; non-CSV MIME → 400
- Test: preview with no horseName mapping → validation error per row; preview with dedup match → row status 'matched'
- Use a test fixture CSV string (inline, not file read)

> **Standards**: S-6 — describe.skip when DATABASE_URL absent; S-7 — mock auctionSocket

**Verify**:
- Level: integration | Given: DATABASE_URL set | Action: npm test -- import.upload.test | Outcome: all tests pass

**Depends on**: STEP-5
**Enables**: STEP-6
**Parallel with**: —

---

## Slice 4 — Import Engine (skeleton)

**Goal**: Horse dedup + SaleRecord creation logic tested; partial failure isolation confirmed.

---

### STEP-6: Import engine (Horse dedup, Horse creation, SaleRecord creation)

**Trace**: [FR-4 → AC-4.1, AC-4.2, AC-4.3, AC-4.4, AC-4.5, AC-4.6, AC-4.7] [NFR-4]
**Informed by**: AD-4, AD-5, AD-7

| Action | File | Repo |
|--------|------|------|
| create | `api/src/lib/importEngine.ts` | equine-iq |

**Effort**: L

**Intent**: Partial failure isolation (AC-4.7) requires per-row try/catch rather than a single outer transaction — a Prisma transaction wrapping all rows would roll back everything on one row failure. Individual row atomicity (Horse + SaleRecord for one row) still uses `prisma.$transaction` to keep the pair consistent. The dedup query checks user-owned horses first (`createdByUser = userId`), then shared catalog (`createdByUser = null`); the first match found is used. SaleRecord upsert on `(horseId, hipNumber, saleDate)` unique index — `prisma.saleRecord.upsert` with the unique constraint makes re-importing the same batch safe (NFR-4).

**Implementation guidance**:
- Export `executeImport(rows: ValidatedRow[], ownership: 'personal' | 'shared', batchId: string, userId: string): Promise<ImportResult>`
- Per-row: find Horse by `{ name, pedigree: { path: ['sire'], equals: sire } }` or similar JSON query; on match use existing horseId; on no match create Horse with discipline from preset's defaultDiscipline
- `createdByUser`: `ownership === 'shared' ? null : userId`
- Per-row SaleRecord: `prisma.saleRecord.upsert({ where: { horseId_hipNumber_saleDate: { ... } }, update: {}, create: { ... } })`
- Per-row try/catch: catch stores error in batch errorLog; does not rethrow
- Return `{ createdCount, matchedCount, errorCount, errorLog: [{rowIndex, error}] }`

> **Standards**: S-5 — `prisma.$transaction([horseCreate, saleRecordUpsert])` per row for individual row atomicity

**Pattern reference**: `api/src/lib/auctionLifecycle.ts` (multi-step Prisma write patterns)

**Verify**:
- Level: integration | Given: 3 valid rows with no existing horses | Action: executeImport(rows, 'personal', batchId, userId) | Outcome: 3 horses created, 3 sale records created, createdCount=3
- Level: integration | Given: row whose name+sire+dam matches existing horse | Action: executeImport | Outcome: no new Horse created; SaleRecord attached to existing horse; matchedCount=1
- Level: integration | Given: same batch run twice | Action: executeImport twice | Outcome: second run: createdCount=0, matchedCount=N (all rows now match)
- Level: integration | Given: one row with missing required field | Action: executeImport | Outcome: that row in errorLog; other rows succeed; errorCount=1

**Depends on**: STEP-1, STEP-3, STEP-5
**Enables**: STEP-7, STEP-18
**Parallel with**: —

---

### STEP-T6: Integration tests for import engine

**Trace**: MANUAL → Test for STEP-6

| Action | File | Repo |
|--------|------|------|
| create | `api/tests/importEngine.test.ts` | equine-iq |

**Effort**: M

**Intent**: N/A — structural test step

**Implementation guidance**:
- Wrap in `describe.skip` when `!process.env.DATABASE_URL` (S-6)
- Mock `auctionSocket` (S-7)
- Test all 4 verify cases from STEP-6
- Include: shared catalog import sets `createdByUser = null`; personal import sets `createdByUser = userId`
- Include: `@@unique` constraint prevents duplicate SaleRecord on re-import (explicit upsert assertion)

> **Standards**: S-6, S-7

**Verify**:
- Level: integration | Given: DATABASE_URL set | Action: npm test -- importEngine.test | Outcome: all tests pass

**Depends on**: STEP-6
**Enables**: STEP-7
**Parallel with**: —

---

## Slice 5 — Execute & History Endpoints (skeleton)

**Goal**: Full import lifecycle callable via API; ImportBatch audit trail persisted; history endpoints return user-scoped results.

---

### STEP-7: Execute endpoint and import history endpoints

**Trace**: [FR-4 → AC-4.1, AC-4.5] [FR-5 → AC-5.1, AC-5.2, AC-5.3]
**Informed by**: AD-5, AD-7

| Action | File | Repo |
|--------|------|------|
| modify | `api/src/routes/import.ts` | equine-iq |

**Effort**: M

**Intent**: The execute endpoint creates an ImportBatch record with `status: 'processing'` before calling executeImport — this ensures a crash mid-batch still leaves an audit record (AC-5.1 depends on ImportBatch existing). Batch is updated to `status: 'completed' | 'failed'` after the import finishes. History endpoints scope to `getUserId(req)` — users must never see each other's batches (NFR-3). The 60s timeout is set in STEP-2; a comment here documents why it exists.

**Implementation guidance**:
- `POST /api/import/execute` — Zod: `{ mappingConfig, rows, ownership: z.enum(['personal', 'shared']) }`; create ImportBatch first; call executeImport; update batch with results; return completed batch record
- `GET /api/import/history` — query `prisma.importBatch.findMany({ where: { importedByUserId: userId } })`
- `GET /api/import/history/:batchId` — verify ownership before returning; return batch + `errorLog` JSON for row-level detail
- Empty history: return `{ batches: [] }` not 404

> **Standards**: S-1 — Zod on execute request; S-2 — requireAuth on all 3 endpoints

**Pattern reference**: `api/src/routes/listings.ts` (batch write + status update pattern)

**Verify**:
- Level: integration | Given: valid mappedRows and ownership | Action: POST /api/import/execute | Outcome: 200 with summary { created, matched, errorCount }; ImportBatch persisted in DB
- Level: integration | Given: user with 2 past batches | Action: GET /api/import/history | Outcome: returns 2 batches for that user only
- Level: integration | Given: batchId owned by different user | Action: GET /api/import/history/:batchId | Outcome: 403 or 404
- Level: integration | Given: no past imports | Action: GET /api/import/history | Outcome: 200 with empty array

**Depends on**: STEP-6
**Enables**: STEP-8 (parallel OK), STEP-13
**Parallel with**: —

---

### STEP-T7: Integration tests for execute and history endpoints

**Trace**: MANUAL → Test for STEP-7

| Action | File | Repo |
|--------|------|------|
| create | `api/tests/import.execute.test.ts` | equine-iq |

**Effort**: M

**Intent**: N/A — structural test step

**Implementation guidance**:
- Wrap in `describe.skip` when `!process.env.DATABASE_URL`; mock auctionSocket
- Test: execute → summary response shape; execute → ImportBatch in DB with correct counts
- Test: history scoped to requesting user; cross-user batch access → 403
- Test: empty history → `{ batches: [] }`
- Test: batch detail includes errorLog array

> **Standards**: S-6, S-7

**Verify**:
- Level: integration | Given: DATABASE_URL set | Action: npm test -- import.execute.test | Outcome: all tests pass

**Depends on**: STEP-7
**Enables**: STEP-8 (can start after STEP-7)
**Parallel with**: —

---

## Slice 6 — Data Sources Settings (depth)

**Goal**: Users can save, mask, test, and delete provider credentials; adapter layer is wired with all three provider stubs.

---

### STEP-8: User provider config settings endpoints

**Trace**: [FR-6 → AC-6.1, AC-6.2, AC-6.3, AC-6.4, AC-6.5, AC-6.6]
**Informed by**: AD-1, AD-2, AD-9

| Action | File | Repo |
|--------|------|------|
| modify | `api/src/routes/settings.ts` | equine-iq |

**Effort**: M

**Intent**: `testStatus` on UserProviderConfig is updated by the test-connection endpoint — the frontend reads this field to display "Connected ✓" vs "Failed: [reason]" without a live API call on every page load. The GET endpoint must also return PlatformProviderConfig `active` status for TJCIS (read-only) so the frontend can render the "Equineline (Platform)" row. Never return `encryptedCredential` — only `'••••••••' + raw.slice(-4)` per the S-4 masking standard.

**Implementation guidance**:
- `GET /api/settings/providers` — return all UserProviderConfig rows for userId (masked) + TJCIS platform status (active boolean only)
- `POST /api/settings/providers/:provider` — Zod: `{ credential: z.string().min(1) }`; encrypt with `encrypt(credential)`; upsert UserProviderConfig; return masked record
- `DELETE /api/settings/providers/:provider` — delete row; 404 if not found for this user
- `POST /api/settings/providers/:provider/test` — decrypt credential; call adapter.testConnection(); update testStatus + testedAt; return `{ ok, message }`
- Validate `:provider` param against DataProvider enum values

> **Standards**: S-1 — Zod on POST body and provider param; S-2 — requireAuth + getUserId; S-4 — never return plaintext credential

**Pattern reference**: `api/src/routes/settings.ts` (existing OpenAI key GET/POST/DELETE pattern)

**Verify**:
- Level: integration | Given: user POSTs credential for sporthorse_data | Action: POST /api/settings/providers/sporthorse_data | Outcome: 200; GET shows masked key `••••••••xxxx`; raw DB value is not plaintext
- Level: integration | Given: saved credential | Action: DELETE /api/settings/providers/sporthorse_data | Outcome: 200; subsequent GET shows no config for provider
- Level: integration | Given: invalid provider name | Action: POST /api/settings/providers/invalid | Outcome: 400

**Depends on**: STEP-1, STEP-7 (DB and test setup context)
**Enables**: STEP-9, STEP-10, STEP-17
**Parallel with**: —

---

### STEP-T8: Integration tests for provider settings endpoints

**Trace**: MANUAL → Test for STEP-8

| Action | File | Repo |
|--------|------|------|
| create | `api/tests/providerSettings.test.ts` | equine-iq |

**Effort**: M

**Intent**: N/A — structural test step

**Implementation guidance**:
- Wrap in `describe.skip` when `!process.env.DATABASE_URL`; mock auctionSocket
- Test: save credential → GET returns masked; verify DB value ≠ plaintext input
- Test: DELETE → GET shows no config
- Test: invalid provider → 400

> **Standards**: S-6, S-7

**Verify**:
- Level: integration | Given: DATABASE_URL set | Action: npm test -- providerSettings.test | Outcome: all tests pass

**Depends on**: STEP-8
**Enables**: STEP-9
**Parallel with**: —

---

### STEP-9: DataProviderAdapter types and registry

**Trace**: [FR-7 → AC-7.8] — Informed by: AD-8

| Action | File | Repo |
|--------|------|------|
| create | `api/src/lib/dataProviders/types.ts` | equine-iq |
| create | `api/src/lib/dataProviders/registry.ts` | equine-iq |

**Effort**: S

**Intent**: N/A — structural step. Routes must not construct adapters directly — `getAdapter(provider, credential)` in the registry is the single instantiation point. This mirrors the existing AuctionHouseAdapter registry pattern exactly (F-8, AD-8).

**Implementation guidance**:
- `types.ts`: export `DataProvider` type, `HorseSearchResult`, `ProviderSaleRecord`, `DataProviderAdapter` interface per AD-8 schema
- `registry.ts`: export `getAdapter(provider: DataProvider, credential: string): DataProviderAdapter` — switch on provider, construct correct adapter; throw for unknown providers
- `getAdapter` accepts the raw decrypted credential string (decryption happens in the calling route before this call)

**Pattern reference**: `api/src/lib/adapters/types.ts`, `api/src/lib/adapters/registry.ts`

**Verify**:
- Level: inspection | Given: files created | Action: TypeScript build in api/ | Outcome: 0 errors; DataProviderAdapter interface is exported

**Depends on**: STEP-8
**Enables**: STEP-10, STEP-11
**Parallel with**: STEP-T8 (can proceed independently)

---

### STEP-10: SporthorseData, Equibase, and TJCIS adapter stubs

**Trace**: [FR-7 → AC-7.1, AC-7.3, AC-7.4, AC-7.5, AC-7.7, AC-7.8]
**Informed by**: AD-8

| Action | File | Repo |
|--------|------|------|
| create | `api/src/lib/dataProviders/SporthorseDataAdapter.ts` | equine-iq |
| create | `api/src/lib/dataProviders/EquibaseAdapter.ts` | equine-iq |
| create | `api/src/lib/dataProviders/TJCISAdapter.ts` | equine-iq |

**Effort**: M

**Intent**: SporthorseDataAdapter and EquibaseAdapter implement real HTTP calls assuming standard Bearer token authentication (per design Assumptions — actual endpoints TBD until API docs obtained; `testConnection()` will surface connectivity errors early). TJCISAdapter is an intentional stub — `search()` and `fetchSaleHistory()` throw `"TJCIS partnership not active — contact support"` until a commercial agreement is signed. This is not a gap; it is a deliberate gate per AD-8 (same pattern as existing BidpathAdapter).

**Implementation guidance**:
- SporthorseDataAdapter: `testConnection()` does GET to provider base URL with Bearer token; `search(query)` calls `/horses/search?q={query}`; `fetchSaleHistory(ref)` calls `/horses/{ref}/sales`
- EquibaseAdapter: similar structure; may use username/password basic auth if API key not available — stub with TODO until API docs confirmed
- TJCISAdapter: all three methods throw `new Error("TJCIS partnership not active — contact support")`
- All adapters implement `DataProviderAdapter` interface from STEP-9
- Register all three in `registry.ts` (STEP-9)

**Pattern reference**: `api/src/lib/adapters/BidpathAdapter.ts` (stub throw pattern for TJCISAdapter)

**Verify**:
- Level: unit | Given: TJCISAdapter instantiated | Action: call search() | Outcome: throws "TJCIS partnership not active"
- Level: inspection | Given: all 3 adapter files created | Action: TypeScript build | Outcome: 0 errors; all implement DataProviderAdapter interface

**Depends on**: STEP-9
**Enables**: STEP-11
**Parallel with**: —

---

## Slice 7 — Provider API Pull & Admin (depth)

**Goal**: Provider search returns results for configured providers; admin can configure platform TJCIS/Equineline credential.

---

### STEP-11: Provider list and search endpoints

**Trace**: [FR-7 → AC-7.1, AC-7.2, AC-7.3, AC-7.4, AC-7.5, AC-7.6, AC-7.7]
**Informed by**: AD-8

| Action | File | Repo |
|--------|------|------|
| modify | `api/src/routes/import.ts` | equine-iq |

**Effort**: M

**Intent**: The provider list endpoint filters to only show providers for which the calling user has active credentials (plus Equineline if PlatformProviderConfig.active = true) — returning unconfigured providers to the frontend would require the wizard to make per-provider credential checks. The search endpoint decrypts the credential at request time (never cached in-process memory). Provider API error responses must be caught and wrapped — never forwarded raw, since provider error details may include credential context.

**Implementation guidance**:
- `GET /api/import/providers` — query UserProviderConfig for userId; also query PlatformProviderConfig for TJCIS; return `{ providers: [{ provider, configured: true, testStatus }] }`
- `GET /api/import/providers/:provider/search?q=` — Zod: q required, min 2 chars; fetch UserProviderConfig for (userId, provider); decrypt credential; call `getAdapter(provider, credential).search(q)`; wrap errors
- `POST /api/import/providers/:provider/fetch` — accepts `{ providerRef }`; calls `fetchSaleHistory(providerRef)`; runs through same preview/execute pipeline as CSV
- If user has no config for requested provider → 403 "Connect [provider] in Settings → Data Sources"

> **Standards**: S-1 — Zod on search params; S-2 — requireAuth; S-4 — wrap provider errors, do not leak raw API error details

**Pattern reference**: `api/src/routes/import.ts` (upload/preview endpoint pattern from STEP-5)

**Verify**:
- Level: integration | Given: user has sporthorse_data configured | Action: GET /api/import/providers | Outcome: sporthorse_data appears in list with configured=true
- Level: integration | Given: user has no credentials | Action: GET /api/import/providers | Outcome: empty providers array
- Level: integration | Given: user requests equibase search without credentials | Action: GET /api/import/providers/equibase/search?q=horse | Outcome: 403 with connection prompt message

**Depends on**: STEP-10
**Enables**: STEP-12, STEP-14
**Parallel with**: —

---

### STEP-T11: Integration tests for provider endpoints

**Trace**: MANUAL → Test for STEP-11

| Action | File | Repo |
|--------|------|------|
| create | `api/tests/import.providers.test.ts` | equine-iq |

**Effort**: S

**Intent**: N/A — structural test step

**Implementation guidance**:
- Wrap in `describe.skip` when `!process.env.DATABASE_URL`; mock auctionSocket
- Mock adapter search calls (S-7 pattern — no live API calls in integration tests)
- Test: provider list with credentials → returns configured list
- Test: provider list with no credentials → returns empty list
- Test: search without credentials → 403

> **Standards**: S-6, S-7

**Verify**:
- Level: integration | Given: DATABASE_URL set | Action: npm test -- import.providers.test | Outcome: all tests pass

**Depends on**: STEP-11
**Enables**: STEP-12
**Parallel with**: —

---

### STEP-12: Admin platform providers route

**Trace**: [FR-6 → AC-6.7]
**Informed by**: AD-3

| Action | File | Repo |
|--------|------|------|
| create | `api/src/routes/admin/platformProviders.ts` | equine-iq |

**Effort**: S

**Intent**: Admin-only CRUD for TJCIS/Equineline platform credential. The `active` field on PlatformProviderConfig is what the providers list endpoint (STEP-11) checks — setting `active: true` enables Equineline for all users. Uses the same `encrypt()`/`decrypt()` as user-tier credentials.

**Implementation guidance**:
- `GET /api/admin/platform-providers` — return all PlatformProviderConfig rows with masked credentials
- `POST /api/admin/platform-providers/:provider` — upsert with encrypted credential
- `DELETE /api/admin/platform-providers/:provider` — delete + set active: false
- `POST /api/admin/platform-providers/:provider/test` — testConnection() + update testedAt
- `PATCH /api/admin/platform-providers/:provider/toggle` — toggle active boolean

> **Standards**: S-1 — Zod on POST body; S-3 — requireAuth + requireAdmin; S-4 — mask credentials in responses

**Pattern reference**: `api/src/routes/admin/adapters.ts`

**Verify**:
- Level: integration | Given: non-admin user | Action: POST /api/admin/platform-providers/tjcis | Outcome: 403
- Level: inspection | Given: file created | Action: TypeScript build | Outcome: 0 errors

**Depends on**: STEP-1, STEP-11
**Enables**: STEP-13
**Parallel with**: STEP-T11

---

## Slice 8 — Frontend Core (integration)

**Goal**: Import wizard renders all 3 steps end-to-end; history view accessible; routes wired.

---

### STEP-13: Frontend import API client

**Trace**: MANUAL → API wrappers for Import.tsx and ImportHistory.tsx

| Action | File | Repo |
|--------|------|------|
| create | `frontend/src/api/import.ts` | equine-iq |

**Effort**: S

**Intent**: N/A — structural step. Centralizes all axios calls to import endpoints. Follows the same axios pattern as other api/*.ts files. Typed return shapes enable TypeScript checking in the wizard component.

**Implementation guidance**:
- Export: `uploadCSV(file: File)`, `previewImport(config)`, `executeImport(config)`, `getHistory()`, `getBatch(id)`, `getProviders()`, `searchProvider(provider, query)`, `getPresets()`
- Use the existing axios instance with JWT auth header (match pattern from `frontend/src/api/horses.ts`)

**Pattern reference**: `frontend/src/api/` (horses.ts, mares.ts)

**Verify**:
- Level: inspection | Given: file created | Action: `npm run build` in frontend/ | Outcome: 0 TypeScript errors

**Depends on**: STEP-7, STEP-12
**Enables**: STEP-14, STEP-15
**Parallel with**: —

---

### STEP-14: Import wizard (3-step frontend component)

**Trace**: [FR-1 → AC-1.1] [FR-2 → AC-2.1, AC-2.2, AC-2.3, AC-2.4] [FR-3 → AC-3.1, AC-3.2, AC-3.3, AC-3.4, AC-3.5] [FR-4 → AC-4.1] [FR-7 → AC-7.1, AC-7.2, AC-7.3, AC-7.5]
**Informed by**: AD-9

| Action | File | Repo |
|--------|------|------|
| create | `frontend/src/views/Import.tsx` | equine-iq |

**Effort**: L

**Intent**: The step indicator must enforce sequential progression — Step 2 is inaccessible without a parsed upload result, Step 3 requires horseName to be mapped. These guards prevent malformed import submissions. The API Pull path in Step 1 shows available providers fetched from GET /api/import/providers — providers with no credentials show a link to Settings (AC-7.2) rather than a search form. In the preview table, "matched" rows must visually differentiate from "error" rows (different color/icon) — matched rows are valid imports, error rows are excluded.

**Implementation guidance**:
- Step 1 (Source): radio select CSV / API Pull; if API Pull, render provider list from getProviders(); unconfigured providers show "Connect in Settings → Data Sources" link
- Step 2 (Configure): CSV path → file dropzone (drag-and-drop + click); preset selector; column mapping table with ImportField target dropdowns; horseName required indicator
- Step 3 (Preview & Execute): call previewImport after mapping confirmed; table with status chips (valid/matched/error); ownership radio (My catalog / Shared catalog); Execute button calls executeImport; on completion show summary with counts; Cancel clears all state
- Use React state machine (not useReducer needed — useState per step is sufficient at this scale)

**Pattern reference**: `frontend/src/views/AuctionDetail.tsx` (multi-panel state management), `frontend/src/views/StallionCatalog.tsx` (list rendering)

**Verify**:
- Level: inspection | Given: Import.tsx created | Action: `npm run build` in frontend/ | Outcome: 0 TypeScript errors
- Level: inspection | Given: dev server running | Action: navigate to /import | Outcome: step 1 renders with CSV/API radio; no console errors

**Depends on**: STEP-13
**Enables**: STEP-15, STEP-18
**Parallel with**: —

---

### STEP-15: Import history views

**Trace**: [FR-5 → AC-5.1, AC-5.2, AC-5.3]

| Action | File | Repo |
|--------|------|------|
| create | `frontend/src/views/ImportHistory.tsx` | equine-iq |

**Effort**: M

**Intent**: The batch detail view must surface the `errorLog` JSON from ImportBatch as individual row outcomes — this is the user's only post-import visibility into partial failures (AC-5.2). The empty state (AC-5.3) includes a call-to-action link to `/import` so new users are not stranded.

**Implementation guidance**:
- List view: table of batches with columns: source, provider (if API), date, created/matched/error counts, status badge
- Detail view: accessed via row click or /import/history/:batchId; shows batch metadata + errorLog as row-level outcomes table
- Empty state: "No imports yet — upload a CSV or connect a data source to get started" with link to /import
- Fetch: `getHistory()` on mount; `getBatch(id)` on detail view mount

**Pattern reference**: `frontend/src/views/BuyerDashboard.tsx` (list view pattern with empty state)

**Verify**:
- Level: inspection | Given: ImportHistory.tsx created | Action: `npm run build` in frontend/ | Outcome: 0 TypeScript errors

**Depends on**: STEP-13
**Enables**: STEP-16
**Parallel with**: STEP-14

---

### STEP-16: App.tsx route registration

**Trace**: MANUAL → route wiring for Import.tsx and ImportHistory.tsx

| Action | File | Repo |
|--------|------|------|
| modify | `frontend/src/App.tsx` | equine-iq |

**Effort**: XS

**Intent**: N/A — structural step. `/import` and `/import/history` under ProtectedRoute (same as other authenticated views).

**Implementation guidance**:
- Import `Import` and `ImportHistory` from views/
- Add `<Route path="/import" element={<ProtectedRoute><Import /></ProtectedRoute>} />`
- Add `<Route path="/import/history" element={<ProtectedRoute><ImportHistory /></ProtectedRoute>} />`

**Pattern reference**: `frontend/src/App.tsx` (existing ProtectedRoute wrapping pattern)

**Verify**:
- Level: inspection | Given: App.tsx modified | Action: `npm run build` in frontend/ | Outcome: 0 TypeScript errors

**Depends on**: STEP-14, STEP-15
**Enables**: STEP-17
**Parallel with**: —

---

## Slice 9 — Frontend Settings (integration)

**Goal**: AccountSettings shows Data Sources card with per-provider rows; users can save, test, and remove credentials from the UI.

---

### STEP-17: Data Sources card in AccountSettings.tsx

**Trace**: [FR-6 → AC-6.1, AC-6.2, AC-6.3, AC-6.4, AC-6.6]
**Informed by**: AD-9 (spec deviation: card not tab)

| Action | File | Repo |
|--------|------|------|
| modify | `frontend/src/views/AccountSettings.tsx` | equine-iq |

**Effort**: M

**Intent**: The card fetches provider status on mount (GET /api/settings/providers) and shows the masked credential for already-configured providers. "Test Connection" calls the test endpoint and shows the result inline without a page reload (AC-6.3). The TJCIS/Equineline row is read-only — admin-managed — no Save/Remove actions (AC-6.6). This card is appended after the existing OpenAI key card, consistent with the existing layout (F-3, AD-9 spec deviation from tabbed layout).

**Implementation guidance**:
- New card section: "Data Sources" heading with subtitle "Connect external data providers to import horse data"
- Per provider row: provider display name, status badge ("Connected ✓" / "Not configured"), credential input (hidden if already saved — show masked value), Save / Test / Remove buttons
- TJCIS/Equineline row: read-only, shows "Connected — Platform" or "Pending agreement"
- On Save: POST to /api/settings/providers/:provider; on success refetch and show masked key
- On Test: POST to /api/settings/providers/:provider/test; show inline result message
- On Remove: DELETE /api/settings/providers/:provider; reset form to empty

**Pattern reference**: Existing OpenAI key section in `frontend/src/views/AccountSettings.tsx`

**Verify**:
- Level: inspection | Given: AccountSettings.tsx modified | Action: `npm run build` in frontend/ | Outcome: 0 TypeScript errors
- Level: inspection | Given: dev server running | Action: navigate to /settings | Outcome: Data Sources section renders below existing cards; no console errors

**Depends on**: STEP-8, STEP-16
**Enables**: STEP-18
**Parallel with**: —

---

## Slice 10 — Should Have + Nice to Have (depth)

**Goal**: Pedigree cross-link suggestions appear after import; AQHA and KWPN presets available in the preset selector.

---

### STEP-18: Pedigree cross-link suggestions (FR-8)

**Trace**: [FR-8 → AC-8.1, AC-8.2, AC-8.3]
**Informed by**: AD-4

| Action | File | Repo |
|--------|------|------|
| modify | `api/src/lib/importEngine.ts` | equine-iq |
| modify | `api/src/routes/import.ts` | equine-iq |
| modify | `frontend/src/views/Import.tsx` | equine-iq |

**Effort**: M

**Intent**: Cross-link detection must run post-import, not during — running it during import would add one DB query per horse per field (sire, dam), multiplying query count. Instead, collect all unique sire/dam name strings from the batch and run one `WHERE name IN (...)` query after the batch completes. Suggestions are shown to the user for confirmation — false positives (two horses with same name) are handled by user judgment, not auto-linked.

**Implementation guidance**:
- In `importEngine.ts`: after batch completes, collect all unique sire/dam strings; query `prisma.horse.findMany({ where: { name: { in: [...sireNames, ...damNames] } } })`; return `pedigreeSuggestions: [{ importedHorseId, field: 'sire'|'dam', matchedHorseId, matchedHorseName }]`
- New endpoint: `POST /api/import/link-pedigree` — Zod: `{ horseId, field: 'sire'|'dam', targetHorseId }`; update `horse.pedigree` JSON replacing string name with `{ id, name }` object; requireAuth + verify horse ownership
- In `Import.tsx`: after execution summary, if `pedigreeSuggestions.length > 0`, render suggestions list with "Confirm Link" / "Dismiss" per suggestion

> **Standards**: S-1 — Zod on link-pedigree body; S-2 — requireAuth

**Pattern reference**: `api/src/lib/importEngine.ts` (STEP-6 pattern)

**Verify**:
- Level: integration | Given: imported horse whose sire name matches existing horse | Action: executeImport returns result | Outcome: pedigreeSuggestions contains one entry for that horse+sire match
- Level: integration | Given: pedigree suggestion | Action: POST /api/import/link-pedigree | Outcome: horse.pedigree JSON updated with { id, name } for the linked field

**Depends on**: STEP-6, STEP-14
**Enables**: —
**Parallel with**: STEP-19

---

### STEP-19: AQHA and KWPN/Warmblood column mapping presets (FR-9)

**Trace**: [FR-9 → AC-9.1, AC-9.2]

| Action | File | Repo |
|--------|------|------|
| modify | `api/src/lib/columnMappingPresets.ts` | equine-iq |

**Effort**: XS

**Intent**: N/A — structural extension. Column names are approximate and will need validation against actual AQHA and KWPN export samples before production use. Default disciplines: AQHA → `quarter_horse`, KWPN → `warmblood`.

**Implementation guidance**:
- Add `aqha` preset entry to `PRESETS` with `defaultDiscipline: 'quarter_horse'`
- Add `kwpn` preset entry with `defaultDiscipline: 'warmblood'`
- Column names: approximate based on known breed association export formats; add inline comment noting these may need adjustment per actual export sample

**Pattern reference**: `api/src/lib/columnMappingPresets.ts` (STEP-3)

**Verify**:
- Level: inspection | Given: file modified | Action: TypeScript build in api/ | Outcome: 0 errors; PRESETS has 7 entries total

**Depends on**: STEP-3
**Enables**: —
**Parallel with**: STEP-18

---

## NFR Traceability

| NFR | Disposition | Enforcing Mechanism |
|-----|-------------|---------------------|
| NFR-1: Import Throughput ≤10s / 500 rows | Implemented + Deferred | STEP-6 uses per-row try/catch (not single large transaction) + Prisma SaleRecord upsert for efficiency; STEP-2 sets 60s timeout. Background jobs for >500 rows deferred per AD-7 (no infra on Render). Monitor staging P95. |
| NFR-2: Credential Security — no plaintext | Implemented | STEP-8 and STEP-12 enforce S-4 (mask on response); encryption via `encrypt()` on write, `decrypt()` only for testConnection; STEP-T8 verifies DB value is not plaintext |
| NFR-3: Data Isolation — 403 on cross-user access | Implemented | STEP-5, STEP-7, STEP-8, STEP-11 all scope queries to `getUserId(req)`; STEP-T7 tests cross-user batch access returns 403 |
| NFR-4: Idempotent Imports — 0 duplicates on re-import | Implemented | STEP-1 adds `@@unique([horseId, hipNumber, saleDate])`; STEP-6 uses SaleRecord upsert; STEP-T6 explicitly tests re-import creates 0 new records |

---

## Conflict Analysis

| Shared File | Modified in Bundles | Risk |
|-------------|---------------------|------|
| `api/src/routes/import.ts` | 3, 5, 7, 10 | Sequential execution only — no conflict (Bundles 3→5→7→10 are ordered) |
| `api/src/lib/importEngine.ts` | 4, 10 | Sequential — Bundle 10 modifies after Bundle 4 completes |
| `api/src/lib/columnMappingPresets.ts` | 2, 10 | Sequential — Bundle 10 adds presets after Bundle 2 creates the file |
| `api/src/routes/settings.ts` | 6 | Single bundle — no conflict |
| `frontend/src/views/AccountSettings.tsx` | 9 | Single bundle — no conflict |
| `frontend/src/views/Import.tsx` | 8, 10 | Sequential — Bundle 10 adds cross-link UI after Bundle 8 creates the component |
| `frontend/src/App.tsx` | 8 | Single bundle — no conflict |

All conflicts are resolved by sequential bundle ordering. Parallel execution is not recommended for this decomposition.
