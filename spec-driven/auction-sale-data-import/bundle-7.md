---
bundle: 7
title: Provider API Pull & Admin
stage: depth
parallel: no
depends_on: [6]
goal: Provider list + search endpoints functional; admin platform provider CRUD wired with requireAdmin guard
---

# Bundle 7 — Provider API Pull & Admin

**Goal**: GET /api/import/providers returns only providers with active credentials for the user. Provider search calls the adapter and wraps errors. Admin can configure TJCIS/Equineline platform credential. Integration tests confirm provider filtering and uncredentialed access returns 403.

**Bundle Verify**: Provider list with configured credentials returns that provider; list with no credentials returns empty; uncredentialed provider search returns 403 with connection prompt; admin route returns 403 for non-admin users.

---

## STEP-11: Provider list and search endpoints

**Trace**: [FR-7 → AC-7.1, AC-7.2, AC-7.3, AC-7.4, AC-7.5, AC-7.6, AC-7.7]

**Files**:
- `api/src/routes/import.ts` (modify — add providers section)

**Effort**: M

**Intent**: Provider list filters to only configured providers — returning unconfigured providers would require the frontend to make per-provider credential checks. The search endpoint decrypts the credential at request time (never cached). Provider API errors must be caught and wrapped — never forwarded raw (provider errors may include credential context).

**Implementation guidance**:
1. `GET /api/import/providers` — query `UserProviderConfig.findMany({ where: { userId } })`; also check `PlatformProviderConfig.findUnique({ where: { provider: 'tjcis' } })` for active status; return `{ providers: [{ provider, configured, testStatus, platformManaged? }] }`
2. `GET /api/import/providers/:provider/search` — Zod: `q` query param, min 2 chars; fetch `UserProviderConfig` for `(userId, provider)`; if null → 403 `"Connect [provider] in Settings → Data Sources"`; decrypt credential; `getAdapter(provider, decrypted).search(q)`; catch errors → 502 with wrapped message `"[ProviderName] returned an error: [message]"`
3. `POST /api/import/providers/:provider/fetch` — accepts `{ providerRef: z.string() }`; `fetchSaleHistory(providerRef)`; normalize to `ValidatedRow[]`; return preview-format rows (caller passes to execute)
4. For 'tjcis': check PlatformProviderConfig instead of UserProviderConfig; if not active → 403 "Equineline access is not available — contact support"

> **Standards**: S-1 — Zod on search params + fetch body; S-2 — requireAuth; S-4 — wrap provider errors

**Pattern reference**: `api/src/routes/import.ts` (upload/preview from STEP-5)

**Verify**:
- Level: integration | Given: user has sporthorse_data configured | Action: GET /api/import/providers | Outcome: sporthorse_data in list, configured=true
- Level: integration | Given: user has no credentials | Action: GET /api/import/providers | Outcome: `{ providers: [] }`
- Level: integration | Given: no equibase credentials | Action: GET /api/import/providers/equibase/search?q=horse | Outcome: 403 with connection prompt

---

## STEP-T11: Integration tests for provider endpoints

**Trace**: MANUAL → Test for STEP-11

**Files**:
- `api/tests/import.providers.test.ts` (create)

**Effort**: S

**Intent**: N/A — structural test step

**Implementation guidance**:
1. Wrap in `describe.skip` when `!process.env.DATABASE_URL`; mock auctionSocket
2. Mock adapter `search()` to return fixed fixture data (no live API calls)
3. Test: provider list with credentials → configured provider appears
4. Test: provider list with no credentials → empty array
5. Test: search without credentials → 403 with message

> **Standards**: S-6, S-7

**Verify**:
- Level: integration | Given: DATABASE_URL set | Action: `npm test -- import.providers.test` | Outcome: all tests pass

---

## STEP-12: Admin platform providers route

**Trace**: [FR-6 → AC-6.7]

**Files**:
- `api/src/routes/admin/platformProviders.ts` (create — replaces stub from STEP-2)

**Effort**: S

**Intent**: Admin-only CRUD for TJCIS/Equineline platform credential. The `active` field is what STEP-11's provider list checks — setting `active: true` enables Equineline for all users. Same encrypt/decrypt as user-tier.

**Implementation guidance**:
1. `GET /api/admin/platform-providers` — `findMany()` on PlatformProviderConfig; return with masked credentials
2. `POST /api/admin/platform-providers/:provider` — Zod: `{ credential: z.string().min(1) }`; encrypt; upsert
3. `DELETE /api/admin/platform-providers/:provider` — delete + set active: false (or just delete)
4. `POST /api/admin/platform-providers/:provider/test` — decrypt + testConnection() + update testedAt
5. `PATCH /api/admin/platform-providers/:provider/toggle` — toggle active boolean

> **Standards**: S-1 — Zod on all POST bodies; S-3 — requireAuth + requireAdmin; S-4 — mask credentials in responses

**Pattern reference**: `api/src/routes/admin/adapters.ts`

**Verify**:
- Level: integration | Given: non-admin user | Action: POST /api/admin/platform-providers/tjcis | Outcome: 403
- Level: inspection | Given: file created | Action: TypeScript build | Outcome: 0 errors
