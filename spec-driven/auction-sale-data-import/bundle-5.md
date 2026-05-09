---
bundle: 5
title: Execute & History Endpoints
stage: skeleton
parallel: no
depends_on: [4]
goal: Full import lifecycle callable via API; ImportBatch audit trail persisted; history endpoints user-scoped
---

# Bundle 5 — Execute & History Endpoints

**Goal**: POST /api/import/execute runs full import, creates ImportBatch audit record, returns summary. GET /api/import/history returns user's own batches. GET /api/import/history/:batchId returns row-level outcomes. Integration tests confirm user isolation.

**Bundle Verify**: Execute returns `{ created, matched, errorCount }`; ImportBatch exists in DB after execute; history returns only the calling user's batches; cross-user batch access returns 403/404.

---

## STEP-7: Execute endpoint and import history endpoints

**Trace**: [FR-4 → AC-4.1, AC-4.5] [FR-5 → AC-5.1, AC-5.2, AC-5.3]

**Files**:
- `api/src/routes/import.ts` (modify — add execute + history sections)

**Effort**: M

**Intent**: Execute creates ImportBatch with `status: 'processing'` BEFORE calling executeImport — a crash mid-batch still leaves an audit record. Batch is updated to `'completed'` or `'failed'` after executeImport returns. History endpoints scope to `getUserId(req)` — cross-user access must never succeed (NFR-3). The 60s timeout set in STEP-2 guards the execute endpoint; a comment documents why.

**Implementation guidance**:
1. `POST /api/import/execute` — Zod: `{ mappingConfig: z.record(z.string()), rows: z.array(z.record(z.string())), ownership: z.enum(['personal', 'shared']), presetName: z.string().optional() }`;
   - Create `ImportBatch` with `status: 'processing'`, `source: 'csv'`, `importedByUserId: userId`, `sourceFileName`, `totalRows: rows.length`
   - Call `applyMapping`, `validateRows`, then `executeImport(validRows, ownership, batch.id, userId, preset?.defaultDiscipline)`
   - Update batch: `status: 'completed'`, `createdCount`, `matchedCount`, `errorCount`, `errorLog`
   - Return completed batch record (no plaintext credentials in response — batch has none)
2. `GET /api/import/history` — `findMany({ where: { importedByUserId: userId }, orderBy: { createdAt: 'desc' } })`; return `{ batches }`
3. `GET /api/import/history/:batchId` — `findFirst({ where: { id: batchId, importedByUserId: userId } })`; if null → 404; return full batch including errorLog
4. Add `// 60s timeout set in index.ts for this router — see AD-7` comment on execute route

> **Standards**: S-1 — Zod on execute body; S-2 — requireAuth on all three endpoints

**Pattern reference**: `api/src/routes/listings.ts`

**Verify**:
- Level: integration | Given: valid rows + 'personal' ownership | Action: POST /api/import/execute | Outcome: 200 with summary; ImportBatch in DB with status 'completed'
- Level: integration | Given: 2 batches for userA | Action: GET /api/import/history (as userA) | Outcome: returns 2 batches
- Level: integration | Given: batchId owned by userB | Action: GET /api/import/history/:batchId (as userA) | Outcome: 404
- Level: integration | Given: no past imports | Action: GET /api/import/history | Outcome: 200 `{ batches: [] }`

---

## STEP-T7: Integration tests for execute and history endpoints

**Trace**: MANUAL → Test for STEP-7

**Files**:
- `api/tests/import.execute.test.ts` (create)

**Effort**: M

**Intent**: N/A — structural test step

**Implementation guidance**:
1. Wrap in `describe.skip` when `!process.env.DATABASE_URL`; mock auctionSocket
2. Test execute → summary shape; ImportBatch persisted with correct counts
3. Test history scoped to user; cross-user batch access → 404
4. Test empty history → `{ batches: [] }`
5. Test batch detail includes errorLog array

> **Standards**: S-6, S-7

**Verify**:
- Level: integration | Given: DATABASE_URL set | Action: `npm test -- import.execute.test` | Outcome: all tests pass
