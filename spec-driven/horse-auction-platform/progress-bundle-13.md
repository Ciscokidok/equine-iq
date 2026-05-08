# Progress: Bundle 13 — Admin Frontend: VettingQueue + BidderApproval

> Status: done | Bundle: 13 of 15 | Stage: depth | Parallel: yes

| Step | Title | Status | Notes |
|------|-------|--------|-------|
| STEP-42 | Create frontend/src/views/admin/VettingQueue.tsx — document links, approve/reject with optimistic update | done | Admin role guard via JWT decode; on-demand presigned URL fetch; approve/reject mutations; tsc passes |
| STEP-43 | Create frontend/src/views/admin/BidderApproval.tsx — approve/confirm deposit/suspend with confirm dialog | done | window.confirm guard on suspend; confirm deposit + approve + suspend mutations; tsc passes |
