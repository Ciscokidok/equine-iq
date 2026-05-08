> Stage: Depth — Auction Catalog API | Parallel: yes (file-disjoint from listing, lifecycle, bidding bundles) | Files: api/src/routes/auctions.ts

**Bundle Verify**: Public catalog returns scheduled/open auctions with correct fields and filters apply; auction detail includes full horse passport data
- **Level**: integration
- **Given**: DB with 3 auctions (1 open thoroughbred, 1 scheduled warmblood, 1 sold); no auth token
- **Action**: GET /api/auctions/catalog; GET /api/auctions/catalog?breed=thoroughbred; GET /api/auctions/:id
- **Outcome**: Catalog returns 2 auctions (open + scheduled), filter returns 1, detail includes horse pedigree and conformationNotes

---

#### STEP-23: Implement public auction catalog route
[FR-6 -> AC-6.1, FR-6 -> AC-6.2] | modify `api/src/routes/auctions.ts` | Effort: S

> **Intent**: The catalog is unauthenticated (AD-7) — no `requireAuth`. It returns only `scheduled` and `open` auctions (not sold/passed/pending_review). Filter params (`breed`, `discipline`, `status`, `minPrice`, `maxPrice`) must be validated against known enum values before being used in WHERE clauses — an invalid `discipline` value should return 400, not a Prisma runtime error. Price filter compares against `auction.currentBid` (or `startingBid` if no bids yet). The `currentBid` returned is in cents — the frontend formats to USD (S-2).

**Implementation guidance**:
- No `requireAuth` middleware on this route
- Query: `prisma.auction.findMany({ where: { status: { in: ['scheduled', 'open'] }, ... }, include: { listing: { include: { horse: { select: { name, breed, discipline, ... } } } } }, orderBy: { startAt: 'asc' } })`
- Filter params: `breed` (string), `discipline` (Discipline enum — validate with zod enum), `status` ('scheduled' | 'open'), `minPrice` (Int), `maxPrice` (Int)
- Response shape per auction: `{ id, status, currentBid, startingBid, bidIncrement, buyersPremiumPct, startAt, endsAt, horse: { name, breed, discipline }, photoUrl (null for MVP) }`
- Invalid discipline value: zod parse failure → 400

**Pattern reference**: `api/src/routes/stallions.ts` (public list endpoint)

**Verify clauses**:
- Level: integration | Given: no auth token, 2 open auctions in DB | Action: GET /api/auctions/catalog | Outcome: 200 with 2 auctions (auth not required)
- Level: integration | Given: catalog with breed filter 'thoroughbred' | Action: GET /api/auctions/catalog?breed=thoroughbred | Outcome: only thoroughbred auctions returned
- Level: integration | Given: invalid discipline query param 'badvalue' | Action: GET /api/auctions/catalog?discipline=badvalue | Outcome: 400

> **Standards**: S-1, S-2

**Depends on**: STEP-5
**Enables**: STEP-25, STEP-26
**Parallel with**: STEP-13, STEP-14, STEP-18, STEP-27, STEP-31

---

#### STEP-24: Implement auction detail route with horse passport
[FR-6 -> AC-6.3] | modify `api/src/routes/auctions.ts` | Effort: S

> **Intent**: The auction detail response includes the "full horse passport" (AC-6.3): pedigree, conformationNotes, vet documents summary, and performance history from EquineIQ records. Vet documents must be served as presigned GET URLs (not raw S3 keys) — the route calls `getPresignedDownloadUrl(doc.s3Key)` for each document. Document URLs are regenerated on each request (15-min expiry). Only `clean`-scanned documents are included in the response (never `pending_scan` or `rejected`). This route is also unauthenticated.

**Implementation guidance**:
- Include: `{ auction, listing: { horse: { pedigree, conformationNotes, performanceRecords, ... } }, documents: (clean only) }` 
- Map each clean document: `{ docType, fileName, downloadUrl: await getPresignedDownloadUrl(doc.s3Key) }`
- Include bid history (last 10 bids) with anonymized bidder initials
- If auction not found: 404 (auth not required, so don't expose existence of non-catalog auctions — only return 200 for scheduled/open/sold; 404 for pending_review/rejected)
- Compute `timeRemainingSeconds = Math.max(0, (endsAt - Date.now()) / 1000)` for open auctions

**Pattern reference**: `api/src/routes/stallions.ts`

**Verify clauses**:
- Level: integration | Given: open auction with horse that has pedigree and conformationNotes | Action: GET /api/auctions/:id | Outcome: response includes horse.pedigree, horse.conformationNotes, documents array with downloadUrl
- Level: integration | Given: auction in pending_review status | Action: GET /api/auctions/:id | Outcome: 404

> **Standards**: S-1, S-2

**Depends on**: STEP-7, STEP-23
**Enables**: STEP-25, STEP-36
**Parallel with**: —

---

#### STEP-25: Test — catalog filters and horse passport
MANUAL -> Test for STEP-23, STEP-24 | create `api/tests/catalog.test.ts` | Effort: S

> **Intent**: The filter validation (invalid discipline → 400) is a security boundary — without it, an attacker can craft a discipline value that causes a Prisma runtime crash. The presigned URL generation in the detail response depends on `AWS_S3_BUCKET` being set — tests must mock the S3 client or set a test bucket env var. Test that pending_review auctions are NOT accessible via the detail route (AC-6.3 only covers scheduled/open auctions).

**Implementation guidance**:
- Mock `@aws-sdk/client-s3` S3Client in tests to return predictable presigned URLs
- Test 1: catalog returns only scheduled/open auctions (not sold/pending)
- Test 2: breed filter narrows results
- Test 3: invalid discipline param → 400
- Test 4: detail route returns horse pedigree and conformationNotes
- Test 5: detail route returns documents with downloadUrl (mocked S3)
- Test 6: pending_review auction → detail route 404

**Verify clauses**:
- Level: integration | Given: catalog test suite | Action: `npm test` | Outcome: all 6 cases pass

> **Standards**: S-1

**Depends on**: STEP-23, STEP-24
**Enables**: —
**Parallel with**: STEP-26
