---
bundle: 2
title: CSV Parsing Utilities
stage: skeleton
parallel: no
depends_on: [1]
goal: Column mapping presets + CSV parser utilities unit-tested and ready for route consumption
---

# Bundle 2 — CSV Parsing Utilities

**Goal**: `columnMappingPresets.ts` exports all 5 presets with `defaultDiscipline`; `csvParser.ts` exports parseCSV, applyMapping, validateRows; unit tests pass.

**Bundle Verify**: `npm test -- csvParser.test` passes; parseCSV returns correct headers; validateRows flags missing horseName as error; normalizePrice converts "5,000.00" to 500000.

---

## STEP-3: Column mapping presets configuration

**Trace**: [FR-2 → AC-2.1, AC-2.2]

**Files**:
- `api/src/lib/columnMappingPresets.ts` (create)

**Effort**: S

**Intent**: The `defaultDiscipline` per preset satisfies `Horse.discipline` non-nullable during import. Without it, Keeneland CSV imports fail with a Prisma validation error. Discipline mapping: Keeneland/FT/OBS/Saratoga → `thoroughbred_racing`, Generic → `other`.

**Implementation guidance**:
1. Export `ImportField` type: `'horseName' | 'sex' | 'breed' | 'sire' | 'dam' | 'damsire' | 'dateOfBirth' | 'hipNumber' | 'saleDate' | 'saleSessionName' | 'hammerPrice' | 'buyerName' | 'consignorName' | 'registrationNumber'`
2. Export `ColumnMappingPreset` interface: `{ name: string; displayName: string; defaultDiscipline: string; columns: Partial<Record<ImportField, string>> }`
3. Export `PRESETS` record with keys: `keeneland`, `fasig_tipton`, `obs`, `saratoga`, `generic`; each maps known column header names to ImportField keys
4. Export `getPreset(name: string): ColumnMappingPreset | null`
5. Column name mappings are approximate — add inline `// NOTE: verify against actual export sample` comment per preset

**Verify**:
- Level: inspection | Given: file created | Action: TypeScript build | Outcome: 0 errors; 5 presets present; each has `defaultDiscipline`

---

## STEP-4: CSV parser utilities

**Trace**: [FR-1 → AC-1.1, AC-1.2, AC-1.3, AC-1.4] [FR-3 → AC-3.1, AC-3.2, AC-3.4]

**Files**:
- `api/src/lib/csvParser.ts` (create)

**Effort**: M

**Intent**: `validateRows` does in-memory validation only — DB dedup happens in the import engine (STEP-6), not here. `hammerPrice` must be normalized to integer cents (`normalizePrice("5,000.00")` → `500000`) to match `SaleRecord.hammerPriceCents: Int`. Missing horseName is the only hard-block error.

**Implementation guidance**:
1. `parseCSV(buffer: Buffer): { headers: string[]; rows: Record<string, string>[] }` — use csv-parse `parseSync(buffer, { columns: true, skip_empty_lines: true, trim: true })`
2. `applyMapping(rows: Record<string, string>[], config: ColumnMappingConfig): MappedRow[]` — map CSV column names to ImportField keys; columns not in mapping become `ignored`; export `ColumnMappingConfig = Partial<Record<ImportField, string>>` (maps ImportField → CSV column name)
3. `validateRows(rows: MappedRow[]): ValidatedRow[]` — each row: status 'valid' | 'error'; errors array; validate: horseName required; dateOfBirth/saleDate must parse as date; hammerPrice must parse as float
4. `normalizePrice(raw: string): number` — strip commas, currency symbols (`$`, `£`, `€`); parseFloat; `Math.round(parsed * 100)`
5. Export all types

> **Standards**: S-1 — validate all mapped fields before they reach the DB

**Verify**:
- Level: unit | Given: Buffer of valid CSV | Action: parseCSV(buffer) | Outcome: correct headers + row count
- Level: unit | Given: MappedRow missing horseName | Action: validateRows | Outcome: status 'error', errors includes "Missing: Horse Name"
- Level: unit | Given: "5,000.00" | Action: normalizePrice | Outcome: 500000
- Level: unit | Given: date "03/15/2024" | Action: validateRows | Outcome: row is valid

---

## STEP-T4: Unit tests for CSV parser utilities

**Trace**: MANUAL → Test for STEP-4

**Files**:
- `api/tests/csvParser.test.ts` (create)

**Effort**: S

**Intent**: N/A — structural test step

**Implementation guidance**:
1. Test parseCSV: valid CSV → correct headers; empty body → throws or returns 0 rows
2. Test applyMapping: Keeneland preset applied to matching headers → all known fields mapped
3. Test validateRows: missing horseName → error; invalid date → error; valid row → status 'valid'
4. Test normalizePrice: "$1,234.50" → 123450; "2500" → 250000; "0" → 0

> **Standards**: S-6 — no DATABASE_URL dependency; pure unit tests, no describe.skip needed

**Verify**:
- Level: unit | Given: test file | Action: `npm test -- csvParser.test` in api/ | Outcome: all tests pass
