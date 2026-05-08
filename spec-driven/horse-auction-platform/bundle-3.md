> Stage: Depth — Listing & Vetting API | Parallel: yes (file-disjoint from lifecycle, bidding, catalog bundles) | Files: api/src/lib/s3Upload.ts, api/src/routes/listings.ts, api/src/routes/admin/vetting.ts

**Bundle Verify**: Seller can create a listing, receive presigned S3 upload URLs, configure auction settings, and admin can approve/reject through the vetting queue
- **Level**: integration
- **Given**: DB migrated, valid JWT for seller user, admin JWT available
- **Action**: POST /api/listings (horse select) → POST /api/listings/:id/documents/upload-url → POST /api/listings/:id/configure → GET /api/admin/vetting/queue → POST /api/admin/vetting/:id/approve
- **Outcome**: Listing progresses from pending_review → approved → scheduled; seller JWT cannot access admin queue (403)

---

#### STEP-7: Create S3 presigned upload/download utility
[FR-1 -> AC-1.1] | create `api/src/lib/s3Upload.ts` | Effort: S

> **Intent**: The browser uploads directly to S3 via a short-lived presigned PUT URL — no document bytes flow through Express (AD-3). The S3 key structure must encode `listingId` and `docType` to enable predictable access patterns without a DB lookup: `listings/{listingId}/{docType}/{uuid}`. Presigned GET URLs must have a short expiry (15 minutes) so a leaked URL cannot be shared for long-term access — NFR-2 requires sensitive vet docs to be access-controlled. The `AWS_S3_BUCKET` and `AWS_REGION` env vars must be present — the function should throw at startup if either is missing, not silently fail at request time.

**Implementation guidance**:
- Use `@aws-sdk/client-s3` S3Client and `@aws-sdk/s3-request-presigner` getSignedUrl
- Export `getPresignedUploadUrl(listingId: string, docType: string, fileName: string, mimeType: string): Promise<{ uploadUrl: string; s3Key: string }>` — presigned PUT, 15-min expiry, ContentType set
- Export `getPresignedDownloadUrl(s3Key: string): Promise<string>` — presigned GET, 15-min expiry
- Initialize S3Client at module load; validate `process.env.AWS_S3_BUCKET` and `process.env.AWS_REGION` are present; throw `Error('AWS_S3_BUCKET and AWS_REGION are required')` if missing
- S3 key format: `listings/${listingId}/${docType}/${Date.now()}-${sanitizedFileName}`

**Pattern reference**: `api/src/lib/auth.ts` (module-level initialization with env validation)

**Verify clauses**:
- Level: unit | Given: `AWS_S3_BUCKET` env var missing | Action: import `s3Upload.ts` | Outcome: throws `'AWS_S3_BUCKET and AWS_REGION are required'`
- Level: inspection | Given: `getPresignedUploadUrl` called | Action: check the returned URL | Outcome: URL contains the correct bucket name and key prefix `listings/{listingId}/`

> **Standards**: S-1, S-2

**Depends on**: STEP-1
**Enables**: STEP-9
**Parallel with**: STEP-8, STEP-11

---

#### STEP-8: Implement listing creation route
[FR-1 -> AC-1.1, FR-1 -> AC-1.5] | modify `api/src/routes/listings.ts` | Effort: S

> **Intent**: The listing creation endpoint must verify the horse exists *and* belongs to the requesting user (via `createdByUser` FK) — a seller should not be able to list another user's horse. AC-1.5 allows any horse type (foal, mare, stallion) — the route must not filter by `sex`. The created `AuctionListing` starts with `status: 'pending_review'` (never jump to approved, per the vetting workflow in FR-1/FR-10). The listing record links to the `Horse` by `horseId` and to the `User` by `sellerId`.

**Implementation guidance**:
- Schema: `{ horseId: z.string().uuid() }` — validate with zod
- Check `prisma.horse.findFirst({ where: { id: horseId, createdByUser: userId } })` — return 404 if not found (don't reveal other users' horses exist)
- Create `AuctionListing` with `{ horseId, sellerId: userId, status: 'pending_review' }`
- Return 201 with the created listing
- No auction config (startAt, reservePrice, etc.) at creation — that happens in STEP-10's configure endpoint

**Pattern reference**: `api/src/routes/foals.ts` (ownership check pattern)

**Verify clauses**:
- Level: integration | Given: authenticated user with horse they own | Action: POST /api/listings with valid horseId | Outcome: 201, listing created with status pending_review
- Level: integration | Given: authenticated user trying to list another user's horse | Action: POST /api/listings with that horseId | Outcome: 404 (not 403 — don't reveal ownership)

> **Standards**: S-1, S-2

**Depends on**: STEP-5
**Enables**: STEP-9, STEP-10
**Parallel with**: STEP-7, STEP-11

---

#### STEP-9: Implement document upload URL endpoint
[FR-1 -> AC-1.1] | modify `api/src/routes/listings.ts` | Effort: S

> **Intent**: The presigned URL endpoint must verify the listing belongs to the requesting seller before issuing an upload URL — otherwise any authenticated user can upload documents to any listing. The `VettingDocument` record is created with `scanStatus: 'pending_scan'` at URL issuance time (not at upload confirmation) — S3 EventBridge will update the scan status asynchronously. For MVP, the Lambda ClamAV scan is stubbed: documents are created with `scanStatus: 'clean'` directly (per design AD-3 stub note). The `docType` must be one of the `VettingDocType` enum values.

**Implementation guidance**:
- Validate request: `{ docType: z.enum(['coggins_test', 'vet_certificate', 'registration_papers', 'radiographs', 'endoscopy_video']), fileName: z.string(), mimeType: z.string() }`
- Check listing ownership: `prisma.auctionListing.findFirst({ where: { id, sellerId: userId } })` — 404 if not found
- Check listing status is `pending_review` — 400 if not (can't upload docs after approval)
- Call `getPresignedUploadUrl(listingId, docType, fileName, mimeType)` from STEP-7
- Create `VettingDocument` record with `{ listingId, docType, s3Key, fileName, scanStatus: 'clean' }` (MVP stub — no Lambda scan yet)
- Return `{ uploadUrl, documentId }`

**Pattern reference**: `api/src/lib/s3Upload.ts` (STEP-7)

**Verify clauses**:
- Level: integration | Given: listing in pending_review owned by user | Action: POST /api/listings/:id/documents/upload-url with valid docType | Outcome: 200 with uploadUrl (contains S3 bucket) and documentId
- Level: integration | Given: listing belongs to different user | Action: same request | Outcome: 404

> **Standards**: S-1, S-2

**Depends on**: STEP-7, STEP-8
**Enables**: STEP-11 (docs must exist before vetting review)
**Parallel with**: STEP-11

---

#### STEP-10: Implement listing configure and cancel endpoints
[FR-1 -> AC-1.4] | modify `api/src/routes/listings.ts` | Effort: S

> **Intent**: The configure endpoint transitions an `approved` listing to `scheduled` by setting auction timing and pricing. It must reject configuration on listings that are not in `approved` status — a seller cannot reconfigure a listing that is already `open` or `sold`. The `startAt` must be in the future; `endsAt = startAt + durationMinutes`. The `reservePrice` is optional (no-reserve auction). `buyersPremiumPct` defaults to 10 if not provided, per AD-4. `bidIncrement` must be a positive integer in cents. The configure endpoint is the only place auction timing is set — the cron tick (STEP-15) reads `startAt` and `endsAt` directly.

**Implementation guidance**:
- Schema: `{ startAt: z.string().datetime(), durationMinutes: z.number().int().positive(), startingBid: z.number().int().positive(), reservePrice: z.number().int().positive().optional(), bidIncrement: z.number().int().positive(), reserveBehavior: z.enum(['auto_pass','seller_decision','counter_offer']).default('auto_pass'), buyersPremiumPct: z.number().min(0).max(50).default(10) }`
- Check listing status === `'approved'`; 400 if not
- Validate `new Date(startAt) > new Date()` — 400 if start is in the past
- Create `Auction` record with `{ listingId, status: 'scheduled', startAt, endsAt: addMinutes(startAt, durationMinutes) }` (use `date-fns` or manual `Date` arithmetic — no extra deps)
- Update `AuctionListing` status to `'scheduled'`
- Return 200 with updated listing

**Pattern reference**: `api/src/routes/stallions.ts` (update pattern)

**Verify clauses**:
- Level: integration | Given: listing in approved status | Action: POST /api/listings/:id/configure with valid config | Outcome: listing status becomes scheduled, Auction record created with correct startAt/endsAt
- Level: integration | Given: listing in pending_review (not yet approved) | Action: configure request | Outcome: 400 with error message

> **Standards**: S-1, S-2

**Depends on**: STEP-8
**Enables**: STEP-14 (cron reads Auction.startAt)
**Parallel with**: STEP-9, STEP-11

---

#### STEP-11: Implement vetting admin queue and approve/reject endpoints
[FR-10 -> AC-10.1, FR-10 -> AC-10.2, FR-10 -> AC-10.3, FR-1 -> AC-1.2, FR-1 -> AC-1.3] | modify `api/src/routes/admin/vetting.ts` | Effort: S

> **Intent**: The vetting queue must only show listings where required documents (Coggins test, vet certificate, registration papers — AC-10.3) have been uploaded and scanned clean. A listing missing required docs should not appear in the queue — admin should not have to determine document completeness themselves. On approval, the listing transitions to `approved` and the seller is notified (AC-1.2). On rejection, the `vetRejectionReason` is stored and the seller is notified (AC-1.3) — the seller can resubmit. Approval/rejection are idempotent: calling approve on an already-approved listing returns 200 without a second transition.

**Implementation guidance**:
- GET `/queue`: query listings where `status = 'pending_review'`, include `documents` relation filtered to `scanStatus = 'clean'`; only return listings where all three required docTypes are present (`coggins_test`, `vet_certificate`, `registration_papers`)
- POST `/:id/approve`: check status is `pending_review`; update `AuctionListing` to `{ status: 'approved', vetReviewedBy: adminUserId, vetReviewedAt: now() }`; send seller notification (stub for now — `console.log` until STEP-39)
- POST `/:id/reject`: validate `{ reason: z.string().min(1) }`; update listing to `{ status: 'rejected', vetRejectionReason: reason, vetReviewedBy, vetReviewedAt }`; send seller notification stub
- Both approve/reject: return 200 if listing is already in the target state (idempotent)

**Pattern reference**: `api/src/routes/admin/vetting.ts` skeleton from STEP-5

**Verify clauses**:
- Level: integration | Given: listing in pending_review with all 3 required docs uploaded | Action: GET /api/admin/vetting/queue | Outcome: listing appears in queue
- Level: integration | Given: listing in pending_review | Action: POST /api/admin/vetting/:id/approve with admin JWT | Outcome: listing status becomes approved
- Level: integration | Given: same approve called twice | Action: second approve | Outcome: 200 (idempotent, no double transition)

> **Standards**: S-1, S-3 (admin middleware)

**Depends on**: STEP-4, STEP-5, STEP-9
**Enables**: STEP-10 (seller can configure after approval), STEP-12
**Parallel with**: STEP-7, STEP-8

---

#### STEP-12: Test — listing creation, document upload URL, vetting queue, approve/reject
MANUAL -> Test for STEP-8, STEP-9, STEP-10, STEP-11 | create `api/tests/listings.test.ts` | Effort: M

> **Intent**: The listing flow has three ownership checks that must all be tested: seller cannot list another user's horse, seller cannot upload docs to another user's listing, non-admin cannot access vetting queue. The vetting queue "required docs present" filter is a critical business rule — a missing doc should keep the listing out of the queue even if other docs are present. Test the idempotency of approve (calling twice should not error or double-transition).

**Implementation guidance**:
- Use `vitest` or existing test framework pattern; seed test DB with two users, two horses
- Test 1: seller A cannot list seller B's horse (expects 404)
- Test 2: listing creation succeeds → upload URL endpoint returns presigned URL with correct key prefix
- Test 3: listing with only coggins_test uploaded does NOT appear in vetting queue (missing vet_certificate)
- Test 4: listing with all 3 required docs appears in vetting queue
- Test 5: approve transitions to `approved`; second approve returns 200 without error
- Test 6: non-admin JWT on GET /queue returns 403

**Pattern reference**: existing test files in `api/tests/` (if any)

**Verify clauses**:
- Level: integration | Given: test suite for listing flow | Action: `npm test` | Outcome: all 6 test cases pass

> **Standards**: S-1

**Depends on**: STEP-8, STEP-9, STEP-10, STEP-11
**Enables**: —
**Parallel with**: STEP-13
