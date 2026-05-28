# ADR-020: Denis — Table Operating System

| Field | Value |
|-------|--------|
| **Status** | **Accepted** — category vision & product north star |
| **Date** | 2026-05-28 |
| **Codename** | **Denis** · Part of **Vera Group** |
| **Engineering spine** | [ADR-019](./ADR-019-denis-unified-brain.md) (signal/view loop) |
| **Cognitive core** | [ADR-004](./ADR-004-denis-kernel.md) · [ADR-005](./ADR-005-denis-maximum.md) |

---

## 0. The bet

**Microsoft will bolt Copilot onto POS. Competitors will ship prettier menus.**

**We ship a brain that runs the table.**

Denis is not “AI chat for restaurants”. Denis is a **Table Operating System (Table OS)** — a continuous runtime that knows **who** is at the table, **where** they are in the journey, **when** to speak, and **how** to act (tap, sell, settle, recover) — without ever lying about what the kitchen actually has.

That category does not exist yet. We define it.

---

## 1. What Table OS means

An operating system does three things:

| OS job | Restaurant without Denis | **Denis Table OS** |
|--------|--------------------------|---------------------|
| **Know state** | Menu app + POS + WhatsApp staff | One folded **TableSessionState** |
| **Schedule work** | Guest polls; staff shouts | **Anticipation engine** + push |
| **Expose API** | 12 REST endpoints + hope | **`signal` in · `view` out** |

Guests don’t “use an app”. They **inhabit a table session** Denis runs.

Staff don’t “read tickets”. They **co-pilot a floor** Denis already modeled.

Owners don’t “turn on AI feature”. They **deploy Denis** as venue runtime.

---

## 2. Why Copilot is the wrong shape (and why that’s our moat)

| | **Copilot-on-POS** | **Denis Table OS** |
|--|-------------------|---------------------|
| Unit of intelligence | Document / screen | **Table session over time** |
| Memory | Chat thread | **Event-sourced beliefs + replay** |
| Commerce | Suggests; human clicks POS | **ACT via ACL** — Denis commits orders |
| Proactivity | Optional nudge | **Core loop** — world events wake Denis |
| Truth | LLM may confabulate | **T0–T1 decide; T3 only speaks facts** |
| Floor awareness | None | **Venue OS + floor graph** |
| Eval | Prompt A/B | **`pnpm eval:denis` — regression on cognition** |
| Multi-phone table | Chaos | **Party model — one cart truth** |

Microsoft sells **assistants**. We sell **autonomy with guardrails** — the head waiter who never forgets allergy #3, never double-submits, never upsells dessert when KDS is 40 minutes behind.

---

## 3. The four dimensions — Ko · Gde · Kad · Kako

Every Denis decision is anchored in four dimensions. This is the **mental model** engineers and product share.

### 3.1 KO — *Who*

```typescript
type WhoContext = {
  party: {
    devices: DevicePresence[];     // whose phone, who is primary
    headcountHint?: number;
    language: string;                // sticky conversation language
    memory?: GuestMemoryProjection;  // allergies, favorites — consented only
  };
  role: "guest" | "staff" | "system";
  actorId: string;                   // fingerprint | staff_id | "kitchen"
};
```

**Denis knows:** “Phone A ordered Aperol; Phone B is browsing desserts; both share one bill.”

### 3.2 GDE — *Where*

```typescript
type WhereContext = {
  table: { id; name; zone; token };
  venue: { id; name; operatingMode; locale };
  floor: {
    seatedMinutes: number;
    neighborStress?: "normal" | "busy";  // floor graph
    tableHint?: StaffTableHint;          // “VIP — comp if asked”
  };
  journeyPhase: "latent" | "browsing" | "ordering" | "waiting" | "settling" | "closed";
};
```

**Denis knows:** “Table 7, Skyline Lounge, Friday rush, 22 min seated, kitchen backlog high — **do not** push food upsell.”

### 3.3 KAD — *When*

```typescript
type WhenContext = {
  now: string;
  timeline: TimelineCursor;          // monotonic session clock
  schedules: DueSchedule[];          // “check order #17 at T+8min”
  triggers: {
    lastGuestSignalAt: string;
    lastDenisTellAt: string;
    orderStatusChangedAt?: string;
    paymentSettledAt?: string;
  };
  venueSchedule: { kitchenOpen; barOpen; happyHour? };
};
```

**Denis knows:** “Order entered kitchen 6 min ago; ETA was 8 — **now** is the moment to set expectation, not upsell.”

### 3.4 KAKO — *How*

```typescript
type HowContext = {
  channel: "chip" | "chat" | "voice" | "push" | "inline" | "proactive";
  intent?: GuestIntent;              // T0 certain / T2 extracted
  goal: ActiveGoal;                  // SERVE | SELL | SETTLE | RECOVER | DELIGHT
  allowedActions: ActionCapability[]; // what ACT may do *right now*
  narrationStyle: "full" | "brief" | "silent";  // rush mode
};
```

**Denis knows:** “Guest tapped chip → T0 handoff, no LLM. Rush mode → one line + chip, no essay.”

**Fold rule:** `TableSessionState = f(KO, GDE, KAD, KAKO)` — rebuilt every loop. No orphan APIs.

---

## 4. Continuous Table Mind (not request/response)

Chatbots wake up when you type. **Denis never sleeps while the table session is open.**

```
        ┌─────────────────────────────────────────┐
        │         CONTINUOUS TABLE MIND            │
        │  (one runtime per table_session_id)      │
        └─────────────────────────────────────────┘
              ▲           ▲           ▲
              │           │           │
    guest signal    world event    scheduler tick
    (tap/chat)      (order ready)   (dessert window)
              │           │           │
              └───────────┴───────────┘
                          │
                    DENIS LOOP
                          │
              view update · push · ACT
```

| Signal source | Example | Denis response |
|---------------|---------|----------------|
| Guest | Adds Negroni | FOLD → goal SELL pairing → chip “Campari upgrade?” |
| Guest | Silent 4 min browsing | KAD → proactive “Popular tonight: Aperol” |
| Kitchen | #017 → preparing | TELL “~8 min” + headline |
| Kitchen | #017 → ready | TELL + **push** + chip “Pick up at bar” |
| Payment | Session paid | goal SETTLE → receipt + review window later |
| Venue | Item 86 | belief update → substitute VKG edge |
| Staff | Hint on table | belief → guest-safe paraphrase if relevant |

**Proactivity is not a feature flag. It is the default posture of a waiter who stays in the room.**

---

## 5. Goal stack — Denis always pursues something

A genius waiter is never idle. Denis maintains an **ordered goal stack**:

| Priority | Goal | Behaviour |
|----------|------|-----------|
| P0 | **RECOVER** | Wrong order, complaint, confusion — drop all selling |
| P1 | **SERVE** | Allergy safe, order correct, status honest |
| P2 | **SETTLE** | Bill, payment method, receipt |
| P3 | **SELL** | Pairing, round 2, dessert — **only if P0–P2 clear** |
| P4 | **DELIGHT** | Review prompt, return welcome, subtle surprise |

**Selling without serving is spam.** Denis policy engine **hard-blocks** SELL when:

- `venue.kdsStress === high`
- guest dismissed nudge key
- order not yet accepted
- rush mode ON
- allergy conflict unresolved

**This is how Denis “prodaje” without being obnoxious** — commerce is a **goal**, not a prompt injection.

---

## 6. Venue Knowledge Graph — *why this pairing, now*

Generic LLM: “Wine goes with steak.”

Denis VKG: “**At Skyline**, sommelier rule R-14 + tonight’s 86 list + guest declined sweet → suggest **Grüner** not Riesling.”

```
Menu catalog (L0)
    ↓
Upsell rules (L1) — location-specific
    ↓
Learned edges (L3) — approved from real baskets
    ↓
Moment filter (KAD + GDE) — rush, phase, cart contents
    ↓
Single ranked offer → chip or TELL
```

**Moat:** VKG + timeline + eval = **compound learning per venue**, not generic GPT.

---

## 7. One table, one truth, many faces

```
                    ┌──────────────┐
                    │  DENIS LOOP  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         TableSessionView  Push      Staff hint
         (guest UI)        (guest)   (copilot)
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
  dock     transcript   inline menu
  chips    (desk)       recommendations
```

**Same sentence everywhere.** Dock headline = transcript line = push body = kitchen reality.

Drift is architecturally impossible when **one PROJECT step** writes all slices.

---

## 8. Scenario — 47 minutes at Table 2 (why guests feel magic)

| Time | World | Denis (internal) | Guest feels |
|------|-------|------------------|-------------|
| 0:00 | QR scan | FOLD → goal SERVE; TELL welcome (DE) | “Denis knows the table” |
| 0:45 | Scrolls cocktails 40s | KAD → SELL allowed; chip “Aperol — #1 tonight” | Nudge, not popup spam |
| 1:10 | Tap Aperol | ACT add; SELL pairing chip “Snack?” | Fast, no chat needed |
| 1:30 | “weiter” typo | T0 clarify or handoff — not “I can’t” | Trust |
| 2:00 | Confirm order | ACT submit; phase → waiting | #017 |
| 2:05 | Phone locked | — | — |
| 6:00 | Kitchen → preparing | WORLD signal; TELL “~8 min” | Push optional |
| 8:30 | Kitchen → ready | TELL + push “#017 ready”; chip | **Denis spoke first** |
| 9:00 | Opens push | view.transcript already has line | Continuity |
| 12:00 | Tap “Mehr bestellen” | goal SELL; inline second round | Revenue |
| 18:00 | Tap “Rechnung” | goal SETTLE; BILL flow T0 | No LLM roulette |
| 25:00 | Pay at bar | ACT set method; TELL | Clear |
| 40:00 | Delivered | goal DELIGHT; review chip (later) | Loop closes |

**No competitor script matches this** without event-sourced table runtime. Menus don’t push. Chatbots don’t watch kitchen. POS doesn’t speak German with empathy.

---

## 9. Platform play — Vera Group

Denis Table OS is **multi-tenant by design**:

| Scope | Runtime | Data |
|-------|---------|------|
| **Table** | Denis loop, party, cart, transcript | `denis_timeline`, session view |
| **Venue** | Ops beliefs, floor graph, VKG, schedules | M13–M16 |
| **Org** | Rollout, credits, eval, brand | ADR-009 commercial spine |
| **Platform** | Eval harness, sim, compliance | ADR-006 control plane |

One codebase → **1000 venues**, each with **its own VKG and ops**, same **cognitive architecture**.

That is the asset Microsoft would need years to replicate in hospitality — not because LLM is hard, but because **table event model + ACL + eval** is hard.

---

## 10. Engineering map (vision → code)

Vision lives here (ADR-020). **Shipping** follows [ADR-019](./ADR-019-denis-unified-brain.md):

| Vision capability | Phase | Code anchor |
|-------------------|-------|-------------|
| KO/GDE/KAD/KAKO fold | **A** | `fold-table-session-state.ts` |
| Single guest read | **B** | `GET /api/denis/view` |
| Single guest write | **C** | `POST /api/denis/signal` |
| WORLD → proactive TELL + push | **D** | outbox → `run-denis-loop` |
| Goal stack SELL/SETTLE | exists | `kernel/goal-stack.ts` |
| VKG pairing | exists | `kernel/vkg/` |
| Floor + rush | exists | `venue/floor/`, `venue/ops/` |
| Party multi-phone | exists | `venue/party/` |
| Eval regression | exists | `pnpm eval:denis` |

**Production bar:** Phase D + `denis_only` on pilot → then marketing.

---

## 11. Non-negotiables (trust at scale)

1. **Money path = ACL only** — Denis never “hallucinates paid”  
2. **T3 never decides** — sell/serve/settle = code  
3. **Timeline append-only** — replay any dispute  
4. **Consent for memory** — GDPR-native  
5. **Staff override** — human can pause Denis per table  
6. **Eval before prompt changes** — quality is engineered  

---

## 12. One line for the pitch

> **Denis is the operating system for every table** — who is seated, where they are in the meal, when the kitchen moves, and how to serve, sell, and settle — in one continuous mind guests trust and venues measure.

Microsoft can add a sidebar. **We run the room.**

---

## 13. Document map

| Read for… | Document |
|-----------|----------|
| Category vision (this) | **ADR-020** |
| Signal/view loop, phases A–D | [ADR-019](./ADR-019-denis-unified-brain.md) |
| Beliefs, goals, VKG | [ADR-004](./ADR-004-denis-kernel.md) |
| Venue OS, party, floor | [ADR-005](./ADR-005-denis-maximum.md) |
| Scene UI grammar | [ADR-017](./ADR-017-denis-scene-first-presentation.md) |
| As-built + phases | [denis-implementation-map.md](./denis-implementation-map.md) |

---

## 14. Can this be even better? (yes — second-order design)

ADR-019/020 are directionally correct. These refinements remove the **last structural weaknesses** before implementation:

| Weakness in v1 docs | Upgrade |
|---------------------|---------|
| Too many names (`beliefs`, `snapshot`, `scene`, `state`) | **Truth · Mind · Face** (§15) |
| HTTP request = stateless turn (race on two phones) | **Table Session Actor** — one writer (§16) |
| ADR-013 `runGuestExperiencePipeline` parallel to Denis | **Experience triggers → Denis signals** (§17) |
| Guest polls order/scene/chat | **View stream** on materialized Face (§18) |
| “Smart Denis” not measurable for venues | **Commerce cognition metrics** (§19) |

If we ship Phase A–D **without** §16–§18, Denis is smarter on paper — guests still feel polling and drift. **Phases A–D + E** is the complete architecture.

---

## 15. Truth · Mind · Face — one vocabulary

Stop saying five words for the same thing. Entire company uses:

```
TRUTH  →  what actually happened (immutable)
MIND   →  what Denis believes right now (folded, discardable)
FACE   →  what humans see (projected, versioned)
```

| Layer | Storage | Mutability | Examples |
|-------|---------|------------|----------|
| **TRUTH** | `denis_timeline` + Order Core rows + fiscal journal | Append-only | order #017 ready, guest tapped chip, payment settled |
| **MIND** | In-memory per loop; derived | Rebuilt every loop | goal SELL, merged cart conflict, rush belief |
| **FACE** | `table_session_view` (+ staff/dashboard faces) | PROJECT only | dock, transcript, push text, chips |

**Rules:**

- UI reads **FACE** only (`GET /api/denis/view` or SSE — §18).
- DECIDE reads **MIND** only (`foldTableSessionState()`).
- FOLD reads **TRUTH** only (timeline + commerce facts + venue ops).
- Nothing writes FACE except PROJECT. Nothing writes TRUTH except SIGNAL append + ACL commits.

`TableSessionState` in code = **Mind**. `TableSessionView` = **Face**. Document both terms once; use Mind/Face in product speech.

---

## 16. Table Session Actor — one brain, one writer

**Problem:** Two phones + kitchen event + cron in the same second = three parallel `runDenisTurn` calls → race on cart, double TELL, wrong goal.

**Fix:** Each `table_session_id` has a **logical actor** — exactly one loop runs at a time.

```
signal enqueue ──► Redis stream / PG queue per table_session_id
                         │
                         ▼
              TableSessionActor.processNext()
                         │
                   DENIS LOOP (serialized)
                         │
                   PROJECT Face v++
```

| Property | Value |
|----------|-------|
| Concurrency | **One loop** per table session (distributed lock or queue consumer) |
| Signal ordering | FIFO per session; world events interleave fairly |
| Idempotency | `signalId` dedupe — safe retries |
| Lifetime | Actor “hot” while session open; cold start from TRUTH fold |

This is how you get **Continuous Table Mind** for real — not a slogan on stateless serverless.

**Phase E** (after D): `TableSessionActor` + signal queue. Without it, multi-device tables stay fragile.

---

## 17. One orchestrator — absorb guest journey (ADR-013)

[ADR-013](./ADR-013-competitive-guest-journey.md) proposed `runGuestExperiencePipeline()` as a **second brain** for feedback, tips, reorder chips.

**That was wrong shape.** Better architecture:

| ADR-013 trigger | Becomes Denis signal |
|-----------------|----------------------|
| `payment_settled` | `commerce.payment_settled` → goal SETTLE → TELL thanks |
| `order_delivered` | `commerce.order_delivered` → schedule DELIGHT (review) |
| `session_active` | `telemetry.session_open` → menu projection in FACE |
| `floor_tick` capacity | `venue.capacity` → honest wait banner in FACE |

`runGuestExperiencePipeline` → **deleted or thin wrapper** that only enqueues Denis signals. Same move as fiscal: one spine ([ADR-012](./ADR-012-fiscal-journal-spine.md)), not two.

Enterprise [ADR-014](./ADR-014-commerce-experience-platform.md) capability registry still applies — but **capabilities emit signals into Denis**, not parallel UX writers.

---

## 18. Face transport — push the view, not the guest

Polling `GET /view` every N seconds is **menu-app architecture**, not Table OS.

**Target:**

```
PROJECT completes → bump face.version
                 → Supabase Realtime / SSE: table_session_view:{id}
                 → all devices + dock redraw instantly
```

Guest phone locked during kitchen prep → realtime still updates **FACE** in DB → push notification → open app → **view already current**.

Signal/write stays `POST /api/denis/signal`. Read becomes **subscribe + initial snapshot**, not poll loop.

---

## 19. Commerce cognition — prove Denis earns money

Venues buy Denis when metrics move. Platform exposes per session:

| Metric | Meaning |
|--------|---------|
| `denis.attach_rate` | % sessions with ≥1 SELL goal accepted |
| `denis.pairing_yield` | € from VKG-suggested adds |
| `denis.round2_rate` | second order via Denis chip vs menu alone |
| `denis.time_to_order` | scan → first ACT submit |
| `denis.proactive_save` | complaints avoided (RECOVER triggered, resolved) |

All derived from **TRUTH timeline** — not analytics guesswork. This is the **data flywheel** Copilot-on-POS cannot copy without your event model.

---

## 20. Updated phase map (A → E)

| Phase | Delivers | Without it… |
|-------|----------|---------------|
| **A** | FOLD → Mind from TRUTH | Denis blind |
| **B** | FACE API (`view`) | UI merges 5 sources |
| **C** | SIGNAL API | Hybrid REST survives |
| **D** | WORLD → proactive TELL + guest push | Denis silent after order |
| **E** | Actor queue + view stream + ADR-013 absorption | Races, poll, dual orchestrator |

**Marketing gate:** Phase **D** on pilot. **Scale gate:** Phase **E** before multi-device + chain rollout.

---

## 21. Document map (updated)

| Read for… | Document |
|-----------|----------|
| Category vision | **ADR-020** (this) |
| Truth·Mind·Face, Actor, phases A–E | **ADR-020 §15–§20** |
| Loop + signal/view | [ADR-019](./ADR-019-denis-unified-brain.md) |
| Guest journey triggers (signals only) | [ADR-013](./ADR-013-competitive-guest-journey.md) — subsume per §17 |
