# Denis Table OS — Maximum Architecture

| Field | Value |
|-------|--------|
| **Status** | **Accepted** — engineering north star for Denis product |
| **Date** | 2026-05-29 |
| **Product** | **Denis** — universal hospitality platform; AI Table OS is the crown jewel |
| **Company** | Vera Group (subline only — not product name) |
| **Extends** | [ADR-020](./ADR-020-denis-table-operating-system.md) · [ADR-019](./ADR-019-denis-unified-brain.md) · [ADR-023](./ADR-023-denis-maximum-runtime.md) |
| **Related** | [ADR-001](./ADR-001-universal-ordering-platform.md) · [ADR-025](./ADR-025-tde-state-driven-routing.md) · [ADR-029 Integration spine](./ADR-029-denis-integration-spine.md) · [ADR-028 Viktor partner](./ADR-028-viktor-denis-integration.md) · [denis-implementation-map.md](./denis-implementation-map.md) |
| **Implement tracks** | [DENIS-TABLE-OS-session-prompts.md](./DENIS-TABLE-OS-session-prompts.md) |

---

## 0. One sentence

**Denis Table OS is a continuous, event-sourced runtime per table session — it knows everything true about the table (Ko·Gde·Kad·Kako), acts like a head waiter within policy bounds, and exposes only `signal` in and `view` out.**

---

## 1. Product definition

### 1.1 What Denis is

| Layer | Name | Role |
|-------|------|------|
| **Runtime unit** | **Table OS** | One brain per `table_session_id` — guest, party, cart, orders, timeline |
| **Platform** | **Denis POS + ordering** | Order Core, waiter/KDS, payments, admin — global, integration-ready |
| **Differentiator** | **Denis AI** | Waiter-level cognition on the table — not a chat plugin |
| **Owner surface** | **Operator integrations** | Viktor, webhooks, analytics — reads platform truth |

**Denis is the product.** Guests and staff say Denis. POS, fiscal, and partner APIs are **capabilities of Denis**, not separate products.

### 1.2 What we offer (go-to-market stack)

Planned packaging — architecture must support all three from day one:

```
┌─────────────────────────────────────────────────────────────┐
│  DENIS AI — Table OS (crown jewel)                          │
│  Waiter-grade · signal/view · global · ACL-safe             │
├─────────────────────────────────────────────────────────────┤
│  DENIS PLATFORM — POS + ordering + integrations           │
│  Guest · waiter · KDS · payments · fiscal modules           │
├─────────────────────────────────────────────────────────────┤
│  DENIS + VIKTOR — operator layer (planned partner)          │
│  Owner Slack · KPI · sessions · alerts · config proposals   │
└─────────────────────────────────────────────────────────────┘
```

| Buyer question | Answer |
|----------------|--------|
| Who serves the guest? | **Denis only** — never Viktor at the table |
| Who runs the restaurant floor? | Denis POS + staff surfaces |
| Who helps the owner in Slack? | **Viktor** reading **Denis Operator API** |
| Single source of truth? | Denis TRUTH (timeline + orders) — Viktor has no copy |

Full partner spec: **[ADR-028](./ADR-028-viktor-denis-integration.md)**.

**Design rule:** every feature we build must answer — *what does Operator API expose? what webhook fires?* If neither, it's guest/staff-only (still OK).

### 1.3 What Table OS is not

- Not a menu app with AI bolt-on  
- Not “LLM controls the cash register”  
- Not DE-only — **market modules** plug into one global core  
- Not two AIs for the guest (Viktor is owner/operator layer only)

### 1.4 Waiter parity (north star)

Denis must do **everything a great head waiter does at the table**:

| Waiter job | Table OS mechanism |
|------------|-------------------|
| Greet, read mood, language | Ko + `relational_perceive` |
| Understand “Može”, “Daj mi sok”, banter | perceive + transcript (ADR-025) |
| Take order, clarify size/modifier | `transactional_perceive` → ACT → cart |
| Know menu, allergens, 86 | VKG + catalog + venue ops |
| Track kitchen | world signals → `INFORM_STATUS` |
| Upsell when appropriate | goal SELL, blocked in rush |
| Cannot do X → call colleague | handoff skills, RECOVER goal |
| Bill & pay | SETTLE goal, Stripe, fiscal module |
| Never lie about food that doesn’t exist | ACL + snapshots — LLM never writes TRUTH |

**Boundary rule:** LLM **interprets and speaks**; **policy + ACL execute**.

---

## 2. The five planes

```
┌─────────────────────────────────────────────────────────────────┐
│ 5 · ENTERPRISE / OPERATOR                                         │
│    Viktor connector · org analytics · manifest · sim-before-ship  │
├─────────────────────────────────────────────────────────────────┤
│ 4 · INTEGRATION HUB                                               │
│    POS · delivery · payments · printers · KDS · accounting · CRM  │
├─────────────────────────────────────────────────────────────────┤
│ 3 · TABLE OS (Denis mind)                                         │
│    Actor · FOLD · beliefs · goals · perceive · ACT · TELL · view  │
├─────────────────────────────────────────────────────────────────┤
│ 2 · ORDER PLATFORM (ADR-001)                                      │
│    Order Core · outbox · idempotency · fulfillment · fiscal spine │
├─────────────────────────────────────────────────────────────────┤
│ 1 · TRUTH (immutable)                                             │
│    denis_timeline · orders · order_items · fiscal journal · ACL log│
└─────────────────────────────────────────────────────────────────┘
```

**Dependency rule:** upper planes **read** lower planes; only **ACT + outbox** mutate commerce/fiscal TRUTH.

---

## 3. Ko · Gde · Kad · Kako

Every turn rebuilds context from TRUTH — no orphan prompt state.

### 3.1 KO — Who

```typescript
type WhoContext = {
  party: { devices; primaryDevice?; language; memory? };
  role: "guest" | "staff" | "system";
  actorId: string;
};
```

Sources: party model, `compileBeliefs` language, consented guest memory.

### 3.2 GDE — Where

```typescript
type WhereContext = {
  table: { id; name; zone; token };
  venue: { id; operatingMode; locale; marketModule };
  floor: { seatedMinutes; kdsStress; tableHint? };
  journeyPhase: "latent" | "browsing" | "ordering" | "waiting" | "settling" | "closed";
};
```

Sources: `TableSessionState`, venue ops, floor graph (M13–M14).

### 3.3 KAD — When

```typescript
type WhenContext = {
  timeline: TimelineCursor;
  schedules: DueSchedule[];
  triggers: { lastGuestSignal; lastTell; orderStatusChanged?; paymentSettled? };
  venueSchedule: { kitchenOpen; barOpen };
};
```

Sources: timeline, scheduler (M8), world signals (Phase D).

### 3.4 KAKO — How

```typescript
type HowContext = {
  channel: "chip" | "chat" | "voice" | "push" | "proactive" | "staff";
  goal: DenisGoal;                    // from goal stack
  allowedActions: ActionCapability[]; // policy — what ACT may do now
  narrationStyle: "full" | "brief" | "silent";
};
```

**Fold rule:**

```typescript
TableSessionState = fold(KO, GDE, KAD, KAKO, connectorSnapshots?)
BeliefGraph     = compileBeliefs(TableSessionState, guestMessage)
```

---

## 4. The runtime loop

Single orchestrator — ADR-019 phases A→F.

```
                    ┌──────────────┐
   guest/staff ───►│   SIGNAL     │ normalize → timeline append
   world event  ───►│  ingress     │
   scheduler    ───►└──────┬───────┘
                            ▼
                    ┌──────────────┐
                    │    FOLD      │ TableSessionState + truthHash
                    └──────┬───────┘
                            ▼
                    ┌──────────────┐
                    │ compileBeliefs│ scored, logged mind.beliefs_compiled
                    └──────┬───────┘
                            ▼
                    ┌──────────────┐
                    │   DECIDE     │ T0? template? InterpretationTask?
                    └──────┬───────┘
                            ▼
                    ┌──────────────┐
                    │   PERCEIVE   │ only if plan.requiresLlm
                    └──────┬───────┘
                            ▼
                    ┌──────────────┐
                    │     ACT      │ skills + ACL → Order Core
                    └──────┬───────┘
                            ▼
                    ┌──────────────┐
                    │     TELL     │ template → optional T3 narrate
                    └──────┬───────┘
                            ▼
                    ┌──────────────┐
                    │   PROJECT    │ view + SSE + push
                    └──────────────┘
```

### 4.1 Guest API surface (only two write/read doors)

| API | Role |
|-----|------|
| `POST /api/denis/signal` | All guest/staff/world writes (Phase C/E) |
| `GET /api/denis/view` (+ SSE) | One projection — transcript, layers, chrome |

Legacy `/api/ai/chat`, `/api/denis/turn` → thin wrappers until Phase F retires.

### 4.2 Table Session Actor

FIFO queue per `table_session_id` — no two-phone races (Phase E).

```
POST signal → enqueue → lock → executeDenisSignalCore → result
```

---

## 5. Cognition — Truth → Belief → Policy → Language

### 5.1 TRUTH (immutable)

- `denis_timeline` append-only  
- `orders` + `order_items` (price snapshots)  
- fiscal journal (ADR-012)  
- consented guest memory  

**LLM never writes here.**

### 5.2 BELIEF (derived, replayable)

Core keys (extend per MR-1):

| Key | Example |
|-----|---------|
| `conversation.language` | `sr` |
| `conversation.mode` | `banter` \| `ordering` \| `settling` |
| `commerce.pending_slot` | `serve_size` |
| `commerce.pressure` | `none` \| `open` \| `confirm` *(target)* |
| `venue.rush` | `true` |
| `venue.skip_upsell` | `true` |
| `policy.require_confirm` | `true` |

Logged: `mind.beliefs_compiled` for enterprise replay.

### 5.3 POLICY (code only)

```
beliefs + flowNode + cart + goals → deriveGoalStack → planTurnWithReflex → skills → ACL
```

Goal priority (waiter model):

| P | Goal | Blocks selling |
|---|------|----------------|
| 0 | RECOVER | always |
| 1 | SERVE | allergy, conflict |
| 2 | SETTLE | bill flow |
| 3 | SELL | rush, KDS stress, dismissed nudge |
| 4 | DELIGHT | optional |

**Invariants:**

- Money, submit, storno, fiscal → **ACT + ACL only**  
- Upsell suppressed when `venue.skip_upsell`  
- R0–R5 risk gate before skills  

### 5.4 LANGUAGE (last)

```
decideTurnPlan → planUtterance → [perceive if requiresLlm] → TELL → leadership sanitizer
```

#### Three layers (ADR-025) — not regex gatekeeping

| Layer | Plan kinds | Credits |
|-------|------------|---------|
| **L0** | T0 reflex, handoff, chips | 0 |
| **L1** | cart conflict, status, slot template | 0 |
| **L2** | `relational_perceive` \| `transactional_perceive` | 0–1 |

**Director rule:** regex may **hint** beliefs; it may **not veto** LLM for free guest text.

#### Target ceiling (L3) — goal-directed interpretation

```
topGoal + beliefs → InterpretationTask { schema, evidenceBudget }
  → structured perceive → ACT validates → TELL
```

No `banter.welcome` as default guest reply path.

---

## 6. Continuous Table Mind

Denis runs **while session is open** — not only on chat messages.

| Signal | Example | Response |
|--------|---------|----------|
| Guest chat | “Daj mi sok” | perceive → cart |
| Guest chip | Kellner | T0 handoff |
| World | order → ready | TELL + push (same headline) |
| World | payment settled | SETTLE |
| Scheduler | proactive tick | nudge if policy allows |
| Venue | item 86 | belief → VKG substitute |
| Staff hint | VIP comp | belief → safe paraphrase |

**Proactivity is default waiter posture**, not a feature flag.

---

## 7. Integration Hub (global platform)

Denis POS connects to **external systems** through the **Integration Spine** ([ADR-029](./ADR-029-denis-integration-spine.md)) — three channels (egress, ingress, outbox connectors), contract-first, guest path isolated.

**Viktor** is the first **operator** connector ([ADR-028](./ADR-028-viktor-denis-integration.md)); code must not special-case Viktor in runtime.

### 7.1 Connector model

```typescript
type Connector = {
  id: string;                    // e.g. "toast", "viktor", "deliverect"
  category: "pos" | "delivery" | "payment" | "operator" | "hardware" | "crm";
  auth: "oauth" | "api_key";
  capabilities: ("push_order" | "pull_catalog" | "webhook_in" | "read_analytics")[];
};
```

Registry: `src/lib/integrations/` *(target)* — today partial via outbox + webhooks.

### 7.2 Categories

| Category | Examples | Direction |
|----------|----------|-----------|
| **POS** | Toast, Square, Lightspeed, Clover, DE legacy | push order, sync catalog |
| **Delivery** | Deliverect, Uber Eats | order in/out |
| **Payments** | Stripe Connect (global) | pay, split, tip |
| **Hardware** | Star, Epson, KDS | print, display |
| **Operator** | **Viktor** | read sessions, KPI, webhooks — **async only** |
| **Accounting** | DATEV, QuickBooks | export |

### 7.3 Viktor × Denis (strategic — ADR-028)

**Viktor integration is part of the product plan**, not a future maybe. Architecture requirements:

1. **Denis at peak** — O0–O1 before Viktor API (bad data kills partner value)  
2. **Operator API** — stable read contract for locations, sessions, Denis metrics  
3. **Webhooks** — async events Viktor consumes (never sync guest wait)  
4. **Telemetry by design** — conversion, LLM rate, language, failures in every summary  
5. **Proposal-only writes** — Viktor suggests config; owner approves in Denis  

```
Owner: "@viktor kako radi Denis večeras?"
  → Viktor Skill
  → GET /api/operator/v1/locations/{id}/summary
  → Denis metrics: 52 sessions, 34 orders, 65% conversion, 2 alerts

Guest at table 5: "Može"
  → Denis Table OS only (Viktor not in path)
```

Operator API endpoints — see [ADR-028 §4](./ADR-028-viktor-denis-integration.md).

**Flywheel:** strong Denis → rich Operator feed → Viktor recommends Denis to hospitality customers.

---

## 8. Market modules (one core, many jurisdictions)

**Never fork Order Core per country.** Plug compliance modules.

| Module | Scope | Status |
|--------|-------|--------|
| `market.de` | KassenSichV, TSE, GoBD, DSFinV-K | ✅ primary |
| `market.us` | sales tax, tip semantics, receipt | 🔲 |
| `market.uk` | VAT display | 🔲 |
| `market.eu` | generic eReceipt | 🔲 |

```typescript
type MarketModule = {
  id: "de" | "us" | "uk" | "eu";
  fiscalPipeline: FiscalProvider;
  derivedConfig: (location) => FiscalMode;
};
```

Fiscal behavior **derived** from location + connectors — never staff toggle (ADR-001 §8).

---

## 9. Surfaces (one mind, many faces)

| Surface | User | Entry | Same loop? |
|---------|------|-------|------------|
| **Guest** | Diner | QR → view + signal | ✅ |
| **Waiter POS** | Staff | `/waiter` local-first | ✅ (staff signal) |
| **Kitchen** | Line | KDS | world + staff |
| **Admin** | Owner | menu, config, integrations | config only |
| **Copilot** | Manager | `/dashboard/denis` | read + hints |
| **Viktor** | Owner chain | Slack | read operator API |

Staff and guest share **TRUTH** — party/cart conflict resolved in FOLD.

---

## 10. Code shape (target)

```
src/lib/denis/
├── loop/              FOLD, project-view, tell-world-order
├── ingress/           normalize-signal
├── actor/             table-session FIFO
├── cognition/
│   ├── beliefs/       compileBeliefs
│   ├── tde/           decideTurnPlan, templates
│   └── context/       evidence retrievers
├── kernel/            goals, reflex, VKG, flow, scheduler
├── venue/             party, ops, floor, copilot
├── runtime/           runDenisTurn, perceive, act, narrate
├── acl/               Order Core exit only
├── integrations/      connector registry + adapters  ← expand
└── eval/              waiter parity fixtures

src/lib/orders/        Order Core (ADR-001)
src/lib/fiscal/        market modules (ADR-011/012)
src/app/api/denis/     signal, view
src/app/api/operator/  partner read API               ← new
```

---

## 11. LLM boundary (non-negotiable)

| Tier | Role | May mutate orders? |
|------|------|-------------------|
| T0 | reflex, chips, handoff | via correction protocol only |
| T1 | skills plan | no — schedules ACT |
| T2 | slot extract JSON | no — proposes structure |
| T3 | narrate committed facts | **never** |

Perceive produces **intent + structured fields**; ACT + ACL commit.

**Forbidden:**

- LLM direct `create-order`  
- Guest UI → Order Core bypass  
- Module-level mutable session cache (serverless)  
- Regex as LLM gate (ADR-025)  
- Viktor blocking guest turn  

---

## 12. Implementation phases

**Denis peak first, Viktor second** — O4/V* blocked until O0–O1 pass.

```
O0  Cognition fix        ADR-025 T1–T3 (routing, pressure, evidence)     ← NOW
O1  Waiter parity eval  40 scenarios → eval:denis ≥ 95%                 ← VIKTOR GATE
O2  World loop complete order ready → push = TELL + webhooks
O3  Integration SDK     registry + POS adapters
O4  Operator API        ADR-028 V1–V3 — Viktor partner read path
O5  Market US module    tax/tips/receipt (no DE fork)
O6  Signal/view GA      retire legacy chat path (Phase F)

Viktor partner (external, after O4):
V4  Viktor Skill read-only · V5 proposals · V6 marketplace GTM
```

One PR per track step. Each must pass `pnpm verify:denis && pnpm type-check && pnpm build`.

### 12.1 Feature checklist (Viktor-ready)

When shipping any Denis feature, verify:

| Question | Required for Viktor tier |
|----------|--------------------------|
| Does it affect conversion or session outcome? | Expose in `denis/metrics` |
| Does it change operational state? | Webhook event defined |
| Is it owner-visible? | Include in `location/summary` |
| Guest-facing only? | No Operator API needed |

---

## 13. Waiter parity checklist (eval contract)

Minimum **40 scenarios** in `src/lib/denis/eval/fixtures/waiter-parity/`:

| # | Scenario | Must |
|---|----------|------|
| 1 | SR confirm “Može” after offer | T0 or transactional — never welcome reset |
| 2 | “Daj mi sok” | cart action or clarify — never banter template |
| 3 | “Merhaba” at QR table | reply in inferred language |
| 4 | GUEST_SEATED banter | no reservation offer |
| 5 | Allergy mention | SERVE goal, no upsell |
| 6 | Complaint | RECOVER + handoff option |
| 7 | Rush mode | no dessert upsell in layers |
| 8 | Order ready world signal | push matches transcript |
| 9 | Party conflict | reconcile before submit |
| 10 | 86 item | honest substitute from VKG |
| … | … | … |

**Gate:** `pnpm eval:denis` ≥ 95% waiter parity suite before pilot GA.

---

## 14. Success metrics

| Metric | Target | Plane |
|--------|--------|-------|
| Session → order conversion | > 55% pilot | Table OS |
| Guest reply → useful action | > 90% | Cognition |
| banter.welcome on free text | **0%** | ADR-025 |
| Order reach kitchen | 100% | Order Core |
| Fiscal compliance DE | 100% journal path | Market DE |
| llm_invocation_rate | 25–35% | Commercial |
| Viktor operator API uptime | 99.9% | Integration |
| p95 guest signal latency | < 3s local perceive | Runtime |

---

## 15. Anti-patterns (reject in review)

1. Expanding `ORDERING_GUEST_PATTERN` instead of state-driven perceive  
2. Second brain for guest (Viktor sync wait)  
3. `inject-belief` from external systems mid-session  
4. Config PATCH without proposal + audit  
5. Light-theme admin for Denis surfaces  
6. Duplicate side effects (outbox + fire-and-forget)  
7. German-only assumptions in core types  

---

## 16. Document map

| Question | Read |
|----------|------|
| Why Table OS category? | ADR-020 |
| Loop phases A–F | ADR-019 |
| Belief/TDE/manifest | ADR-023 |
| Routing bug fix | ADR-025 |
| Order Core / outbox | ADR-001 |
| As-built code | denis-implementation-map |
| POS speed (staff) | POS-SPEED-ARCHITECTURE |
| Staff permissions | ADR-024 |
| Viktor partner integration | ADR-028 |
| **All integrations (how)** | **ADR-029** |
| **This doc** | Whole-stack north star |

---

## 17. Summary

**Denis Table OS** = continuous waiter-grade runtime per table, on a **global ordering platform**, with **integration hub** for POS and operators like Viktor.

- **Revolutionary** = FOLD sees everything + ACT executes + never lies  
- **Pametan** = perceive with context, not word lists  
- **Zna granice** = goals + ACL + handoff  
- **Universal** = one core, market modules, connector catalog  
- **Viktor** = owner radar on Denis Operator API — **planned product tier**, async only  

Build order: **Denis at peak (O0–O1) → world + webhooks (O2) → Operator API (O4) → Viktor Skill (partner V4).**

---

## 18. Locked architecture decisions (do not revisit without ADR)

These are **fixed** — all PRs and partner talks assume this:

| # | Decision | Rationale |
|---|----------|-----------|
| L1 | **Denis standalone at table** — 100% guest/staff path, never waits on Viktor | Product integrity, latency, ACL |
| L2 | **Viktor = data consumer** — Operator API + webhooks, not co-brain | Viktor’s job is wider than Denis |
| L3 | **No sync escalation** — handoff template + async events | Serverless, single brain |
| L4 | **State-driven perceive** (ADR-025) — not regex LLM gate | Multilingual, waiter parity |
| L5 | **relational vs transactional** — not “all LLM → commerce JSON” | Correct cognition + cost |
| L6 | **Write = proposal** — config/playbook via owner approve | Safety, fiscal, audit |
| L7 | **One TRUTH** — timeline + orders; Viktor has no shadow DB | Single replay, eval |
| L8 | **Global core + market modules** — no country fork | US/UK/EU on same Order Core |
| L9 | **signal / view** — guest API surface | ADR-019 |
| L10 | **ACT + ACL only** for money and submit | KassenSichV, GoBD |

**Cursor analogy (GTM):** Denis = what runs the restaurant floor (like the IDE runs the codebase). Viktor = what runs the owner’s business layer (like Cursor runs the developer’s workflow). **Integration makes Denis the default hospitality connector in Viktor.**

---

## 19. Product flywheel — Denis × Viktor

```
                    ┌─────────────────────┐
                    │  Restaurant owner   │
                    │  (uses Viktor daily)│
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
     ┌─────────────────┐              ┌─────────────────┐
     │  VIKTOR         │   read/      │  DENIS          │
     │  Slack, finance,│◄──webhook───►│  Table OS + POS │
     │  ops, marketing │              │  (runs the floor)│
     └─────────────────┘              └─────────────────┘
              │                                 │
              └──────── "How's Denis tonight?" ─┘
                        same TRUTH, no duplicate
```

**Why this architecture wins:**

1. Owners already adopt Viktor for **many** tasks — Denis becomes the **restaurant system Viktor understands best**.  
2. Denis is **complete** (POS, KDS, pay, AI) — not a chat plugin Viktor must glue.  
3. Rich Operator feed (conversion, sessions, alerts) → Viktor **recommends Denis** to hospitality vertical.  
4. Denis quality drives Viktor value; Viktor distribution drives Denis adoption — **mutual boom**.

**What we must ship for flywheel to work:**

| Priority | Deliverable | Enables |
|----------|-------------|---------|
| P0 | ADR-025 cognition | Denis actually smart — Viktor sees good metrics |
| P1 | `/api/operator/v1/` read | Viktor Skill |
| P2 | Webhooks + session outcome rollup | Real-time owner alerts |
| P3 | OpenAPI + sandbox org | Viktor dev integration |
| P4 | Admin “Connect Viktor” | Self-serve onboarding |
| P5 | Marketplace / joint GTM | Scale |

Prompts: [VIKTOR-DENIS-CURSOR-PROMPTS.md](./VIKTOR-DENIS-CURSOR-PROMPTS.md)

---

## 20. Single entry point for engineers

**Read in order:**

1. **This doc** — whole stack + locked decisions  
2. [ADR-029](./ADR-029-denis-integration-spine.md) — **integration spine** (all partners)  
3. [ADR-028](./ADR-028-viktor-denis-integration.md) — Viktor partner contract  
4. [ADR-025](./ADR-025-tde-state-driven-routing.md) — cognition fix  
5. [denis-implementation-map.md](./denis-implementation-map.md) — as-built code  
6. [VIKTOR-DENIS-CURSOR-PROMPTS.md](./VIKTOR-DENIS-CURSOR-PROMPTS.md) — agent tasks  

**Operator one-liner:**

```
Denis Table OS + Viktor integration. Pročitaj DENIS-TABLE-OS-ARCHITECTURE.md §18–19.
Uradi sledeći track iz VIKTOR-DENIS-CURSOR-PROMPTS.md (P0 done → P1 Operator API).
IMPLEMENTIRAJ + testovi. Ne commit-uj osim ako kažem.
```

---

*End of Denis Table OS — Maximum Architecture*
