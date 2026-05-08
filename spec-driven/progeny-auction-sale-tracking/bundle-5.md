# Bundle 5: Frontend Core

> Tasks: spec-driven/progeny-auction-sale-tracking/tasks.md | Bundle: 5 | Slice: 5 — Frontend Core | Stage: depth
> Parallel: no
> Depends on: Bundle 2 + Bundle 3
> Files: frontend/src/api/auctionSales.ts, frontend/src/views/FoalTracker.tsx, frontend/src/views/StallionDetail.tsx

**Bundle Verify**:
- **Level**: inspection
- **Given**: Bundle 5 steps complete
- **Action**: `npm run build` in frontend/
- **Outcome**: Build exits 0 with no TypeScript errors; FoalTracker.tsx and StallionDetail.tsx render without import errors

---

#### STEP-9: Create frontend/src/api/auctionSales.ts
[FR-1 -> AC-1.1; FR-2 -> AC-2.1; FR-3 -> AC-3.1] | create `frontend/src/api/auctionSales.ts` | Effort: S

> **Intent**: Three hooks cover the full frontend data layer for this feature. Query key design matters: `useAddAuctionSale` must invalidate `['auction-sales', foalId]` on success so the list refreshes automatically without a manual refetch. The `useStallionSaleStats` hook must be enabled only when `stallionId` is truthy to avoid a query on unmounted components. Sonner toast calls on mutation success/error are consistent with all other mutation hooks in the codebase (F-8) — do not use alert() or console.log.

- Import `useQuery`, `useMutation`, `useQueryClient` from `@tanstack/react-query`; `toast` from `sonner`; `apiClient` from `./client`
- `useAuctionSales(foalId: string)`: `useQuery({ queryKey: ['auction-sales', foalId], queryFn: () => apiClient.get(\`/foals/\${foalId}/auction-sales\`).then(r => r.data) })`
- `useAddAuctionSale()`: `useMutation` with `mutationFn: ({ foalId, data }) => apiClient.post(\`/foals/\${foalId}/auction-sales\`, data).then(r => r.data)`; `onSuccess`: `queryClient.invalidateQueries({ queryKey: ['auction-sales'] })` + `toast.success('Sale recorded')`; `onError`: `toast.error('Failed to record sale')`
- `useStallionSaleStats(stallionId: string, mareId?: string)`: `useQuery({ queryKey: ['stallion-sale-stats', stallionId, mareId], queryFn: () => apiClient.get(\`/stallions/\${stallionId}/auction-sale-stats\`, { params: mareId ? { mareId } : {} }).then(r => r.data), enabled: !!stallionId })`
- Follow pattern: `frontend/src/api/foals.ts` (existing useQuery/useMutation hooks)

**Verify**:
- Level: inspection | Given: auctionSales.ts created | Action: `npm run build` in frontend/ | Outcome: TypeScript compiles with no errors; no unused imports

> Depends on: STEP-3, STEP-4, STEP-7 | Enables: STEP-10, STEP-11, STEP-12 | Parallel with: STEP-8

---

#### STEP-10: Add Auction Sales section to FoalTracker.tsx
[FR-2 -> AC-2.1, AC-2.2] | modify `frontend/src/views/FoalTracker.tsx` | Effort: M

> **Intent**: Two sub-features here: (1) list rendering all recorded sales, (2) a "Record Sale" inline form. The empty state (AC-2.2) must show a prompt encouraging the first sale — not an error message, not a spinner. The form uses react-hook-form + zod resolver consistent with existing form patterns (F-8); do not use uncontrolled inputs. `salePrice` must be registered as a number (react-hook-form coerces strings by default — use `valueAsNumber: true` or `z.coerce.number()`). The form section should be toggleable (show/hide) to avoid layout bloat on the foal detail page.

- Import `useAuctionSales`, `useAddAuctionSale` from `../api/auctionSales`
- Import `useForm` from `react-hook-form`; `zodResolver` from `@hookform/resolvers/zod`
- Define client-side Zod schema: `salePrice: z.coerce.number().positive()`, `saleDate: z.string().min(1)`, `saleType: z.enum([...])`, optional string fields for auctionHouse/hipNumber/buyer/notes
- Add "Auction Sales" section card below existing foal metadata (do not replace existing sections)
- Empty state: when `auctionSales.length === 0`, render "No sales recorded" message with "Record Sale" button
- Populated state: render each sale as a row showing saleDate, salePrice (USD formatted), saleType, auctionHouse if present
- "Record Sale" button toggles form visibility; on submit call `addSale.mutate({ foalId, data: formValues })`; close form on success
- Follow pattern: existing section card structure in FoalTracker.tsx; form pattern from `frontend/src/views/MareForm.tsx`

**Verify**:
- Level: inspection | Given: FoalTracker.tsx modified | Action: `npm run build` | Outcome: compiles clean
- Level: e2e | Given: foal detail page with no sales | Action: navigate to foal detail | Outcome: "Auction Sales" section visible with empty state prompt and "Record Sale" button
- Level: e2e | Given: "Record Sale" form submitted with valid required fields | Action: fill salePrice, saleDate, saleType and submit | Outcome: new sale appears in list; sonner toast fires with "Sale recorded"

> Depends on: STEP-5, STEP-9 | Enables: — | Parallel with: STEP-11

---

#### STEP-11: Add Progeny Sale Stats card to StallionDetail.tsx
[FR-3 -> AC-3.1, AC-3.2] | modify `frontend/src/views/StallionDetail.tsx` | Effort: S

> **Intent**: Two states must render gracefully: (1) `count > 0` — show avg/median/high/low formatted as USD; (2) `count === 0` — show "No auction data recorded" placeholder. The `lowSampleWarning` flag from FR-4 surfaces here as a small inline warning note — this is the only place in the UI where that flag appears, so it must be visible but not alarming. Do not throw an error or show a spinner on the empty state.

- Import `useStallionSaleStats` from `../api/auctionSales`
- Add "Progeny Sale Stats" card section to the stallion detail view
- When `data?.count === 0`: render "No auction data recorded" placeholder text
- When `data?.count > 0`: render a 2×2 grid with Avg, Median, High, Low — format as `$N,NNN` using `toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })`
- Add inline low-sample warning: `{data.lowSampleWarning && <p className="text-xs text-yellow-600">Low sample — fewer than 3 sales</p>}`
- Follow pattern: existing card section structure in `frontend/src/views/StallionDetail.tsx`

**Verify**:
- Level: inspection | Given: StallionDetail.tsx modified | Action: `npm run build` | Outcome: compiles clean
- Level: e2e | Given: stallion with 5 recorded progeny sales | Action: navigate to stallion detail | Outcome: stats card shows avg/median/high/low formatted as USD; no warning
- Level: e2e | Given: stallion with no sales | Action: navigate to stallion detail | Outcome: "No auction data recorded" placeholder renders; no console errors

> Depends on: STEP-9 | Enables: — | Parallel with: STEP-10
