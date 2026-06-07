# Denis cognition plane (ADR-023)

Belief → Policy → Language stack:

| Folder | MR | Role |
|--------|-----|------|
| `beliefs/` | MR-1 | `compileBeliefs()` after FOLD |
| `tde/` | MR-2 | `decideTurnPlan`, templates |
| `manifest/` | MR-4 | Venue manifest merge |
| `context/` | MR-5/6 | Evidence pointers + menu RAG |
| `resolve-runtime-profile.ts` | MR-3 | Tier + model routing |
| `perceive/` | 034-A | `perceiveGuestChatTurn` — canonical guest chat perceive |
| `order/` | 034-A | `applyOrderComprehend` — post-LLM order comprehend |
