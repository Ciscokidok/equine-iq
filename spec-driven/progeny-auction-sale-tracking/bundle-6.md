# Bundle 6: StallionCompare Avg Auction Price Column (Nice to Have)

> Tasks: spec-driven/progeny-auction-sale-tracking/tasks.md | Bundle: 6 | Slice: 6 — Dashboard Enhancement | Stage: depth
> Parallel: no
> Depends on: Bundle 5 (needs STEP-9 for useStallionSaleStats hook)
> Priority: Nice to Have (FR-6) — execute only after Bundles 1–5 are complete and verified
> Files: frontend/src/views/StallionCompare.tsx

**Bundle Verify**:
- **Level**: inspection
- **Given**: Bundle 6 complete
- **Action**: `npm run build` in frontend/
- **Outcome**: Compiles clean; StallionCompare.tsx has no TypeScript errors

---

#### STEP-12: Add sortable Avg Auction Price column to StallionCompare.tsx
[FR-6 -> AC-6.1, AC-6.2] | modify `frontend/src/views/StallionCompare.tsx` | Effort: S

> **Intent**: `StallionCompare.tsx` already exists as a registered view — this step is purely additive (F-7). The column must be sortable per AC-6.1 — use the same sort toggle pattern already present in the comparison table for other columns. When a stallion in the comparison set has `avg === null` (no sales), the cell shows "—", not 0 or null (null would break sorting; 0 would mislead). The panel-level empty state (AC-6.2) applies when every stallion in the set has `count === 0` — render a prompt ("Record auction sales to compare performance") rather than a column of dashes.

- Import `useStallionSaleStats` from `../api/auctionSales`
- For each stallion in the comparison set, call `useStallionSaleStats(stallion.id)` (one hook per stallion — the view already iterates stallions)
- Add "Avg Auction Price" as a sortable column header with ascending/descending toggle; use `null`-safe sort (nulls last)
- Format cell value as `$N,NNN` when `avg != null`; render "—" when `avg === null`
- Panel-level empty state: if all stallions have `count === 0`, render a prompt row: "No auction data — record sales to compare performance"
- Follow pattern: existing sortable column headers in `frontend/src/views/StallionCompare.tsx`

**Verify**:
- Level: inspection | Given: StallionCompare.tsx modified | Action: `npm run build` in frontend/ | Outcome: compiles clean; no TypeScript errors
- Level: e2e | Given: comparison set with stallions having different sale counts | Action: navigate to StallionCompare | Outcome: "Avg Auction Price" column visible and sortable; "—" for stallions with no data; stallions with data show formatted USD
- Level: e2e | Given: all stallions in comparison set have no sales | Action: navigate to StallionCompare | Outcome: empty-state prompt renders instead of column of dashes

> Depends on: STEP-9 | Enables: — | Parallel with: —
