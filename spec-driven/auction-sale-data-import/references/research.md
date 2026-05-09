# Research: auction-sale-data-import

## Aspect 1 — Credential Storage Pattern

**Question**: What approach should we use to store per-user provider API credentials given the existing encryption infrastructure?

**Finding (F-1, F-2)**: `api/src/lib/encryption.ts` exports `encrypt(text)` / `decrypt(text)` using AES-256-CBC with a 32-byte key from `ENCRYPTION_KEY` env var. The same module is already used for `User.openaiApiKeyEncrypted`. The masking pattern (last 4 chars) is established in `api/src/routes/settings.ts`.

**Recommended approach**: `UserProviderConfig` table with `encryptedCredential: String` field. Call `encrypt()` on save, `decrypt()` on test-connection, never return plaintext. Mask with `'••••••••' + raw.slice(-4)` pattern (consistent with OpenAI key).

---

## Aspect 2 — Data Model for Historical Sale Records

**Question**: What shape should imported sale data take in the Prisma schema?

**Finding (F-4)**: `AuctionSale` has `foalId: String` (required FK) and `salePrice: Float`. It is designed for the foal lifecycle tracker, not for horse-level bulk import. Extending it with optional `horseId` would break the foal tracker's query assumptions and mix two distinct data concepts.

**Finding (F-10)**: `auctionSaleStats.ts` queries `AuctionSale` for mating analysis. Post-launch, a similar query against `SaleRecord` could surface imported sale stats in the mating advisor — keeping models separate preserves this extension point cleanly.

**Recommended approach**: New `SaleRecord` model. Unique constraint on `(horseId, hipNumber, saleDate)` enables `upsert` for idempotent re-imports. `hammerPriceCents: Int` (integer cents) is more precise than Float and consistent with how bid amounts are stored elsewhere in the schema (`Bid.amount: Int`).

---

## Aspect 3 — CSV Processing Infrastructure

**Question**: What libraries should handle multipart upload and CSV parsing?

**Finding (F-6)**: No file upload or CSV parsing libraries in `api/package.json`. Standard Express approach uses `multer` for multipart and `csv-parse` for CSV.

**Alternatives evaluated**:
- `multer` + `csv-parse` (recommended): battle-tested, well-typed, supports streaming; in-memory storage avoids disk I/O on Render
- `busboy` (lower-level multipart): more complex, no need without streaming requirements at this scale
- PapaParse on frontend: faster UX but inflates payload; server loses CSV schema validation

**Recommended approach**: `multer` (in-memory, 10 MB limit) + `csv-parse` (sync parse for in-memory buffers). Both have TypeScript types in DefinitelyTyped.

---

## Aspect 4 — Background Job Feasibility

**Question**: Can the spec's >500-row async job requirement be implemented at launch?

**Finding (F-7)**: Render does not provide a native job queue. Adding `pg-boss` would require: (1) a new `worker` service in `render.yaml`, (2) pg-boss table migrations, (3) a polling mechanism for job status in the frontend. This is significant scope for a feature that may not be needed.

**Performance estimate**: Prisma `createMany({ skipDuplicates: true })` for 500 SaleRecord inserts typically completes in 500ms–2s on a managed PostgreSQL instance. Per-row Horse dedup (one SELECT + optional INSERT) for 500 rows with an index on `(name, sire, dam equivalent in pedigree JSON)` — but note pedigree is JSON, so dedup queries run against Horse `name`, `breed`, and pedigree JSON fields. This is an O(N) query loop. At 500 rows with indexed Horse name lookup, 2-5 seconds is realistic.

**Recommendation**: Synchronous at launch. 60s Express timeout on the execute endpoint. Monitor real durations. If P95 > 30s, add pg-boss in a follow-on sprint.

---

## Aspect 5 — Provider Abstraction Pattern

**Question**: How should the provider API layer be structured to support SporthorseData, Equibase, and future TJCIS?

**Finding (F-8)**: `api/src/lib/adapters/types.ts` defines `AuctionHouseAdapter` and `AdapterRegistry` interfaces. `BidpathAdapter` implements the interface but throws "Bidpath partnership not active" — exactly the pattern needed for `TJCISAdapter`. The registry accepts a source string and returns the correct adapter instance.

**Recommended approach**: Mirror this pattern exactly. `DataProviderAdapter` interface in `api/src/lib/dataProviders/types.ts`. Registry at `api/src/lib/dataProviders/registry.ts` that accepts a `UserProviderConfig | PlatformProviderConfig` record and instantiates the correct adapter with the decrypted credential.

---

## Aspect 6 — Discipline Defaulting for Import

**Question**: How to satisfy `Horse.discipline` (non-nullable) when CSVs don't include a discipline column?

**Finding (F-5)**: `Discipline` enum is required on Horse. Sale companies don't include a "discipline" column in their exports — it's inferred from the breed/source.

**Recommended approach**: Each `ColumnMappingPreset` declares a `defaultDiscipline: Discipline`. Mapping:
- Keeneland, Fasig-Tipton, OBS, Saratoga → `thoroughbred_racing`
- AQHA → `quarter_horse`
- KWPN/Warmblood → `warmblood`
- Generic → `other` (user can override by including a discipline column)

If a CSV has a discipline column and the user maps it, the mapped value overrides the preset default. The import engine normalizes mapped discipline strings to the enum (case-insensitive, trim whitespace, fallback to preset default if unrecognized).
