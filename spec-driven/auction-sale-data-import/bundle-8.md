---
bundle: 8
title: Frontend Core
stage: integration
parallel: no
depends_on: [5]
goal: Import wizard renders all 3 steps; history view accessible; routes wired; TypeScript builds cleanly
---

# Bundle 8 — Frontend Core

**Goal**: /import renders 3-step wizard (source → configure → preview/execute). /import/history shows batch list. TypeScript build in frontend/ exits 0. Step progression enforced (step 2 blocked without upload, step 3 blocked without horseName mapping).

**Bundle Verify**: `npm run build` in frontend/ exits 0; /import renders without console errors; step 1 → step 2 → step 3 progression works; /import/history shows list with empty state.

---

## STEP-13: Frontend import API client

**Trace**: MANUAL → API wrappers for Import.tsx and ImportHistory.tsx

**Files**:
- `frontend/src/api/import.ts` (create)

**Effort**: S

**Intent**: N/A — structural step. Centralizes all axios calls. Typed return shapes enable TypeScript checking in wizard components.

**Implementation guidance**:
1. Export typed functions: `uploadCSV(file: File)`, `previewImport(config)`, `executeImport(config)`, `getHistory()`, `getBatch(id: string)`, `getProviders()`, `searchProvider(provider: string, q: string)`, `getPresets()`
2. Use existing axios instance with JWT auth header (match pattern from `frontend/src/api/horses.ts`)
3. Export TypeScript types for response shapes: `ImportProvider`, `ImportBatch`, `BatchDetail`, `PreviewRow`, `ExecuteSummary`

**Pattern reference**: `frontend/src/api/horses.ts`

**Verify**:
- Level: inspection | Given: file created | Action: `npm run build` in frontend/ | Outcome: 0 TypeScript errors

---

## STEP-14: Import wizard (3-step component)

**Trace**: [FR-1 → AC-1.1] [FR-2 → AC-2.1, AC-2.2, AC-2.3, AC-2.4] [FR-3 → AC-3.1, AC-3.2, AC-3.3, AC-3.4, AC-3.5] [FR-4 → AC-4.1] [FR-7 → AC-7.1, AC-7.2, AC-7.3, AC-7.5]

**Files**:
- `frontend/src/views/Import.tsx` (create)

**Effort**: L

**Intent**: Step indicator enforces sequential progression — step 2 inaccessible without parsed upload result; step 3 requires horseName mapped. These guards prevent malformed submissions. API Pull path shows available providers from GET /api/import/providers; unconfigured providers show Settings link (AC-7.2). Matched rows in preview table must visually differ from error rows — both are shown but only errors are excluded from "import valid rows only".

**Implementation guidance**:
1. Step state: `type Step = 'source' | 'configure' | 'preview'`; `useState<Step>('source')`
2. Step 1 — Source:
   - Radio: "Upload CSV" / "API Pull"
   - If "API Pull": fetch `getProviders()` on mount; render per-provider rows; unconfigured shows link to /settings
3. Step 2 — Configure:
   - CSV path: file dropzone (`<input type="file" accept=".csv">`); on change call `uploadCSV(file)` → set `uploadResult`; preset selector (`<select>` with presets from `getPresets()`); column mapping table (CSV column → ImportField dropdown); horseName required indicator; "Next" disabled until horseName mapped
   - API Pull path: search input + "Search" button → `searchProvider(provider, q)` → results list; select result → set as import rows
4. Step 3 — Preview:
   - Call `previewImport({ mappingConfig, rows: uploadResult.rawRows })` on enter
   - Table: row status chip (green="valid", yellow="matched", red="error"); error rows show inline message
   - Ownership radio: "Add to my catalog" / "Contribute to shared catalog"
   - "Import valid rows only" button → `executeImport({ mappingConfig, rows, ownership })` → show summary
   - "Cancel" clears all state and returns to step 1
5. Completion summary: show `{ created, matched, errorCount }` counts

**Pattern reference**: `frontend/src/views/AuctionDetail.tsx` (multi-panel state management)

**Verify**:
- Level: inspection | Given: Import.tsx created | Action: `npm run build` in frontend/ | Outcome: 0 TypeScript errors
- Level: inspection | Given: dev server running | Action: navigate to /import | Outcome: step 1 renders with source radio; no console errors

---

## STEP-15: Import history views

**Trace**: [FR-5 → AC-5.1, AC-5.2, AC-5.3]

**Files**:
- `frontend/src/views/ImportHistory.tsx` (create)

**Effort**: M

**Intent**: The batch detail view surfaces `errorLog` as row-level outcomes — the user's only post-import visibility into partial failures. Empty state includes a call-to-action link to /import.

**Implementation guidance**:
1. List view: `getHistory()` on mount; table with columns: source, provider (if API), date, created/matched/error counts, status badge; row click → `/import/history/:id`
2. Detail view: route param `:id`; `getBatch(id)` on mount; batch metadata header + `errorLog` as outcomes table (rowIndex, error message)
3. Empty state: "No imports yet — upload a CSV or connect a data source to get started" with `<Link to="/import">` button

**Pattern reference**: `frontend/src/views/BuyerDashboard.tsx` (list view + empty state)

**Verify**:
- Level: inspection | Given: ImportHistory.tsx created | Action: `npm run build` in frontend/ | Outcome: 0 TypeScript errors

---

## STEP-16: App.tsx route registration

**Trace**: MANUAL → route wiring for /import and /import/history

**Files**:
- `frontend/src/App.tsx` (modify)

**Effort**: XS

**Intent**: N/A — structural wiring. Both routes under ProtectedRoute consistent with other authenticated views.

**Implementation guidance**:
1. Import `Import` from `./views/Import` and `ImportHistory` from `./views/ImportHistory`
2. Add `<Route path="/import" element={<ProtectedRoute><Import /></ProtectedRoute>} />`
3. Add `<Route path="/import/history" element={<ProtectedRoute><ImportHistory /></ProtectedRoute>} />`
4. Add `<Route path="/import/history/:id" element={<ProtectedRoute><ImportHistory /></ProtectedRoute>} />` if ImportHistory handles both list and detail views

**Pattern reference**: `frontend/src/App.tsx` (existing ProtectedRoute wrapping)

**Verify**:
- Level: inspection | Given: App.tsx modified | Action: `npm run build` in frontend/ | Outcome: 0 TypeScript errors
