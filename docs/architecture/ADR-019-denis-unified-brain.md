# ADR-019: Denis Unified Brain

| Field | Value |
|-------|--------|
| **Status** | **Accepted** — engineering spine |
| **Vision** | [ADR-020 Table OS](./ADR-020-denis-table-operating-system.md) — category & Ko·Gde·Kad·Kako |
| **Date** | 2026-05-28 |
| **Replaces** | Incremental “patch hybrid” reading of earlier ADR-019 draft |
| **Depends on** | [ADR-003](./ADR-003-denis-platform-v2.md) · [ADR-004](./ADR-004-denis-kernel.md) · [ADR-005](./ADR-005-denis-maximum.md) · [ADR-017](./ADR-017-denis-scene-first-presentation.md) |
| **Map** | [denis-implementation-map.md](./denis-implementation-map.md) §7 |

---

## 0. Doctrine

**Denis is not a chatbot bolted onto ordering.**

Denis is the **runtime that owns the table session**: what the guest sees, what they can tap, what gets ordered, when someone is called, when Denis speaks first, and when a push fires.

Everything else — React UI, Stripe, kitchen, fiscal — is **downstream**.

Use **Truth · Mind · Face** ([ADR-020 §15](./ADR-020-denis-table-operating-system.md)): TRUTH = timeline + commerce facts; MIND = folded cognition; FACE = projected UI. Code names: `TableSessionState` = Mind, `TableSessionView` = Face.

If a feature cannot be expressed as “Denis received a signal → Denis updated Face → Denis optionally mutated commerce via ACL”, it does not belong in guest architecture.

**No second orchestrator.** Guest journey / experience triggers ([ADR-013](./ADR-013-competitive-guest-journey.md)) enqueue **Denis signals** only — see ADR-020 §17.

---

## 1. The Denis Loop (only pattern that matters)

Every behaviour — guest tap, chat line, order status change, cron tick — runs the **same loop**:

```
SIGNAL  →  FOLD  →  DECIDE  →  ACT  →  TELL  →  PROJECT
```

| Step | What happens | Tier |
|------|----------------|------|
| **SIGNAL** | Normalize ingress; append `denis_timeline` | — |
| **FOLD** | Rebuild `TableSessionState` from timeline + order facts + venue ops | code |
| **DECIDE** | Goals + Flow DSL + policy → action plan | code |
| **ACT** | Execute skills; **only** step that calls Order Core (ACL) | code |
| **TELL** | Narration from committed facts | T3 LLM optional |
| **PROJECT** | Write **one** guest read model + outbox side effects | code |

**Proactive Denis** is not a separate system. It is the same loop with **no guest SIGNAL** — kitchen moves order to `ready`, outbox injects `order.status_changed`, Denis runs FOLD→…→TELL without waiting for a question.

**Guest-initiated** = SIGNAL from UI.  
**Denis-initiated** = SIGNAL from world (order, payment, scheduler, ops).

Same brain. Same loop. Same truth.

### 1.1 Table Session Actor (Phase E)

HTTP handlers **enqueue signals**; they do not run the full loop inline in parallel.

One **actor per `table_session_id`** processes signals FIFO under lock → eliminates two-phone races and double proactive TELL. See [ADR-020 §16](./ADR-020-denis-table-operating-system.md).

---

## 2. Two guest APIs (read / write)

Guest mobile must not call Order Core, waiter REST, or checkout directly.

### Write — `POST /api/denis/signal`

One door for all guest intent:

```typescript
type DenisSignal =
  | { type: "message"; text: string; surface?: "chat" | "voice" }
  | { type: "chip"; chipId: string; label: string; structuredIntent?: unknown }
  | { type: "product"; productId: string; qty: number; modifiers?: unknown }
  | { type: "sheet"; action: string; payload?: unknown }
  | { type: "telemetry"; kind: "cart" | "scroll" | "dwell"; payload: unknown }
  | { type: "push_opt_in"; subscription: PushSubscriptionJSON };

// Response: projected view (or view version to poll)
type DenisSignalResponse = {
  viewVersion: number;
  view: TableSessionView;
};
```

Today: `/api/ai/chat`, `/api/denis/turn`, `/api/denis/sense` → **merge into signal** (Phase B).

### Read — `GET /api/denis/view`

One door for all guest UI:

```typescript
type TableSessionView = {
  version: number;
  phase: "browsing" | "ordering" | "waiting" | "settling" | "closed";
  chrome: { tableName; venueName; headline; markState };
  layers: SceneLayer[];           // chips, inline, banners — ADR-017
  transcript: TranscriptEntry[];  // Denis + guest lines (desk sheet)
  cart: CartView;                 // merged manual + draft + conflicts
  orders: OrderSummary[];
  actions: AvailableAction[];     // what Denis allows right now
};
```

Today: `GET /api/guest/scene` + chat session fetch + cart Zustand + order poll → **merge into view** (Phase B).

**Rule:** React components are **renderers** of `TableSessionView`. They do not merge state from five sources.

---

## 3. One write model, one read model

| | Write path | Read path |
|--|------------|-----------|
| **Name** | `denis_timeline` + ACL commits | `TableSessionView` (materialized) |
| **Mutability** | Append-only events | Rebuilt on every loop completion |
| **Source of truth** | Timeline + Order Core facts | Projection — never edited by UI |
| **Guest sees** | — | `view` only |

`guest_scene`, `ai_session_messages`, dock headline, push copy — **all slices of the same projection**, not parallel databases that can drift.

Projection worker (outbox):

```
project.denis_view  →  upsert guest_session_view (or guest_scene + transcript together)
project.notify      →  Web Push (guest + staff)
project.staff       →  dashboard copilot hints
```

---

## 4. TableSessionState (what FOLD produces)

Before DECIDE, Denis holds **one** in-memory struct — not scattered fetches:

```typescript
type TableSessionState = {
  table: { id; name; token };
  session: { id; pin; approval; paymentMethod };
  commerce: {
    orders: OrderFact[];
    cart: MergedCart;
    sessionBill?: SessionBillFact;
  };
  venue: {
    ops: VenueOpsBeliefs;   // 86, rush, KDS stress
    floor?: FloorSnapshot;
  };
  party?: PartyBeliefs;
  guest?: GuestMemoryProjection;
  conversation: {
    goals: GoalStack;
    beliefs: BeliefSet;
    dismissedNudges: string[];
  };
  devices: {
    pushSubscribed: boolean;
    chatOpen?: boolean;
  };
};
```

**FOLD inputs (read-only):**

1. `denis_timeline` since session start  
2. Order Core rows for this table session  
3. Venue ops snapshot (location scope)  
4. Consented guest memory  

**Forbidden:** planner or narrator opening new Supabase queries per turn.

Loader: `foldTableSessionState()` — replaces ad-hoc “snapshot” loaders and duplicate belief folds.

---

## 5. Why this beats the hybrid we have today

| | **Hybrid today** | **Denis brain (this ADR)** |
|--|------------------|----------------------------|
| Guest state | Scene + chat + cart + order poll | **One `view`** |
| Waiter call | Sometimes REST, sometimes Denis | **Always signal → ACT** |
| Order submit | Legacy executor + act path | **Always ACT → ACL** |
| Order ready | Dashboard push only; guest polls | **Denis TELL + guest push** |
| “Denis forgot order” | UI knows, chat doesn’t | **FOLD sees orders always** |
| Proactive | Banner on menu only | **Loop on every world event** |
| Intelligence | LLM answers; kernel in shadow | **`denis_only`; LLM speaks facts only** |
| Testability | E2E only | **Fixtures on FOLD + DECIDE** |

The hybrid is **not** wrong temporarily — it is **wrong as destination**. Destination is this ADR.

---

## 6. World signals (Denis watches the game)

Order Core and session saga **do not** update guest UI directly. They append timeline / enqueue outbox:

| World event | Injected signal | Denis behaviour |
|-------------|-----------------|-----------------|
| Order created | `commerce.order_created` | TELL confirmation + phase → waiting |
| Status → preparing | `commerce.order_status` | TELL ETA; update headline |
| Status → ready | `commerce.order_status` | TELL + push + chip “Preuzmi” |
| Payment settled | `commerce.payment_settled` | TELL thanks; offer receipt |
| Waiter call ack | `commerce.waiter_ack` | TELL “na putu” |
| Item 86 | `venue.item_86` | DECIDE suppress upsell; TELL if guest asked |
| Rush / KDS backlog | `venue.capacity` | TELL honest wait; skip dessert nudge |

Kitchen dashboard, Stripe webhooks, staff actions → **events** → Denis loop → guest `view`.

---

## 7. Surfaces (presentation only)

| Surface | Implementation |
|---------|----------------|
| **Dock + chips + inline** | `view.layers` |
| **Desk sheet (chat)** | `view.transcript` + signal `message` |
| **Menu grid** | Static catalog + `view.actions` / filters from FOLD |
| **Push** | `project.notify` with TELL one-liner |
| **Voice** | signal `message` + TTS on `tell.speakText` |

80% tap / 5% type ([ADR-017](./ADR-017-denis-scene-first-presentation.md)) unchanged — but **all** flow through signal/view.

---

## 8. Venue brain → table brain

Location ops **feeds FOLD**, never guest UI:

```
venue_ops (M13) + floor (M14)  →  fold into TableSessionState.venue
                                      →  DECIDE (skip upsell in rush)
                                      →  TELL (shorter, honest)
```

Staff copilot is a **different view** of the same venue facts. Staff hint → `signal` type `staff.hint` → belief → may TELL guest (“sommelier preporučuje…”).

---

## 9. LLM boundary (unchanged, non-negotiable)

| Tier | Role |
|------|------|
| T0 | Regex, chips, commands — never fails |
| T1 | Skills: add, submit, status, handoff |
| T2 | Slot extract only |
| T3 | Speak what ACT committed |

LLM is **voice**, not brain. Brain = FOLD + DECIDE + ACT.

---

## 10. Target code shape

```
src/lib/denis/
├── loop/
│   ├── run-denis-loop.ts       # SIGNAL→…→PROJECT (single entry)
│   ├── fold-table-session-state.ts
│   ├── decide.ts               # planner wrapper
│   ├── act.ts                  # skills + ACL
│   ├── tell.ts                 # narrate + lint
│   └── project-view.ts         # TableSessionView materializer
├── ingress/
│   └── normalize-signal.ts
├── acl/                        # only Order Core exit
└── kernel/ … venue/ …         # unchanged cognitive core

src/app/api/denis/
├── signal/route.ts             # POST — merge chat/turn/sense
└── view/route.ts               # GET — merge scene + transcript

src/components/guest/           # render view only; no Order Core imports
```

Delete path (Phase D): `execute-chat-turn` business logic, `order-executor`, direct guest waiter REST, shadow rollout as default.

---

## 11. Migration (phases A → F)

| Phase | Goal | Ship |
|-------|------|------|
| **A — FOLD** | Mind from TRUTH; wire into `runDenisTurn` | Denis sees full table every turn |
| **B — FACE** | `GET /api/denis/view` — one projection | UI reads one API |
| **C — SIGNAL** | `POST /api/denis/signal` — one write door | Guest intent unified |
| **D — WORLD** | Order/status → loop → TELL + guest push | Denis speaks first |
| **E — ACTOR** | Serialized Table Session Actor + view stream + ADR-013 → signals | No races, no poll, one orchestrator |
| **F — TRUTH** | Transcript from timeline only; retire `ai_sessions` drift | Single replay path |

Legacy routes stay as thin wrappers during B/C only. Remove in D.

**Marketing gate:** Phase D + `denis_only` on pilot. **Scale gate:** Phase E before chain / heavy multi-device. **Complete architecture:** through Phase F.

---

## 12. Acceptance tests (architecture done = these pass)

1. Guest orders Aperol → closes phone → kitchen marks ready → **push arrives** → opens → **transcript already contains** ready line matching dock headline.  
2. Guest taps “Kellner rufen” → **no** `/api/waiter-calls` in network tab → signal → transcript confirms.  
3. Two devices same table → party FOLD → conflict message before double submit.  
4. Rush mode on → dessert chip **absent** from `view.layers`; Denis does not offer dessert in TELL.  
5. `pnpm eval:denis` fixtures run FOLD+DECIDE without DB.

---

## 13. Explicit non-goals

- LLM planner or autonomous payment  
- FCM required for web (VAPID enough)  
- Guest UI calling `create-order`  
- Separate “notification microservice” copy unrelated to TELL  
- Cross-venue profiling without consent  

---

## 14. Operator prompt

```
ADR-019 Denis brain. Read §1 loop + §2 signal/view.
Implement current phase only (A→D). One PR per phase step.
Guest: signal write, view read. Denis: only brain.
pnpm verify:denis && pnpm eval:denis. Do not commit unless asked.
```

---

## 15. Summary

**Better architecture = fewer doors.**

- Guest: **signal in, view out**  
- Denis: **one loop** for guest taps and kitchen events  
- Truth: **timeline + commerce facts**  
- UI: **projection**, never co-brain  

Denis prati igru because **the game is defined as events he folds**, not because we prompt him harder.

That is the architecture worth building.
