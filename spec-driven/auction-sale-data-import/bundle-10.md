---
bundle: 10
title: Should Have + Nice to Have
stage: depth
parallel: no
depends_on: [4, 8]
goal: Pedigree cross-link suggestions shown post-import; AQHA and KWPN presets available in preset selector
---

# Bundle 10 — Should Have + Nice to Have

**Goal**: After import completes, `executeImport` returns pedigree link suggestions when sire/dam names match existing horses. User can confirm or dismiss from the Import wizard completion screen. AQHA and KWPN presets appear in the preset selector with correct discipline defaults.

**Bundle Verify**: Import of a horse whose sire matches an existing Horse record returns `pedigreeSuggestions` with that match; POST /api/import/link-pedigree updates horse pedigree JSON; AQHA and KWPN appear in `getPresets()` response with correct `defaultDiscipline` values.

---

## STEP-18: Pedigree cross-link suggestions (FR-8)

**Trace**: [FR-8 → AC-8.1, AC-8.2, AC-8.3]

**Files**:
- `api/src/lib/importEngine.ts` (modify)
- `api/src/routes/import.ts` (modify — add link-pedigree endpoint)
- `frontend/src/views/Import.tsx` (modify — add suggestions section)

**Effort**: M

**Intent**: Cross-link detection runs post-import to avoid multiplying query count during the batch — collect all unique sire/dam strings from the batch, then run one `WHERE name IN (...)` query. Suggestions are shown for user confirmation; false positives (two horses with the same name) are handled by user judgment, not auto-linked. The `pedigree` JSON update replaces string name keys with `{ id, name }` objects.

**Implementation guidance**:
1. `importEngine.ts` — after batch loop: collect `uniqueSireNames` and `uniqueDamNames` from all processed rows; query `prisma.horse.findMany({ where: { name: { in: [...uniqueSireNames, ...uniqueDamNames] } } })`; build `pedigreeSuggestions: [{ importedHorseId, field: 'sire'|'dam', matchedHorseId, matchedHorseName }]`; include in `ImportResult` return
2. `import.ts` — new endpoint `POST /api/import/link-pedigree`: Zod: `{ horseId: z.string(), field: z.enum(['sire', 'dam']), targetHorseId: z.string() }`; requireAuth; verify horse ownership (createdByUserId === userId OR null for shared — allow shared catalog updates); update `horse.pedigree` JSON: replace string key `sire`/`dam` with `{ id: targetHorseId, name: targetHorseName }`; return updated horse
3. `Import.tsx` — after completion summary: if `result.pedigreeSuggestions.length > 0`, render suggestions section; per suggestion: "[HorseName]'s sire '[SireName]' may match [MatchedName] in the platform"; "Confirm Link" → call link-pedigree; "Dismiss" → remove from local state

> **Standards**: S-1 — Zod on link-pedigree body; S-2 — requireAuth + ownership check

**Pattern reference**: `api/src/lib/importEngine.ts` (STEP-6 pattern); `frontend/src/views/Import.tsx` (STEP-14 completion screen)

**Verify**:
- Level: integration | Given: imported horse with sire name matching existing Horse | Action: executeImport returns result | Outcome: pedigreeSuggestions contains entry for that match
- Level: integration | Given: pedigree suggestion | Action: POST /api/import/link-pedigree | Outcome: horse.pedigree updated with `{ id, name }` for linked field
- Level: inspection | Given: Import.tsx modified | Action: `npm run build` in frontend/ | Outcome: 0 errors

---

## STEP-19: AQHA and KWPN/Warmblood presets (FR-9)

**Trace**: [FR-9 → AC-9.1, AC-9.2]

**Files**:
- `api/src/lib/columnMappingPresets.ts` (modify)

**Effort**: XS

**Intent**: N/A — structural extension. Column names are approximate; add inline `// NOTE: verify against actual AQHA/KWPN export sample` comment. Default disciplines: AQHA → `quarter_horse`, KWPN → `warmblood`.

**Implementation guidance**:
1. Add `aqha` entry to `PRESETS` with `displayName: 'AQHA Sales'`, `defaultDiscipline: 'quarter_horse'`, approximate AQHA column name mappings
2. Add `kwpn` entry with `displayName: 'KWPN / Warmblood'`, `defaultDiscipline: 'warmblood'`, approximate KWPN column name mappings
3. Total PRESETS entries: 7 (keeneland, fasig_tipton, obs, saratoga, generic, aqha, kwpn)

**Pattern reference**: `api/src/lib/columnMappingPresets.ts` (STEP-3)

**Verify**:
- Level: inspection | Given: file modified | Action: TypeScript build in api/ | Outcome: 0 errors; PRESETS has 7 entries; aqha has `defaultDiscipline: 'quarter_horse'`; kwpn has `defaultDiscipline: 'warmblood'`
