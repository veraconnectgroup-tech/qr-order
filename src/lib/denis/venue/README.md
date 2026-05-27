# Denis Venue OS (L3)

Floor graph, **party model**, ops beliefs, staff copilot.

## M12 — Party model ✅

See `party/types.ts`, `party/party-store.ts`.

## M13 — Ops beliefs ✅

| Module | Role |
|--------|------|
| `ops/types.ts` | `VenueOpsBeliefs`, operating mode, KDS stress |
| `ops/load-venue-ops.ts` | Load 86 list, rush, staff hints from DB |
| `ops/load-effective-venue-ops.ts` | DB ops + cached floor merge |
| `ops/planner-effects.ts` | Skip upsell, empathy note, guest-safe hints |
| `ops/staff-ops-actions.ts` | Dashboard server actions (rush, hints) |

Migration: `00090_denis_ops_beliefs.sql`

## M14 — Floor graph ✅

| Module | Role |
|--------|------|
| `floor/types.ts` | `FloorGraph` snapshot (ADR-005 §5.1) |
| `floor/load-floor-graph.ts` | Build snapshot from tables/sessions/orders |
| `floor/floor-cache.ts` | Redis `denis:floor:{locationId}` TTL 30s |
| `floor/compute-kds-backlog.ts` | Average kitchen wait minutes |
| `floor/resolve-effective-ops.ts` | Auto rush when backlog high |
| `floor/process-floor-tick.ts` | Cron worker |

Cron: `GET /api/cron/denis-floor` (Bearer `CRON_SECRET`)

Config (GA gate — off by default):

- `ConciergeConfig.ops.floorGraphEnabled`
- `ConciergeConfig.ops.autoRushEnabled`
- `ConciergeConfig.ops.autoRushBacklogMinutes` (default 20)

Auto rush only elevates from `normal` → `rush` + `kdsStress: high`. Staff manual modes are preserved.

## M15 — Staff copilot ✅

Dashboard: `/dashboard/denis` (sidebar when `ai_concierge_enabled`)

| Module | Role |
|--------|------|
| `copilot/load-staff-copilot-snapshot.ts` | Floor + hints + ops for staff UI |
| `copilot/prioritize-tables.ts` | Priority table ordering |
| `components/dashboard/denis-staff-copilot-board.tsx` | Rush/KDS controls, hints form |

API: `GET /api/dashboard/denis-copilot` (staff auth, 30s client poll)

Staff server actions (`ops/staff-ops-actions.ts`):

- `setDenisOperatingMode("rush" | "normal" | …)`
- `setDenisKdsStress("normal" | "high")`
- `upsertDenisStaffTableHint({ tableId, text, visibility })`

Product 86 uses existing `products.is_available = false`.
