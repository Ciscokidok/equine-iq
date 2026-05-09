# Standards: auction-sale-data-import

| ID | Rule | Domain | File Type | Action Type | Source |
|----|------|--------|-----------|-------------|--------|
| S-1 | Validate all API inputs with Zod before touching the DB | validation | .ts (routes) | create/modify | CLAUDE.md (existing route pattern) |
| S-2 | Use `requireAuth` + `getUserId(req)` for all user-scoped endpoints | security | .ts (routes) | create | CLAUDE.md (existing auth pattern) |
| S-3 | Use `requireAuth` + `requireAdmin` for all admin endpoints | security | .ts (admin routes) | create | CLAUDE.md (existing admin pattern) |
| S-4 | Never return encrypted credential plaintext in API responses; always mask (show last 4 chars only) | security | .ts (routes) | create/modify | Existing settings.ts pattern |
| S-5 | Use `prisma.$transaction([...])` for multi-model atomic writes | reliability | .ts (lib) | create | Existing listings.ts and listings configure pattern |
| S-6 | Wrap integration tests in `describe.skip` when `DATABASE_URL` is absent | testing | .test.ts | create | Existing test files pattern |
| S-7 | In tests, mock `auctionSocket` via `vi.mock('../src/lib/auctionSocket', ...)` if import engine triggers any broadcasts | testing | .test.ts | create | Existing lifecycle test pattern |
| S-8 | New Prisma models: add `@@index` on all FK columns and columns used in frequent WHERE clauses | performance | schema.prisma | modify | Existing schema conventions |
