---
bundle: 1
title: Foundation
stage: skeleton
parallel: no
depends_on: []
goal: Schema migration compiles with 4 new models; multer/csv-parse installed; import routes registered
---

# Bundle 1 — Foundation

**Goal**: Schema migration compiles with 4 new models and 3 new enums; multer + csv-parse installed; importRouter and platformProvidersRouter registered.

**Bundle Verify**: `npx prisma validate` exits 0; `npm run build` in api/ exits 0; Prisma client exposes `saleRecord`, `importBatch`, `userProviderConfig`, `platformProviderConfig` types.

---

## STEP-1: Extend Prisma schema — 4 models + 3 enums

**Trace**: [FR-4 → AC-4.2, AC-4.3] [FR-5 → AC-5.1] [FR-6 → AC-6.2, AC-6.5] [NFR-4]

**Files**:
- `api/prisma/schema.prisma` (modify)

**Effort**: M

**Intent**: The `@@unique([horseId, hipNumber, saleDate])` on SaleRecord is the idempotency guarantee — without it, re-importing the same CSV silently duplicates records. All four models land in one migration to satisfy FK relationships. `DataProvider` enum must be declared before UserProviderConfig and PlatformProviderConfig reference it.

**Implementation guidance**:
1. Add enums: `DataProvider` (`sporthorse_data | equibase | tjcis`), `ImportSource` (`csv | api`), `ImportStatus` (`processing | completed | failed`)
2. Add `SaleRecord` model: `id String @id @default(cuid())`, `horseId String`, `importBatchId String?`, `saleSource String`, `saleSessionName String?`, `saleDate DateTime`, `hipNumber String?`, `hammerPriceCents Int`, `buyerName String?`, `consignorName String?`, `providerRef String?`, `createdAt DateTime @default(now())`, relations to Horse and ImportBatch, `@@unique([horseId, hipNumber, saleDate])`, `@@index([horseId])`, `@@index([importBatchId])`
3. Add `ImportBatch` model: `id String @id @default(cuid())`, `importedByUserId String`, `source ImportSource`, `provider DataProvider?`, `sourceFileName String?`, `totalRows Int @default(0)`, `createdCount Int @default(0)`, `matchedCount Int @default(0)`, `errorCount Int @default(0)`, `status ImportStatus @default(processing)`, `errorLog Json @default("[]")`, `createdAt DateTime @default(now())`, relation to User (importedByUserId), `@@index([importedByUserId])`
4. Add `UserProviderConfig` model: `id String @id @default(cuid())`, `userId String`, `provider DataProvider`, `encryptedCredential String`, `testStatus String?`, `testedAt DateTime?`, `createdAt DateTime @default(now())`, relation to User, `@@unique([userId, provider])`, `@@index([userId])`
5. Add `PlatformProviderConfig` model: `provider DataProvider @id`, `encryptedCredential String`, `active Boolean @default(false)`, `testedAt DateTime?`, `createdAt DateTime @default(now())`
6. Run `npx prisma migrate dev --name add-sale-import-models`

> **Standards**: S-8 — `@@index` on all FK and frequent-query columns

**Verify**:
- Level: inspection | Given: schema.prisma modified | Action: `npx prisma validate` | Outcome: exits 0
- Level: inspection | Given: validate passes | Action: `npx prisma migrate dev --name add-sale-import-models` | Outcome: migration file created; client regenerated

---

## STEP-2: Install multer + csv-parse; register routes

**Trace**: MANUAL → package deps + route wiring for FR-1–FR-7

**Files**:
- `api/package.json` (modify)
- `api/src/index.ts` (modify)

**Effort**: XS

**Intent**: multer must use `memoryStorage()` — Render ephemeral filesystem means disk temp files don't survive restarts. The execute endpoint needs per-route 60s timeout override (AD-7 synchronous-at-launch decision).

**Implementation guidance**:
1. `cd api && npm install multer csv-parse && npm install -D @types/multer`
2. In `api/src/index.ts`: import and mount `importRouter` at `/api/import` and `platformProvidersRouter` at `/api/admin/platform-providers`
3. Create the import.ts and admin/platformProviders.ts files as empty router stubs (just `const router = Router(); export default router`) to satisfy the imports — actual implementation in later bundles

> **Standards**: none (structural wiring)

**Verify**:
- Level: inspection | Given: deps installed and routes registered | Action: `npm run build` in api/ | Outcome: TypeScript exits 0
