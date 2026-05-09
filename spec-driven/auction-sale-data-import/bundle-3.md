---
bundle: 3
title: Upload & Preview Endpoints
stage: skeleton
parallel: no
depends_on: [2]
goal: CSV upload and preview endpoints functional; no DB writes; dedup status returned per row
---

# Bundle 3 — Upload & Preview Endpoints

**Goal**: POST /api/import/upload parses a CSV and returns headers + 10 preview rows. POST /api/import/preview applies mapping, validates rows, and returns per-row status including dedup matches. Integration tests pass.

**Bundle Verify**: POST /api/import/upload with a 10-row CSV returns `{ headers, preview, totalRows }`; file >10MB returns 400; POST /api/import/preview with horseName missing returns error rows; DB is not written at either step.

---

## STEP-5: CSV upload and preview endpoints

**Trace**: [FR-1 → AC-1.1, AC-1.2, AC-1.3, AC-1.4] [FR-2 → AC-2.1, AC-2.3, AC-2.4] [FR-3 → AC-3.1, AC-3.2, AC-3.4]

**Files**:
- `api/src/routes/import.ts` (create — upload + preview sections; stub was created in STEP-2)

**Effort**: M

**Intent**: Upload is stateless — no DB write, returns raw parse results only. Preview applies mapping + validates rows; dedup check queries Horse by name+sire+dam across user-owned (`createdByUser = userId`) AND shared catalog (`createdByUser = null`) — match in either counts as "matched" and must be visible in preview before commit.

**Implementation guidance**:
1. `POST /api/import/upload` — `requireAuth`; `multer({ storage: multer.memoryStorage(), limits: { fileSize: 10*1024*1024 } }).single('file')`; validate MIME type (`text/csv`) and extension (`.csv`) — 400 if invalid; call `parseCSV(req.file.buffer)`; if 0 data rows → 400 "CSV contains no data rows"; return `{ headers, preview: rows.slice(0,10), totalRows: rows.length, rawRows: rows }` (rawRows needed for preview step)
2. `POST /api/import/preview` — `requireAuth`; Zod: `{ mappingConfig: z.record(z.string()), rows: z.array(z.record(z.string())) }`; call `applyMapping(rows, mappingConfig)`; call `validateRows(mapped)`; for valid rows with name+sire+dam, query `prisma.horse.findFirst({ where: { name: row.horseName, OR: [{ createdByUserId: userId }, { createdByUserId: null }] } })` — if found, set status 'matched' with matchedHorseId; return `{ validCount, matchedCount, errorCount, rows }`
3. Zod reject: missing horseName mapping → warn in response (don't block — let validateRows handle it per row)

> **Standards**: S-1 — Zod on preview request body; S-2 — requireAuth + getUserId on both endpoints

**Pattern reference**: `api/src/routes/horses.ts` (route structure + Zod pattern)

**Verify**:
- Level: integration | Given: valid 10-row CSV | Action: POST /api/import/upload | Outcome: 200 with headers array + preview rows + totalRows
- Level: integration | Given: file > 10MB | Action: POST /api/import/upload | Outcome: 400 "File exceeds 10 MB limit"
- Level: integration | Given: non-CSV MIME | Action: POST /api/import/upload | Outcome: 400 "Only CSV files are accepted"
- Level: integration | Given: mappingConfig with horseName mapped | Action: POST /api/import/preview | Outcome: rows with valid/error/matched status

---

## STEP-T5: Integration tests for upload and preview endpoints

**Trace**: MANUAL → Test for STEP-5

**Files**:
- `api/tests/import.upload.test.ts` (create)

**Effort**: M

**Intent**: N/A — structural test step

**Implementation guidance**:
1. Wrap all in `describe.skip` when `!process.env.DATABASE_URL`
2. Mock auctionSocket: `vi.mock('../src/lib/auctionSocket', () => ({ auctionSocket: { emit: vi.fn() } }))`
3. Create inline test CSV string fixture (do not read files)
4. Test: valid CSV → 200 with correct structure; >10MB → 400; empty body → 400; non-CSV extension → 400
5. Test: preview with no horseName mapping → all rows have errors; preview with existing horse in DB → row status 'matched'

> **Standards**: S-6 — describe.skip when DATABASE_URL absent; S-7 — mock auctionSocket

**Verify**:
- Level: integration | Given: DATABASE_URL set | Action: `npm test -- import.upload.test` | Outcome: all tests pass
