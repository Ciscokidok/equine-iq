# Bundle 1: Schema Foundation

> Tasks: spec-driven/progeny-auction-sale-tracking/tasks.md | Bundle: 1 | Slice: 1 — Schema Foundation | Stage: skeleton
> Parallel: no — must complete before all other bundles
> Files: api/prisma/schema.prisma, api/prisma/migrations/

**Bundle Verify**:
- **Level**: inspection
- **Given**: Bundle 1 steps complete
- **Action**: Run `npx prisma migrate status` from api/ and `npx prisma generate`
- **Outcome**: All migrations show as Applied; `npx prisma generate` exits 0 with `PrismaClient.auctionSale` accessible

---

#### STEP-1: Add AuctionSaleType enum and AuctionSale model to Prisma schema
[FR-1 -> AC-1.1, AC-1.2] | modify `api/prisma/schema.prisma` | Effort: M

> **Intent**: The schema is the single source of truth for the Prisma client — every downstream route handler fails to compile until this step lands. The `AuctionSaleType` enum must be declared before the `AuctionSale` model (Prisma parses top-to-bottom). `userId` is stored directly on `AuctionSale` (not derived via Foal join) so stats endpoints can filter by user without an additional join to the Foal table (AD-5). The `onDelete: Cascade` on the foal relation ensures orphaned sales are purged when a foal is deleted. Both sides of every Prisma relation must be declared — the `Foal` model needs `auctionSales AuctionSale[]` and the `User` model needs `auctionSales AuctionSale[]` or Prisma validation will fail.

> **Standards**: S-4 (Prisma ORM; schema is the authoritative model definition)

- Add `AuctionSaleType` enum with values: `weanling`, `yearling`, `two_year_old_in_training`, `mixed_age`
- Add `AuctionSale` model: `id String @id @default(uuid())`, `foalId String`, `userId String`, `salePrice Float`, `saleDate DateTime`, `saleType AuctionSaleType`, `auctionHouse String?`, `hipNumber String?`, `buyer String?`, `notes String?`, `createdAt DateTime @default(now())`
- Add relations: `foal Foal @relation(fields: [foalId], references: [id], onDelete: Cascade)` and `user User @relation(fields: [userId], references: [id])`
- Add indexes: `@@index([foalId])`, `@@index([userId])`, `@@index([userId, saleDate])` — the compound index supports user-scoped stats queries that filter and order by date
- Add back-relation to `Foal` model: `auctionSales AuctionSale[]`
- Add back-relation to `User` model: `auctionSales AuctionSale[]`
- Follow pattern: existing `FoalResult` model and its back-relation on `Foal`

**Verify**:
- Level: inspection | Given: schema.prisma modified | Action: run `npx prisma validate` from api/ | Outcome: exits 0 with no validation errors
- Level: inspection | Given: AuctionSale model added | Action: inspect schema | Outcome: all 3 indexes present; `onDelete: Cascade` on foal relation; `userId` field is non-nullable; both Foal and User have back-relations

> Depends on: — | Enables: STEP-2 | Parallel with: —

---

#### STEP-2: Generate Prisma migration and client
[FR-1 -> AC-1.1] | create `api/prisma/migrations/YYYYMMDD_add_auction_sale/migration.sql` | Effort: XS

> **Intent**: N/A — structural step. The migration must be committed alongside schema.prisma so that Render's deployment pipeline applies it automatically on next deploy. The Prisma client is regenerated as a side-effect, making `prisma.auctionSale` available at compile time for all subsequent route handlers.

> **Standards**: S-4

- From the `api/` directory, run: `npx prisma migrate dev --name add_auction_sale`
- Inspect the generated migration SQL to confirm `CREATE TABLE "AuctionSale"` with all 10 columns and 3 `CREATE INDEX` statements
- Verify `npx prisma generate` exits 0 and `PrismaClient.auctionSale` is accessible in TypeScript

**Verify**:
- Level: inspection | Given: migration runs | Action: inspect generated migration.sql | Outcome: `CREATE TABLE "AuctionSale"` with all columns; 3 CREATE INDEX statements matching schema indexes
- Level: inspection | Given: migration completes | Action: run `npx tsc --noEmit` in api/ | Outcome: exits 0 — `prisma.auctionSale` resolves without type errors

> Depends on: STEP-1 | Enables: STEP-3, STEP-4, STEP-5, STEP-6, STEP-7, STEP-8 | Parallel with: —
