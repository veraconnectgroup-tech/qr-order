# Denis loop — ADR-019 Phase A+

Unified brain loop: `SIGNAL → FOLD → DECIDE → ACT → TELL → PROJECT`.

| File | Role |
|------|------|
| `fold-table-session-state.ts` | Rebuild `TableSessionState` from TRUTH |
| `project-view.ts` | PROJECT → `TableSessionView` (FACE) |
| `types.ts` | Mind types — `TableSessionState`, `FoldInput`, `FoldResult` |
| `append-fold-completed.ts` | Timeline `mind.fold_completed` |

**Phase A:** FOLD wired into `buildDenisTurnContext`, `runDenisSense`, proactive path.  
**Phase B:** `GET /api/denis/view` — order page dock reads unified view.
