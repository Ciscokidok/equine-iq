---
bundle: 9
title: Frontend Settings — Data Sources Card
stage: integration
parallel: no
depends_on: [6, 8]
goal: AccountSettings shows Data Sources card; users can save, test, and remove provider credentials from the UI
---

# Bundle 9 — Frontend Settings — Data Sources Card

**Goal**: AccountSettings.tsx renders a "Data Sources" card section after the existing OpenAI key card. Per-provider rows show status. Users can save, test, and remove credentials inline. TJCIS/Equineline row is read-only. TypeScript build exits 0.

**Bundle Verify**: `npm run build` in frontend/ exits 0; /settings renders Data Sources section below existing cards; provider status loads; test connection shows inline result; TJCIS row has no Save/Remove actions.

---

## STEP-17: Data Sources card in AccountSettings.tsx

**Trace**: [FR-6 → AC-6.1, AC-6.2, AC-6.3, AC-6.4, AC-6.6]

**Files**:
- `frontend/src/views/AccountSettings.tsx` (modify)

**Effort**: M

**Intent**: Fetches provider status on mount (GET /api/settings/providers) to display masked credentials and connection status without requiring user interaction. "Test Connection" calls test endpoint and shows result inline — not a page reload (AC-6.3). TJCIS/Equineline row is read-only — admin-managed — no Save/Remove actions for regular users (AC-6.6). Card is appended below existing cards to match AccountSettings layout (AD-9 spec deviation from tabbed layout).

**Implementation guidance**:
1. Add import for provider API functions (from `api/import.ts` or a separate `api/settings.ts` — follow existing pattern)
2. `useEffect`: call `GET /api/settings/providers` on mount; set providers state
3. "Data Sources" card section (`<div className="...card...">`) appended after OpenAI key card:
   - Card header: "Data Sources" + subtitle "Connect external data providers to import horse data"
   - Per user-tier provider row: display name, status badge ("Connected ✓" / "Not configured"), masked credential display (if saved), credential input field (hidden if saved), Save / Test / Remove buttons
   - TJCIS row: "Equineline (Platform)" label, read-only status ("Connected — Platform" if active, "Pending partnership agreement" if not), no action buttons
4. On Save: POST /api/settings/providers/:provider; on success refetch providers; show masked key
5. On Test: POST .../test; show inline result `"Connected ✓"` or `"Failed: [message]"` below button
6. On Remove: DELETE; refetch; reset input to empty

**Pattern reference**: Existing OpenAI key card section in `frontend/src/views/AccountSettings.tsx`

**Verify**:
- Level: inspection | Given: AccountSettings.tsx modified | Action: `npm run build` in frontend/ | Outcome: 0 TypeScript errors
- Level: inspection | Given: dev server running | Action: navigate to /settings | Outcome: Data Sources card renders below existing cards; no console errors
