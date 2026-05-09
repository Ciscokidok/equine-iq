---
bundle: 3
status: completed
---

# Progress: Bundle 3 — Upload & Preview Endpoints

| STEP | Title | Status | Commit |
|------|-------|--------|--------|
| STEP-5 | CSV upload and preview endpoints | done | 467acec |
| STEP-T5 | Integration tests for upload and preview | done | 0f99cc8 |

## Notes
- Horse.createdByUser (not createdByUserId); no direct sire/dam fields — dedup matches by name + ownership
- Integration tests correctly skip when DATABASE_URL absent (describe.skip pattern)
