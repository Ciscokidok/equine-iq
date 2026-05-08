> Stage: Depth — Admin Frontend | Parallel: yes (file-disjoint from all other frontend bundles) | Files: frontend/src/views/admin/VettingQueue.tsx, frontend/src/views/admin/BidderApproval.tsx, frontend/src/api/auctions.ts

**Bundle Verify**: Admin can view vetting queue, open vet documents, approve/reject listings; admin can view pending bidders and approve/confirm deposits
- **Level**: inspection
- **Given**: Admin user logged in, listing in pending_review with 3 clean docs, bidder in pending approval
- **Action**: Navigate to /admin/vetting; click listing; open document; click Approve; navigate to /admin/bidders; click Approve Bidder
- **Outcome**: Listing transitions to approved; bidder transitions to approved; both update in UI without page reload

---

#### STEP-42: Create frontend VettingQueue admin view
[FR-10 -> AC-10.1, FR-10 -> AC-10.2, FR-10 -> AC-10.3] | create `frontend/src/views/admin/VettingQueue.tsx`, modify `frontend/src/api/auctions.ts` | Effort: M

> **Intent**: The vetting queue shows listings where all required documents are present and scanned clean (AC-10.3). Document download links open presigned URLs — these are short-lived (15 min) and should be fetched on-demand (not stored in component state for longer than the session). The approve/reject mutation must optimistically update the queue (remove the approved listing) so the admin doesn't see stale state. Rejection requires a reason input.

**Implementation guidance**:
- In `api/auctions.ts`: add `useVettingQueue()` — GET /api/admin/vetting/queue; `useApproveVetting()`, `useRejectVetting(reason)` mutations with `queryClient.invalidateQueries(['vetting-queue'])` on success
- `VettingQueue.tsx`: table of listings with horse name, seller, uploaded docs list with download links
- Document links: fetch presigned URL from `GET /api/documents/:id/url` (add this endpoint — GET route in listings.ts that calls `getPresignedDownloadUrl(doc.s3Key)` with auth check)
- Approve button: mutation + optimistic remove; Reject button: text input for reason + submit
- Admin-only route — if user.role !== 'admin' render "Access denied"

**Pattern reference**: `frontend/src/views/Pairings.tsx`

**Verify clauses**:
- Level: inspection | Given: admin viewing VettingQueue | Action: listing with all 3 required docs | Outcome: listing appears; Approve and Reject buttons visible
- Level: inspection | Given: non-admin user | Action: navigate to /admin/vetting | Outcome: "Access denied" message rendered

> **Standards**: S-5, S-3

**Depends on**: STEP-6, STEP-11
**Enables**: —
**Parallel with**: STEP-43

---

#### STEP-43: Create frontend BidderApproval admin view
[FR-3 -> AC-3.3, FR-3 -> AC-3.4] | create `frontend/src/views/admin/BidderApproval.tsx`, modify `frontend/src/api/auctions.ts` | Effort: S

> **Intent**: The bidder approval queue shows pending `BidderApproval` records with associated user or guest bidder details. Deposit confirmation (`PATCH /deposit-confirmed`) and approval (`POST /approve`) are separate actions — admin may confirm deposit first, which auto-approves, or manually approve without a deposit. The "Suspend" action must show a confirmation before firing (irreversible action for the bidder — they lose ability to bid immediately).

**Implementation guidance**:
- In `api/auctions.ts`: add `usePendingBidders()` — GET /api/admin/bidders/pending; `useApproveBidder()`, `useSuspendBidder()`, `useConfirmDeposit()` mutations
- `BidderApproval.tsx`: table with bidder name/email, deposit amount (if any), deposit reference, actions: "Confirm Deposit" + "Approve" + "Suspend"
- Suspend: confirm dialog `window.confirm('Suspend this bidder? They will be unable to place bids immediately.')` before firing mutation

**Pattern reference**: `frontend/src/views/admin/VettingQueue.tsx` (STEP-42)

**Verify clauses**:
- Level: inspection | Given: pending bidder in queue | Action: click Approve | Outcome: mutation fires, bidder removed from pending queue

> **Standards**: S-5, S-3

**Depends on**: STEP-6, STEP-22
**Enables**: —
**Parallel with**: STEP-42
