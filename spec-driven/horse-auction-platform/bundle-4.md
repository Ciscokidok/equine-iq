> Stage: Depth — Listing Frontend | Parallel: yes (file-disjoint from API depth bundles) | Files: frontend/src/views/CreateListing.tsx, frontend/src/api/auctions.ts

**Bundle Verify**: Seller can navigate to /auctions/create, fill in horse, upload documents, and configure auction settings through the UI
- **Level**: inspection
- **Given**: Frontend running with auth token
- **Action**: Navigate to /auctions/create; confirm horse selector renders EquineIQ horses, document upload fields show correct docType labels, configure form shows all auction fields
- **Outcome**: Form renders without errors, fields match AC-1.1 and AC-1.4 requirements

---

#### STEP-13: Create frontend CreateListing view + auction API hooks
[FR-1 -> AC-1.1, FR-1 -> AC-1.4, FR-1 -> AC-1.5] | create `frontend/src/views/CreateListing.tsx`, modify `frontend/src/api/auctions.ts` | Effort: M

> **Intent**: The listing creation flow has three stages: (1) select horse + upload vetting docs, (2) wait for admin approval, (3) configure auction settings once approved. The UI must reflect this staged flow — showing the configure form only when the listing status is `approved`. Document upload uses the presigned URL from the API: the browser POSTs to the presigned URL directly (not through the EquineIQ API). Progress state must handle the async S3 upload — the user should see upload progress, not a silent freeze. S-5 (React Query hooks) means all API calls go through hooks in `api/auctions.ts`, not inline fetch.

**Implementation guidance**:
- In `api/auctions.ts`: add `useCreateListing()` mutation (POST /api/listings), `useRequestUploadUrl()` mutation (POST /api/listings/:id/documents/upload-url), `useConfigureListing()` mutation (POST /api/listings/:id/configure), `useMyListings()` query (GET /api/listings/mine)
- `CreateListing.tsx`: multi-step form — Step 1: horse picker (useQuery for user's horses from existing `api/horses.ts`), docType file inputs for coggins_test + vet_certificate + registration_papers (required) + radiographs + endoscopy_video (optional)
- Upload flow: on file select, call `useRequestUploadUrl()` to get presigned URL, then `fetch(presignedUrl, { method: 'PUT', body: file })` directly — show upload progress via `XMLHttpRequest` or `onUploadProgress`
- Step 2 (after listing creation): show "Awaiting vetting review" status card
- Step 3 (status === approved): show configure form with startAt, durationMinutes, startingBid, reservePrice (optional), bidIncrement, reserveBehavior select, buyersPremiumPct
- Plain field validation (no zod — matching frontend pattern per project decision)

**Pattern reference**: `frontend/src/views/FoalTracker.tsx` (form + React Query mutation pattern)

**Verify clauses**:
- Level: inspection | Given: CreateListing rendered with approved listing | Action: verify configure form shows all AC-1.4 fields | Outcome: startAt, durationMinutes, startingBid, reservePrice, bidIncrement, reserveBehavior, buyersPremiumPct all present
- Level: inspection | Given: CreateListing rendered with pending_review listing | Action: check UI | Outcome: configure form NOT shown; "Awaiting review" message shown

> **Standards**: S-5

**Depends on**: STEP-6, STEP-8
**Enables**: STEP-26 (catalog shows listed horses), STEP-49
**Parallel with**: STEP-11, STEP-14, STEP-18, STEP-23, STEP-27, STEP-31
