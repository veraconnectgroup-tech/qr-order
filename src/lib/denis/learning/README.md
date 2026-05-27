# L5 — Learning

**Tracks:** M16–M17  
**ADR:** [ADR-005 §7](../../../docs/architecture/ADR-005-denis-maximum.md)

## M16 — Learned edges queue ✅

| Module | Role |
|--------|------|
| `learning/types.ts` | `LearnedEdgeCandidate`, session pair input |
| `learning/compute-pair-stats.ts` | Pure aggregate from `products_recommended` / `products_added` |
| `lib/admin/denis-learned-edges.ts` | DB queue, approve → `upsell_rules`, cron aggregate |
| `admin/denis-insights` | Review UI — approve / reject |

Migration: `00091_denis_learned_edges.sql`

Config (GA gate — off by default):

- `ConciergeConfig.learning.learnedEdgesEnabled`
- `minAcceptRateForSuggestion` (default 0.15)
- `minImpressionsForSuggestion` (default 3)

Cron: `GET /api/cron/denis-learned-edges` (Bearer `CRON_SECRET`)

**Never auto-applies** — admin approve promotes to L1 `upsell_rules` + VKG cache invalidation.

## M17+ (not built)

- Consented guest memory

**May import:** config, platform only.
