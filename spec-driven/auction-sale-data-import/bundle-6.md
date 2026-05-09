---
bundle: 6
title: Data Sources Settings
stage: depth
parallel: no
depends_on: [1]
goal: Provider credentials CRUD in settings; adapter types + registry wired; SporthorseData/Equibase/TJCIS stubs functional
---

# Bundle 6 — Data Sources Settings

**Goal**: Users can save, retrieve (masked), test, and delete provider credentials via settings endpoints. DataProviderAdapter interface + registry defined. All three adapter stubs compile and are wired to the registry. TJCISAdapter throws "partnership not active" correctly. Integration tests verify encryption at rest.

**Bundle Verify**: POST /api/settings/providers/sporthorse_data saves encrypted credential; GET returns masked key (`••••••••xxxx`); DB value is not plaintext; DELETE removes config; `TJCISAdapter.search()` throws "TJCIS partnership not active"; TypeScript build exits 0.

---

## STEP-8: User provider config settings endpoints

**Trace**: [FR-6 → AC-6.1, AC-6.2, AC-6.3, AC-6.4, AC-6.5, AC-6.6]

**Files**:
- `api/src/routes/settings.ts` (modify)

**Effort**: M

**Intent**: `testStatus` on UserProviderConfig is updated by the test-connection endpoint — frontend reads this to show "Connected ✓" without a live call on page load. The GET endpoint also returns PlatformProviderConfig `active` status for TJCIS (read-only row for frontend). Never return `encryptedCredential` — only `'••••••••' + raw.slice(-4)` (S-4).

**Implementation guidance**:
1. `GET /api/settings/providers` — query `UserProviderConfig.findMany({ where: { userId } })`; map to `{ provider, maskedCredential, testStatus, testedAt }`; also query `PlatformProviderConfig.findUnique({ where: { provider: 'tjcis' } })` and append `{ provider: 'tjcis', active, testStatus: null, platform: true }`
2. `POST /api/settings/providers/:provider` — Zod: `{ credential: z.string().min(1) }`; validate provider is valid DataProvider enum; `encrypt(credential)` from encryption.ts; `upsert({ where: { userId_provider }, update: { encryptedCredential }, create: { ... } })`; return masked record
3. `DELETE /api/settings/providers/:provider` — delete where `{ userId, provider }`; 404 if not found
4. `POST /api/settings/providers/:provider/test` — decrypt; `getAdapter(provider, decrypted).testConnection()`; update `testStatus` + `testedAt`; return `{ ok, message }`

> **Standards**: S-1 — Zod on POST body + provider param validation; S-2 — requireAuth + getUserId; S-4 — masked credential only in responses

**Pattern reference**: `api/src/routes/settings.ts` (existing OpenAI key pattern)

**Verify**:
- Level: integration | Given: user POSTs credential | Action: POST + GET | Outcome: GET returns masked; raw DB value ≠ plaintext
- Level: integration | Given: saved credential | Action: DELETE + GET | Outcome: GET shows no config for that provider
- Level: integration | Given: invalid provider name | Action: POST /api/settings/providers/invalid | Outcome: 400

---

## STEP-T8: Integration tests for provider settings endpoints

**Trace**: MANUAL → Test for STEP-8

**Files**:
- `api/tests/providerSettings.test.ts` (create)

**Effort**: M

**Intent**: N/A — structural test step

**Implementation guidance**:
1. Wrap in `describe.skip` when `!process.env.DATABASE_URL`; mock auctionSocket
2. Test: save credential → GET returns masked; query DB directly and assert value ≠ input plaintext
3. Test: DELETE → subsequent GET shows no config
4. Test: invalid provider → 400

> **Standards**: S-6, S-7

**Verify**:
- Level: integration | Given: DATABASE_URL set | Action: `npm test -- providerSettings.test` | Outcome: all tests pass

---

## STEP-9: DataProviderAdapter types and registry

**Trace**: [FR-7 → AC-7.8]

**Files**:
- `api/src/lib/dataProviders/types.ts` (create)
- `api/src/lib/dataProviders/registry.ts` (create)

**Effort**: S

**Intent**: N/A — structural interface step. Routes must not construct adapters directly — `getAdapter()` is the single instantiation point. Mirrors AuctionHouseAdapter interface exactly.

**Implementation guidance**:
1. `types.ts`: export `DataProvider = 'sporthorse_data' | 'equibase' | 'tjcis'`; export `HorseSearchResult`, `ProviderSaleRecord`, `DataProviderAdapter` interface per AD-8
2. `registry.ts`: `getAdapter(provider: DataProvider, credential: string): DataProviderAdapter`; switch on provider, instantiate correct adapter; throw `Error('Unknown provider')` for unrecognized values

**Pattern reference**: `api/src/lib/adapters/types.ts`, `api/src/lib/adapters/registry.ts`

**Verify**:
- Level: inspection | Given: files created | Action: TypeScript build | Outcome: 0 errors; interface exported

---

## STEP-10: SporthorseData, Equibase, and TJCIS adapter stubs

**Trace**: [FR-7 → AC-7.1, AC-7.3, AC-7.4, AC-7.5, AC-7.7, AC-7.8]

**Files**:
- `api/src/lib/dataProviders/SporthorseDataAdapter.ts` (create)
- `api/src/lib/dataProviders/EquibaseAdapter.ts` (create)
- `api/src/lib/dataProviders/TJCISAdapter.ts` (create)

**Effort**: M

**Intent**: SporthorseDataAdapter and EquibaseAdapter implement real HTTP calls assuming standard Bearer auth (actual endpoints TBD until API docs obtained — `testConnection()` surfaces connectivity errors early). TJCISAdapter is an intentional stub — methods throw "TJCIS partnership not active" until a commercial agreement is signed. This is not a gap; it is a deliberate gate (AD-8, same pattern as BidpathAdapter).

**Implementation guidance**:
1. `SporthorseDataAdapter`: constructor accepts credential (Bearer token); `testConnection()` — GET to provider health/ping endpoint; `search(q)` — GET `/horses/search?q={q}`; `fetchSaleHistory(ref)` — GET `/horses/{ref}/sales`; map response to `HorseSearchResult[]` / `ProviderSaleRecord[]`
2. `EquibaseAdapter`: similar structure; may use basic auth if API key unavailable — add `// TODO: confirm auth scheme from API docs` comment; stub search/fetch with empty returns for now
3. `TJCISAdapter`: all three methods throw `new Error('TJCIS partnership not active — contact support')`
4. Register all three in `registry.ts`

**Pattern reference**: `api/src/lib/adapters/BidpathAdapter.ts` (stub throw pattern)

**Verify**:
- Level: unit | Given: TJCISAdapter instantiated | Action: call search("test") | Outcome: throws "TJCIS partnership not active"
- Level: inspection | Given: all 3 files created | Action: TypeScript build | Outcome: 0 errors; all implement DataProviderAdapter
