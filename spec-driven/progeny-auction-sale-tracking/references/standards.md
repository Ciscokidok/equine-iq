# Standards Inventory: progeny-auction-sale-tracking

Complete standards inventory with typed applicability metadata. `design.md` carries a summary table of the most relevant standards.

The task skill matches standards to steps using `file_type` and `action_type`.

Source: `equine-iq/CLAUDE.md`

---

## S-1: All protected routes must call `requireAuth` and `getUserId` before any DB access

- **Domain**: security
- **File Type**: .ts
- **Action Type**: * (all)
- **Source**: `equine-iq/CLAUDE.md` (Auth section: "bcrypt + JWT (HS256)")

Every route handler that touches user-owned data must call `requireAuth` as middleware and extract `userId` via `getUserId(req)` before any Prisma query. This applies to all new auction-sale endpoints.

---

## S-2: All req.body input validated with Zod before processing

- **Domain**: error-handling
- **File Type**: .ts
- **Action Type**: * (all)
- **Source**: `equine-iq/CLAUDE.md` (pattern observed in all route files: foals.ts, pairings.ts, stallions.ts)

Define a Zod schema at the top of each route file. Call `.safeParse(req.body)` and return `400` with `error.flatten()` on failure before any other processing.

---

## S-3: Perform ownership check (`findFirst` with `userId`) before any mutation

- **Domain**: security
- **File Type**: .ts
- **Action Type**: modify
- **Source**: `equine-iq/CLAUDE.md` (pattern observed in foals.ts lines 77–82, 101–103)

Before updating or deleting any record, call `prisma.<model>.findFirst({ where: { id, userId } })`. If the record is not found, return `404` (not `403`) — do not reveal whether the record exists for another user.

---

## S-4: Use Prisma ORM for all DB access; `$queryRaw` only when Prisma query builder cannot express the operation

- **Domain**: api-design
- **File Type**: .ts
- **Action Type**: * (all)
- **Source**: `equine-iq/CLAUDE.md` (ORM: Prisma)

All CRUD operations use the Prisma client (`prisma.<model>.create/findMany/update/delete`). `$queryRaw` is reserved for operations Prisma's query builder cannot express — specifically percentile aggregates for this feature. When using `$queryRaw`, define explicit TypeScript return types and validate the shape at runtime.

---

## S-5: Feature branches only — never push directly to main

- **Domain**: other
- **File Type**: * (all)
- **Action Type**: * (all)
- **Source**: `equine-iq/CLAUDE.md` (Git Workflow section)

All implementation work happens on a feature branch (`git checkout -b feature/<name>`). PRs open against main. Never commit directly to main.
