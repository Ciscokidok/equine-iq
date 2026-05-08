# Bundle 2: Foal Auction Sale CRUD Routes

> Tasks: spec-driven/progeny-auction-sale-tracking/tasks.md | Bundle: 2 | Slice: 2 — CRUD API | Stage: depth
> Parallel: yes — can run in parallel with Bundle 3 (disjoint files: foals.ts vs auctionSaleStats.ts + stallions.ts)
> Depends on: Bundle 1
> Files: api/src/routes/foals.ts

**Bundle Verify**:
- **Level**: integration
- **Given**: Bundle 2 steps complete, dev server running
- **Action**: POST /api/foals/:id/auction-sales with `{salePrice:150000, saleDate:"2025-09-15", saleType:"yearling"}` for a foal owned by the authenticated user; then GET /api/foals/:id to confirm auctionSales is present
- **Outcome**: POST returns 201 with id, foalId, userId, salePrice:150000; GET /foals/:id response includes `auctionSales` array with the recorded sale

---

#### STEP-3: Implement POST /api/foals/:id/auction-sales
[FR-1 -> AC-1.1, AC-1.2, AC-1.3] | modify `api/src/routes/foals.ts` | Effort: M

> **Intent**: The foal ownership check must use `findFirst({ where: { id: foalId, userId } })` — not `findUnique` — so a foal owned by a different user returns 404 rather than leaking existence (per S-3: return 404, not 403, to avoid revealing record existence for other users). `salePrice` must be validated as `> 0` before any DB call (AC-1.3). `saleDate` arrives as an ISO string and must be converted to `new Date()` before Prisma — passing a raw string to a `DateTime` field causes a Prisma client runtime error. `userId` from the JWT is written both to the ownership check and to `AuctionSale.create` data block so the sale is user-scoped (AD-5).

> **Standards**: S-1 (requireAuth + getUserId before any DB access), S-2 (Zod validation before processing), S-3 (findFirst ownership check before mutation), S-4 (Prisma ORM)

- Define `AuctionSaleSchema` with Zod at the top of the handler (or alongside existing route schemas): `salePrice: z.number().positive()`, `saleDate: z.string().min(1)`, `saleType: z.enum(['weanling','yearling','two_year_old_in_training','mixed_age'])`, `auctionHouse: z.string().optional()`, `hipNumber: z.string().optional()`, `buyer: z.string().optional()`, `notes: z.string().optional()`
- Add `router.post('/:id/auction-sales', requireAuth, async (req, res) => { ... })`
- Call `getUserId(req)` immediately after `requireAuth`
- Ownership check: `const foal = await prisma.foal.findFirst({ where: { id: req.params.id, userId } })` → return 404 if null
- Validate: `AuctionSaleSchema.safeParse(req.body)` → return 400 with `error.flatten()` if invalid
- Create: `prisma.auctionSale.create({ data: { foalId: foal.id, userId, ...parsed, saleDate: new Date(parsed.saleDate) } })` → return 201 with created record
- Follow pattern: `api/src/routes/foals.ts` lines 110–128 (`POST /:id/results`)

**Verify**:
- Level: integration | Given: valid foal owned by user, valid body | Action: POST /api/foals/:id/auction-sales with {salePrice:150000, saleDate:"2025-09-15", saleType:"yearling"} | Outcome: 201 with id, foalId, userId, salePrice:150000, saleType:"yearling"
- Level: integration | Given: valid foal, salePrice=0 | Action: POST with {salePrice:0, saleDate:"2025-09-15", saleType:"yearling"} | Outcome: 400 with validation error referencing salePrice
- Level: integration | Given: valid foal, missing saleDate | Action: POST with {salePrice:150000, saleType:"yearling"} | Outcome: 400 with validation error
- Level: integration | Given: foal owned by a different user | Action: POST with valid body | Outcome: 404

> Depends on: STEP-2 | Enables: STEP-5, STEP-9 | Parallel with: STEP-4, STEP-6

---

#### STEP-4: Implement GET /api/foals/:id/auction-sales
[FR-2 -> AC-2.1, AC-2.2] | modify `api/src/routes/foals.ts` | Effort: S

> **Intent**: Returns `[]` for a foal with no sales — this is not an error condition and must not return 404 (AC-2.2). The ownership check still applies so a user cannot enumerate another user's foal sales by guessing foal IDs. Results are ordered `saleDate: 'desc'` per spec. No Zod validation needed (no request body on GET).

> **Standards**: S-1 (requireAuth + getUserId), S-4 (Prisma ORM)

- Add `router.get('/:id/auction-sales', requireAuth, async (req, res) => { ... })`
- `getUserId(req)` → `prisma.foal.findFirst({ where: { id: req.params.id, userId } })` → return 404 if null
- `prisma.auctionSale.findMany({ where: { foalId: req.params.id }, orderBy: { saleDate: 'desc' } })`
- Return 200 with the array (empty array is a valid 200 — do not treat it as 404)

**Verify**:
- Level: integration | Given: foal with 2 recorded sales | Action: GET /api/foals/:id/auction-sales | Outcome: 200 with array of 2 objects ordered by saleDate desc
- Level: integration | Given: foal with no sales | Action: GET /api/foals/:id/auction-sales | Outcome: 200 with `[]`
- Level: integration | Given: foal owned by different user | Action: GET | Outcome: 404

> Depends on: STEP-2 | Enables: STEP-9 | Parallel with: STEP-3, STEP-6

---

#### STEP-5: Extend GET /foals/:id to include auctionSales
[FR-2 -> AC-2.1, AC-2.2] | modify `api/src/routes/foals.ts` | Effort: XS

> **Intent**: N/A — structural step. The existing `GET /:id` handler uses a Prisma `include` block for related records. Adding `auctionSales` to that block delivers the contracts.md foal detail payload. An empty `auctionSales: []` is returned naturally by Prisma when no sales exist — no conditional logic required.

> **Standards**: S-4

- Locate `prisma.foal.findFirst({ where: ..., include: { ... } })` in the GET /:id handler
- Add `auctionSales: { orderBy: { saleDate: 'desc' } }` to the `include` block

**Verify**:
- Level: inspection | Given: GET /foals/:id handler modified | Action: inspect response shape | Outcome: `auctionSales` array key present; returns empty array when no sales exist, populated array when sales exist

> Depends on: STEP-2, STEP-3 | Enables: STEP-10 | Parallel with: STEP-6
