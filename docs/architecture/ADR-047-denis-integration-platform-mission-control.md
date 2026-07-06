# ADR-047: Denis Integration Platform + Mission Control

| Field | Value |
|-------|--------|
| **Status** | **Accepted** — product + integration north star |
| **Date** | 2026-07-05 |
| **Product** | **Denis** — hire an AI co-worker, not a POS dashboard |
| **Parent** | [ADR-029](./ADR-029-denis-integration-spine.md) · [ADR-001 §9](./ADR-001-universal-ordering-platform.md) · [ADR-043 §4.4](./ADR-043-denis-coworker-completion.md) · [ADR-020](./ADR-020-denis-table-operating-system.md) |
| **Supersedes framing** | ADR-001 “Deliverect-first Track C” as **company foundation** — Deliverect remains **first aggregator adapter**, not architectural center |
| **Blocked by** | [ADR-046 stabilization freeze](./ADR-046-stabilization-freeze.md) for **new feature PRs** — this ADR is **direction only** until freeze lifts |

---

## 0. One sentence

**Denis is a restaurant colleague who works with everyone already in the house — POS, kitchen, bar, payments, delivery — never against them; DIP is how he plugs in; Mission Control is how the team watches him work.**

---

## 1. Decision

We sell **Denis** — a **colleague on the floor**, not “AI software”. Guests and staff say *Denis*, the way they say a teammate’s name. He tracks orders, talks to kitchen and bar, watches the room, and hands off to systems that already exist.

We do **not** sell Deliverect, POS replacements, or a platform war with Toast / Orderbird / Lightspeed.

| We sell | We do not sell |
|---------|----------------|
| **Hire Denis** — “I added another colleague” | AI chatbot / ordering widget |
| Denis **works with** your stack | Denis **replaces** your stack |
| **Mission Control** — what Denis is doing now | Generic ops admin (Orders-first home) |
| Integration with **everyone** (over time) | One-vendor lock-in |
| POS / KDS / pay stay where they are | In-house waiter POS for mass market |

### 1.1 Co-worker, not competitor (locked)

Same doctrine as [Viktor × Denis](./ADR-028-viktor-denis-integration.md): **partner, not rival**.

| Actor | Role | Relationship to Denis |
|-------|------|------------------------|
| **Guest** | Served at table | Denis is **their** colleague |
| **Waiter / bar / kitchen** | Run stations | Denis **supports** — Question Card, status, handoff — does not replace station apps |
| **POS** (Toast, Orderbird, …) | Register, TSE, Beleg | Denis **sends** orders in; POS **owns** fiscal |
| **KDS / bar display** | Prep truth | Denis **reads** station state; may nudge; does not replace screens |
| **Stripe / SumUp** | Payment rails | Denis **uses**; does not rebuild payments |
| **Deliverect / hubs** | POS connectivity | Denis **uses** one adapter; hub is swappable |
| **Viktor** | Owner’s wider ops AI | Denis **feeds** Operator API; Viktor never blocks guest |
| **Reservations / delivery** | Adjacent tools | Denis **connects** when API exists — same DIP rules |

**Hard rule:** Denis never positions as *“throw away your POS”*. Always *“keep your team and tools — Denis joins the shift.”*

**Hard rule:** In product copy, prefer **colleague / co-worker / teammate** over **AI** unless speaking to technical buyers.

### 1.2 Universal integration — works with everyone

**Strategic goal:** Denis must be able to integrate with **every system a restaurant already uses** — not one POS, not one country, not one middleware.

That does not mean we build 500 adapters in year one. It means:

1. **Architecture** supports any connector (ADR-029 categories).
2. **Denis still runs** when a connector is missing (T3 fallback).
3. **Roadmap** adds connectors by market demand — direct where API is strong, aggregator where breadth wins.
4. **No competitor framing** in sales, docs, or onboarding — only *“Connect what you already have.”*

```
                    ┌─────────────────────────────────────┐
                    │  Denis — floor colleague (TRUTH)     │
                    │  orders · guests · kitchen · bar   │
                    └──────────────────┬──────────────────┘
                                       │ DIP (same rules for all)
         ┌─────────────┬───────────────┼───────────────┬─────────────┐
         ▼             ▼               ▼               ▼             ▼
       POS          KDS/Bar        Payments        Delivery      Operator
    Toast etc.     stations       Stripe etc.     Uber/Wolt     Viktor
         │             │               │               │             │
         └─────────────┴───────────────┴───────────────┴─────────────┘
                              existing tools — unchanged ownership
```

**Connector categories (DIP registry target):**

| Category | Examples | Denis uses it to… |
|----------|----------|---------------------|
| `pos` | Orderbird, Lightspeed, Deliverect, webhook | Push order, sync status, table map |
| `hardware` | Printers, CloudPRNT | Tickets when POS has no API |
| `payment` | Stripe Connect, SumUp | Guest pay (already core) |
| `delivery` | Uber Eats, Wolt via hub | Status ingress — optional |
| `operator` | Viktor | Egress read — owner intelligence |
| `accounting` | DATEV export | Egress batch — not hot path |
| `crm` | Future | Guest prefs — proposal-only |

POS is **first mass-market connector family**, not the **only** integration story. Kitchen/bar station truth ([ADR-043](./ADR-043-denis-coworker-completion.md)) is **internal co-worker** work — Denis already “integrates” with your team without replacing KDS.

### 1.3 What Denis does on shift (product truth)

Denis is the colleague who:

- Talks to **guests** (allergies, order, pay, wait truth)
- Tracks **every order** through the shift (timeline, not a spreadsheet)
- Coordinates **kitchen and bar** (station questions, delays, ready-not-picked)
- Hands off to **POS** when the register must record the sale
- Surfaces **Mission Control** so the owner sees *what Denis did* — not raw POS dumps

He is **not** the cash register. He is **not** the fry station screen. He is the person who makes the whole shift hang together — **with** those tools.

**Flow (locked):**

```
Guest → Denis (Table OS + TRUTH) → Integration Platform → { POS adapter }
```

Never:

```
POS → AI add-on
Dashboard → Orders → maybe Denis
```

---

## 2. Denis Integration Platform (DIP)

ADR-029 defined **how** connectors attach (egress / ingress / outbox). ADR-047 names and productizes that layer:

**Denis Integration Platform (DIP)** = typed, audited boundary between Denis TRUTH and every external system.

### 2.1 Denis never knows what is below

Denis brain, guest path, Order Core, and ACT layer emit **intents and events** only:

```typescript
// Denis / Order Core knows ONLY:
type IntegrationIntent =
  | { kind: "push_order"; orderId: string; locationId: string; payload: PosOrderPayload }
  | { kind: "sync_status"; orderId: string; externalStatus: string }
  // future: sync_tables, sync_menu — same boundary
```

DIP resolves **which connector** runs for a location. Denis code **must not** import `deliverect.ts`, `orderbird.ts`, or check provider strings outside `src/lib/integrations/` and `src/lib/pos/`.

**Anti-pattern:** `if (provider === "deliverect")` in Denis loop, dashboard layout, or guest components.

**Target registry:** `src/lib/integrations/registry.ts` (ADR-029 §4) — single catalog for **all** connector categories (§1.2). Adding a new POS or partner **never** touches Denis brain — only a new connector definition + adapter.

### 2.2 Three integration tiers (not two)

Replaces ADR-001 §9.1 “Tier A middleware / Tier B direct” with explicit **three tiers**:

| Tier | Name | When | Examples | Denis behavior if missing |
|------|------|------|----------|---------------------------|
| **T1** | **Direct** | Strong API + strategic market | Square, Lightspeed, Clover, Orderbird | Full push + inbound status |
| **T2** | **Aggregator** | Many POS we will not build ourselves | Deliverect, KitchenHub, Omnivore | Full push via hub; hub is swappable |
| **T3** | **Fallback** | No API, no partnership | Generic webhook, print bridge, manual ack | Denis **still runs** guest + pay + kitchen; POS sync best-effort |

**Rule:** Deliverect is **one T2 connector** — excellent partner, **not company foundation**. If Deliverect changes price, API, or ownership, we swap or add another T2 adapter; Denis AI unchanged.

```typescript
type IntegrationTier = "direct" | "aggregator" | "fallback";

type PosConnectorDefinition = {
  id: string;                    // "deliverect" | "lightspeed" | "webhook"
  tier: IntegrationTier;
  category: "pos";
  capabilities: ("push_order" | "inbound_status" | "sync_menu" | "sync_tables")[];
};
```

All connectors implement the same `PosAdapter` interface ([ADR-001 §9.2](./ADR-001-universal-ordering-platform.md)). Outbox handler calls `getPosAdapter(integration.provider)` — unchanged mechanism, **reframed ownership**.

### 2.3 Architecture diagram

```
                    Guest / Staff (stations only)
                              │
                              ▼
                    ┌───────────────────┐
                    │   Denis AI        │
                    │   Table OS        │
                    │   TRUTH · timeline│
                    └─────────┬─────────┘
                              │ events / outbox intents
                              ▼
                    ┌───────────────────┐
                    │ Integration       │
                    │ Platform (DIP)    │
                    │ auth · audit ·    │
                    │ idempotency ·     │
                    │ connector registry│
                    └─────────┬─────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   T1 Direct            T2 Aggregator          T3 Fallback
   Square               Deliverect             webhook
   Lightspeed           KitchenHub             print / manual
   Clover               Omnivore
   Orderbird
        │                     │                     │
        └─────────────────────┴─────────────────────┘
                              ▼
                    Restaurant's existing POS
                    (TSE / fiscal stays on POS)
```

### 2.4 Onboarding copy (admin)

Admin **Connect POS** wizard asks:

1. Which POS does this location use? (picker)
2. DIP selects path: direct API available → T1; else known aggregator coverage → T2; else → T3 fallback + “Denis limited sync” badge

**Do not** lead with “Install Deliverect”. Lead with **“Connect your existing POS to Denis.”**

### 2.5 Consolidation debt

Today two bridges exist:

| Path | Location | Action |
|------|----------|--------|
| ADR-001 POS adapters | `src/lib/pos/` | **Canonical** for outbound push |
| Legacy Denis bridge | `src/lib/integrations/pos-bridge.ts` | **Merge or deprecate** into DIP — one outbound path |

Inbound: `src/lib/pos/inbound/` + `/api/pos/inbound/[integrationId]` — keep; normalize to DIP ingress channel B (ADR-029).

---

## 3. Mission Control (Denis Live)

### 3.1 Problem

Current dashboard home optimizes **restaurant administration** (Orders, Tables, revenue widgets). That is the wrong primary mental model for mass market.

Owners do not wake up wanting “order #142 status”. They want:

> **What is Denis doing for my restaurant right now?**

### 3.2 Decision

**Mission Control** = default authenticated home for owner/manager during service.

Not a new orchestrator. A **read projection** of TRUTH Denis already writes:

| Surface | Primary question |
|---------|------------------|
| **Mission Control** (`/dashboard` or `/dashboard/live`) | What is Denis doing **now**? |
| **Operations Center** (`/dashboard/operations`) | What needs **human** action? (ADR-043 S4) |
| **Back office** (menu, staff, fiscal, Stripe, integrations) | Configure **once**, visit rarely |

Mission Control and Operations Center **compose** existing data — no shadow DB (ADR-029 §2).

### 3.3 Mission Control v0 layout (locked UX intent)

```
┌─────────────────────────────────────────────────────────┐
│  Denis Live                          Shift: Fri 18:00   │
│                                                         │
│     ○  Good evening.                                    │
│        I'm currently helping 14 guests.                 │
│                                                         │
│  Signals                                                │
│  ✓ 18 tables active    ✓ kitchen normal                 │
│  ⚠ 2 guests waiting     ✓ 3 upsells today               │
│                                                         │
│  Timeline (newest first)                                │
│  ─────────────────────────────────────────────────────  │
│  18:35  Dessert ordered          → sent to POS ✓        │
│  18:34  Kitchen delay detected   → asked kitchen ✓      │
│  18:33  Guest asked about allergy → answered ✓          │
│                                                         │
│  [ Open Operations Center ]   [ Settings ]              │
└─────────────────────────────────────────────────────────┘
```

**Timeline sources (read-only):**

- `denis_timeline` — AI/co-worker events
- `order_events` — order lifecycle (filter: guest-visible + staff-relevant)
- Outbox / integration audit — “sent to POS”, “POS sync failed” (no provider name in guest-facing copy; admin may show connector health in Settings)
- `station_questions` — Denis ↔ kitchen/bar Q&A (ADR-043 S0)

**No LLM on this page.** Pure projection + realtime subscription.

### 3.4 Relationship to ADR-043

| ADR-043 | ADR-047 |
|---------|---------|
| Operations Center = **action queue** (what burns) | Mission Control = **Denis narrative** (what happened) |
| S4 builds `/dashboard/operations` | Mission Control v0 **ships before or with** S4 — default route |
| Station truth (S1–S3) feeds both | Timeline shows per-station truth when available |

**Navigation rule after Mission Control ships:**

- Login → **Mission Control**
- Urgent badge → **Operations Center**
- Orders / Tables → drill-down links from timeline or secondary nav — **not** home

### 3.5 Screen gate (every PR)

> **Does this help Denis do his job better?**

| Build | Defer |
|-------|-------|
| Mission Control timeline | Another revenue chart on home |
| Connector health in Settings | Provider-specific dashboard chrome |
| Denis Live shift summary | Generic “Orders” landing |
| Guest-facing Denis polish | Internal waiter POS for GA |

---

## 4. GTM: Hire Denis (colleague, not AI)

**Primary pitch (DE / EN / SR intent):**

- *“Keep your POS. Hire Denis.”* / *„Zadržite kasu. Zaposlite Denisa.“*
- *“Denis is a colleague on the floor — guests, kitchen, orders — he works **with** your team, not instead of it.”*
- *“We integrate with what you already use. We don’t ask you to rip anything out.”*

**Secondary (technical buyer):**

- Denis Integration Platform — universal connector model: direct, aggregator, or fallback per system.

**Parallel to Viktor:**

| | **Denis** | **Viktor** |
|--|-----------|------------|
| **Who** | Floor colleague | Owner’s ops colleague (Slack) |
| **Where** | Table, guest, kitchen handoff | Back office, KPI, alerts |
| **Integration stance** | Works with POS, KDS, pay | Reads Denis; works with Stripe, CRM, ads |
| **Never** | Replace register | Block guest path |

**Do not lead sales with:** Deliverect logo, integration count, “AI chatbot”, or competitor language vs named POS brands.

---

## 5. Implementation phases (post ADR-046 freeze)

One PR per row. No mega-PR.

| Phase | Deliverable | Tier / surface |
|-------|-------------|----------------|
| **P0** | ADR-047 accepted; ADR-001 §9 cross-ref | Docs |
| **P1** | `integrations/registry.ts` + `tier` on connector defs | DIP |
| **P2** | Deprecate / merge `pos-bridge.ts` → `lib/pos` | DIP |
| **P3** | Deliverect E2E (push + inbound) as **T2 connector #1** | T2 |
| **P4** | Webhook fallback onboarding (T3) | T3 |
| **P5** | Mission Control v0 (timeline + signals, read-only) | UI |
| **P6** | Default route: Mission Control home; ops → secondary | UI |
| **P7** | One **T1 direct** adapter by market (Orderbird DE or Lightspeed EU) | T1 |
| **P8** | Evaluate KitchenHub as T2 #2 (same interface, no Denis changes) | T2 |
| **P9** | Connector catalog doc + admin “Works with” list (honest capability matrix) | GTM |
| **P10** | Next connector family by ICP queue (not POS-only roadmap) | DIP |

**Mass-market order:** P3 + P4 + P5 before P7. Direct adapters follow paying ICP, not the reverse.

**Universal integration order:** breadth via T2 aggregators **in parallel** with strategic T1 direct partners — never “wait until one POS is perfect”. Denis runs on T3 while connectors catch up.

---

## 6. What we explicitly do not build

- **Competitor posture** — no “replace Toast / Orderbird” marketing or product paths
- **Denis-dependent-on-Deliverect** runtime paths
- **Single-vendor integration story** — Denis must stay connector-agnostic (§1.2)
- **Pipedream / Zapier / Make** in production order or POS path
- **POS dashboard** as primary product surface
- **In-house waiter POS** for mass-market GA (pilot / dev only)
- **Provider names** in Denis guest copy or brain prompts
- **Second order engine** for integrations — outbox + Order Core only (ADR-001 warnings)

---

## 7. Success criteria

| Metric | Target |
|--------|--------|
| Denis code imports from `lib/pos/adapters/*` | **0** (only DIP/outbox) |
| Owner login lands on Mission Control | **100%** post-P6 |
| Location without POS API still runs guest + Denis | **Yes** (T3) |
| Swap Deliverect → KitchenHub for one location | Adapter config only, **no Denis deploy** |
| Guest can name who helped them | **Denis** — not POS brand |
| Sales deck names a POS as “ replaced by Denis” | **0** occurrences |
| New connector ships without Denis brain changes | **Required** (DIP contract) |
| Restaurant keeps existing POS + KDS after onboarding | **Required** |

---

## 8. References

- [ADR-029 Denis Integration Spine](./ADR-029-denis-integration-spine.md) — channels A/B/C, connector model
- [ADR-001 §9 POS integration](./ADR-001-universal-ordering-platform.md) — `PosAdapter`, mappings (reframe tiers via this ADR)
- [ADR-043 Restaurant Co-worker](./ADR-043-denis-coworker-completion.md) — Operations Center, station truth
- [ADR-020 Table OS](./ADR-020-denis-table-operating-system.md) — product category
- Code: `src/lib/pos/`, `src/lib/outbox/handlers/push-pos.ts`, `src/lib/pos/inbound/`

---

## 9. Open questions

| # | Question | Default |
|---|----------|---------|
| 1 | Mission Control route: `/dashboard` vs `/dashboard/live` | `/dashboard` replaces overview when P6 ships; keep `/dashboard/overview` for revenue drill-down |
| 2 | KitchenHub vs second T2 | Evaluate at P8; Deliverect stays T2 #1 until proven |
| 3 | Show connector name in Mission Control timeline? | **No** — “Sent to POS ✓”; health in Settings → Integrations |
| 4 | ADR-001 §9.1 table rewrite in place? | Add cross-ref to ADR-047; full table edit in separate docs PR |
