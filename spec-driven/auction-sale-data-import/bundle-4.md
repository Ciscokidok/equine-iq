---
bundle: 4
title: Import Engine
stage: skeleton
parallel: no
depends_on: [3]
goal: Horse dedup + SaleRecord creation logic tested; partial failure isolation confirmed; idempotency verified
---

# Bundle 4 — Import Engine

**Goal**: `importEngine.ts` exports `executeImport()` with correct Horse dedup (user-owned then shared catalog), SaleRecord upsert, per-row error isolation, and ownership mode. Integration tests confirm idempotency (same batch twice → 0 new records).

**Bundle Verify**: executeImport creates Horse+SaleRecord for new rows; skips Horse creation for matched rows; second run of same batch produces 0 new Horse and 0 new SaleRecord; one failing row does not roll back others.

---

## STEP-6: Import engine (Horse dedup, Horse creation, SaleRecord creation)

**Trace**: [FR-4 → AC-4.1, AC-4.2, AC-4.3, AC-4.4, AC-4.5, AC-4.6, AC-4.7] [NFR-4]

**Files**:
- `api/src/lib/importEngine.ts` (create)

**Effort**: L

**Intent**: Partial failure isolation (AC-4.7) requires per-row try/catch — a single Prisma transaction wrapping all rows would roll back everything on one row error. Per-row atomicity (Horse + SaleRecord for one row) still uses `prisma.$transaction` to keep the pair consistent. Dedup order: user-owned (`createdByUser = userId`) first, then shared catalog (`createdByUser = null`); first match wins. SaleRecord upsert on unique index `(horseId, hipNumber, saleDate)` makes re-importing idempotent (NFR-4) — existing records are preserved, not updated.

**Implementation guidance**:
1. Export `executeImport(rows: ValidatedRow[], ownership: 'personal' | 'shared', batchId: string, userId: string, defaultDiscipline?: string): Promise<ImportResult>`
2. For each valid row: query `prisma.horse.findFirst` by `{ name: row.horseName }` with filter `{ OR: [{ createdByUserId: userId }, { createdByUserId: null }] }`; also check sire/dam from pedigree JSON if available for confidence
3. If no match: `prisma.$transaction([horse.create(...), saleRecord.upsert(...)])` with `createdByUser = ownership === 'shared' ? null : userId`; Horse.discipline = row.discipline || defaultDiscipline || 'other'
4. If match: `prisma.saleRecord.upsert({ where: { horseId_hipNumber_saleDate: { horseId: match.id, hipNumber: row.hipNumber ?? '', saleDate: row.saleDate } }, update: {}, create: { ... } })`
5. Per-row: wrap in try/catch; catch pushes `{ rowIndex, error: e.message }` to errorLog; does not rethrow
6. After all rows: return `{ createdCount, matchedCount, errorCount, errorLog, pedigreeSuggestions: [] }` (pedigreeSuggestions populated in STEP-18)
7. Export `ImportResult` type

> **Standards**: S-5 — `prisma.$transaction` for Horse + SaleRecord per-row pair

**Pattern reference**: `api/src/lib/auctionLifecycle.ts` (multi-step Prisma write patterns)

**Verify**:
- Level: integration | Given: 3 valid rows, no existing horses | Action: executeImport | Outcome: createdCount=3, matchedCount=0
- Level: integration | Given: row whose name matches existing horse | Action: executeImport | Outcome: matchedCount=1, no new Horse in DB
- Level: integration | Given: same batch executed twice | Action: executeImport twice | Outcome: second run: createdCount=0, matchedCount=all rows
- Level: integration | Given: one row missing required field | Action: executeImport | Outcome: errorCount=1, other rows succeed

---

## STEP-T6: Integration tests for import engine

**Trace**: MANUAL → Test for STEP-6

**Files**:
- `api/tests/importEngine.test.ts` (create)

**Effort**: M

**Intent**: N/A — structural test step

**Implementation guidance**:
1. Wrap in `describe.skip` when `!process.env.DATABASE_URL`; mock auctionSocket
2. Test all 4 verify cases from STEP-6
3. Include: shared ownership sets `createdByUserId = null`; personal sets `createdByUserId = userId`
4. Include: explicit upsert assertion — after second import run, `prisma.saleRecord.count()` equals original count (no new rows)

> **Standards**: S-6, S-7

**Verify**:
- Level: integration | Given: DATABASE_URL set | Action: `npm test -- importEngine.test` | Outcome: all tests pass
