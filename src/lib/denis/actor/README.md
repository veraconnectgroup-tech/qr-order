# Denis actor (ADR-019 Phase E)

Serialized **Table Session Actor** — one FIFO queue + lock per `table_session_id`.

| Module | Role |
|--------|------|
| `table-session-actor.ts` | Enqueue guest/world signals, drain under Redis lock |
| `signal-dedupe.ts` | `signalId` idempotency (24h) |
| `view-version.ts` | Redis bump for SSE `/api/denis/view/stream` |
| `redis-keys.ts` | Key naming |

**Eval:** in-memory FIFO simulation lives in `eval/simulate-actor-fifo-queue.ts` (M2 two-phone race).

**Rollout:** `rollout.tableSessionActorEnabled` — on for `table_os_pilot` patch only; requires Redis.

**Requires:** `UPSTASH_REDIS_REST_URL` + token. Without Redis or rollout flag, guest signals run inline (legacy path).

**Flow:**

```
POST /api/denis/signal → enqueue → lock → executeDenisSignalCore → result
commerce.denis.world → enqueueWorldSignal → runDenisWorldSignal
payment_settled / order_delivered → enqueueCommerceExperienceSignal → runCommerceExperience
persistTableSessionView → publishViewVersionBump → SSE clients refresh
GET /api/denis/view/stream → EventSource → refresh on version bump
```
