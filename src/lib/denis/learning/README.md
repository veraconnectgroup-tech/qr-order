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

## M17 — Consented guest memory ✅

| Module | Role |
|--------|------|
| `platform/guest-memory-types.ts` | Shared projection types (runtime + learning) |
| `learning/guest-memory/build-welcome-message.ts` | T0 welcome template |
| `learning/guest-memory/same-again-chips.ts` | T0 chip labels |
| `lib/guest/denis-guest-memory-store.ts` | HMAC token, load/consent/sync/delete |
| `lib/guest/denis-guest-memory-client.ts` | Guest fetch helpers + consent dismiss |
| `hooks/use-guest-memory.ts` | localStorage + optional server sync |
| `components/guest/denis-memory-consent-banner.tsx` | Consent UI |

Migration: `00092_denis_guest_memory.sql`

Config (GA gate — off by default):

- `ConciergeConfig.memory.returnGuestEnabled`
- `memoryTtlDays` (default 90)
- `consentPromptTemplate` (optional banner override)

API:

- `POST /api/guest/denis-memory` — load projection
- `POST /api/guest/denis-memory/consent` — grant consent + seed
- `POST /api/guest/denis-memory/sync` — allergies / visit record
- `DELETE /api/guest/denis-memory` — GDPR erase

Runtime: `build-turn-context` loads projection when enabled; welcome + T0 chips on `welcome` node.

**May import:** config, platform only (pure logic in `learning/guest-memory/`).
