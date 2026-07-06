# ADR-048: The Denis Runtime Architecture (Constitution)

| Field | Value |
|-------|--------|
| **Status** | **Accepted — LOCKED** · constitutional architecture |
| **Date** | 2026-07-06 |
| **Product** | **Denis AI** — *The AI employee that works with your existing restaurant systems* |
| **Role** | **Single document** every engineer reads to understand how Denis thinks, perceives, decides, and acts |
| **Parent** | [ADR-047](./ADR-047-denis-integration-platform-mission-control.md) · [ADR-029](./ADR-029-denis-integration-spine.md) · [ADR-019](./ADR-019-denis-unified-brain.md) · [ADR-020](./ADR-020-denis-table-operating-system.md) |
| **Supersedes** | Split ADR plans for URM / Brain / Runtime as separate north stars — **this document is the north star** |
| **Implementation** | Parts I–X below · constitutional amendments amend this document only |
| **Blocked by** | [ADR-046](./ADR-046-stabilization-freeze.md) for connector PRs until freeze lifts |

---

## Charter

**Read this first.** A new engineer joins in three years → read **ADR-048** → understand Denis.

### The five lines (locked)

1. **Integrations make Denis capable.**
2. **Operational Knowledge makes Denis an employee.**
3. **System Knowledge makes Denis an experienced employee.**
4. **Restaurant Policy makes Denis a member of THIS team.**
5. **Memory makes Denis better every day.**

No POS product has lines 4–5 together. That is the moat.

### What Denis is not

Not a chatbot · not a QR menu · not a POS · not a payment app.

**Denis is a digital employee who monitors restaurant operations in real time** — not only when a guest sends a message. He watches kitchen, bar, tables, waits, and service flow — and acts according to **this restaurant's rules**.

### Architecture lock (CTO rule)

**Do not rename Parts I–X or add new top-level pillars.** Next months = **implement**.

**Constitution amendment 2026-07-06:** Part X · Restaurant Policy added.

---

## How Denis exists — full loop

```
                    ┌─────────────────────────────────────┐
                    │  PERCEIVE (every tick / event)       │
                    │  Part III · Operational Knowledge    │
                    └─────────────────┬───────────────────┘
                                      ▼
                    ┌─────────────────────────────────────┐
                    │  Part II · Restaurant Brain          │
                    │  Intent · dialogue · plan            │
                    └─────────────────┬───────────────────┘
                                      ▼
                    ┌─────────────────────────────────────┐
                    │  Part X · Restaurant Policy          │
                    │  How THIS restaurant wants to run    │
                    └─────────────────┬───────────────────┘
                                      ▼
                         DECIDE → ACT (internal or external)
                                      │
              ┌───────────────────────┴───────────────────────┐
              │  Internal ACT (most shift monitoring)            │
              │  notify waiter · station voice · guest TELL      │
              │  timeline · Workspace alert                      │
              └───────────────────────┬───────────────────────┘
                                      │ external side effects
              ┌───────────────────────▼───────────────────────┐
              │  Part IV → V → VI → VII (connectors)           │
              └─────────────────┬─────────────────────────────┘
                                ▼
                    ┌─────────────────────────────────────┐
                    │  Part VIII · Timeline & Memory       │
                    └─────────────────┬───────────────────┘
                                      ▼
                    ┌─────────────────────────────────────┐
                    │  Part IX · Workspace                 │
                    └─────────────────────────────────────┘
```

| Part | Question |
|------|----------|
| **I · URM** | What exists in a restaurant? (language) |
| **II · Brain** | What do I want to do? (intent, plan, dialogue) |
| **III · Operational Knowledge** | What is happening **now**? (perception) |
| **X · Restaurant Policy** | How does **this** restaurant want to run? |
| **IV · System Knowledge** | What **is** this system? How do I use it? |
| **V · Capability Engine** | Can I do it **right now**? |
| **VI · Expert Registry** | Who is the expert **at this location**? |
| **VII · Connector** | How do I execute technically? |
| **VIII · Timeline & Memory** | What happened? What did we learn? |
| **IX · Workspace** | What does the owner see? |

**Policy vs Capability (locked):**

| | Restaurant Policy | Capability Engine |
|--|-------------------|-------------------|
| Question | How should **this venue** operate? | Can I call **this system** now? |
| Example | Drinks before food — notify if broken | OpenTable createReservation — YES |
| Config | Per location toggles | Per connector probe |
| When off | Denis **silent** on that rule | Denis **honest** — cannot do |

**Evidence rule (locked):** Denis **never answers without evidence.** Every TELL cites provenance.

```
Answer → Evidence → source + age

"About 8 minutes" → Kitchen voice · 2 min ago
"Total is €47"    → Square bill · 5 sec ago
"Table is booked" → OpenTable · 30 sec ago
```

---

# Part I — Universal Restaurant Model

**The language of the restaurant.** Denis thinks in these entities — not in Square, Stripe, or OpenTable API fields.

### I.1 Core entities

| Entity | Meaning | Denis TRUTH? |
|--------|---------|--------------|
| **Guest** | Person being served | belief + session |
| **Table** | Physical or logical seat | Denis maps tables |
| **Session** | Guest journey at table (`qr_token`) | ✅ Denis owns |
| **Order** | Committed purchase intent | ✅ **Order Core** |
| **OrderItem** | Line + modifiers (snapshotted) | ✅ Order Core |
| **Bill** | Amount due (may mirror POS) | Denis + projection |
| **Payment** | Settlement state | Denis + Stripe |
| **KitchenTicket** | Prep unit / station work | ✅ stations + orders |
| **BarTicket** | Bar station work | ✅ stations |
| **Reservation** | Future or active booking | connector or waitlist |
| **Timeline** | Append-only shift narrative | ✅ `denis_timeline` |
| **ServiceEvent** | Item/station lifecycle (ordered → ready → **served**) | ✅ order_events |

### I.2 Order Core rule (locked)

Guest says *"Bez luka"* / *"Još jedan sok"* / *"Šta preporučuješ?"* → **Order Core** (Denis).

POS receives **projection** after commit — never the source of conversational ordering.

```
Guest intent → Order Core → (optional) POS Expert projection
```

### I.3 Entity map (code)

| Entity | Primary tables / modules |
|--------|-------------------------|
| Session | `guest_sessions`, Table OS |
| Order | `orders`, `order_items`, `create-order` |
| Kitchen/Bar | KDS, bar board, `station_questions` |
| Timeline | `denis_timeline`, `order_events` |
| Memory | beliefs, ADR-045 journal, venue rhythm ADR-042 |

Deep entity specs remain in [ADR-001](./ADR-001-universal-ordering-platform.md) and [ADR-020](./ADR-020-denis-table-operating-system.md) — **Part I here is the canonical vocabulary**.

---

# Part II — Restaurant Brain

**How Denis thinks.** Provider-agnostic. Never branches on `if (square)`.

### II.1 Loop

```
Perceive (Part III) → Intent → Restaurant Policy (Part X) → Decide → ACT → TELL
                              ↑                                    ↑
                         Memory (Part VIII)              Evidence on every act
```

**Guest message** triggers Brain. **Shift events** (item served, wait exceeded) trigger Policy — Denis monitors even when nobody chats.

### II.2 Intent

Brain output is always an **intent**, not a provider call:

| Intent class | Examples |
|--------------|----------|
| **Order** | addItem, removeItem, submitOrder, modifyItem |
| **Pay** | payNow, splitBill, readBill |
| **Reserve** | createReservation, changeReservation, cancelReservation |
| **Coordinate** | askKitchen, nudgeGuest, handoffWaiter, **policyAlert** |
| **Inform** | answerMenu, answerAllergy, answerWaitTime |

### II.3 Planning & reasoning

- **L1–L3** cognition per [ADR-019](./ADR-019-denis-unified-brain.md) · [ADR-030](./ADR-030-denis-conversation-comprehension.md)
- Planner selects **domain expert** (Part VI), not connector id
- **Experience guidelines** from Connector Profile (Part IV) shape step order
- **Beliefs** from Memory inform Brain — **Restaurant Policy** (Part X) is separate: venue-configured rules, not LLM guess

### II.4 Decision rules

1. Resolve **intent** (guest/staff) or **policy trigger** (shift event).
2. Load **Restaurant Policy** for location — if rule disabled, **do nothing** for that rule.
3. Evaluate Operational Knowledge against enabled rules → **policyAlert** intent if violated/threshold.
4. For external actions: System Knowledge → Expert Registry → Capability → Connector.
5. Prefer **higher-trust Evidence** (Part IV).
6. **ACT** — attach **Evidence** to every notify, station voice, and TELL.

### II.5 Brain never

- Call `openTable.create()` by name
- Promise action when Capability = NO
- Answer without Evidence chain
- Import connector modules (ADR-029 guest isolation)
- Nag when owner **disabled** that policy rule

---

# Part III — Operational Knowledge

**What Denis sees right now.** Perception — not execution.

Built every perceive tick. Denis-native TRUTH first; connectors enrich.

### III.1 Live shift picture (examples)

```
Kitchen: busy          Bar: normal
Table 12: waiting 18m  Guest sentiment: frustrated (belief)
Reservation: party 4 arriving in 12 min
Table 8: food served 22m ago — not picked up
Table 3: burger served 18:30 · beer served 18:33 — serving order violation (if policy on)
3 open station questions · 18 active sessions
```

### III.1b Service events (Policy input)

Operational Knowledge must track **when** items move between stations and **when** they reach the guest:

| Event | Source | Used by Policy |
|-------|--------|----------------|
| Item routed kitchen / bar | order_items.station, KDS | wait timers by station |
| Item ready | order_events | pick-up nudges |
| Item served / delivered | staff mark or POS ingress | **serving order**, serve-together |
| Wait duration | now − ordered_at / ready_at | max wait rules |

Without served timestamps, **serving order** rules cannot run — implementation prerequisite.

### III.2 Operational Context (target type)

```typescript
type DenisOperationalContext = {
  shift: { locationId: string; serviceDate: string; mode: string };
  floor: { activeSessions: number; waitingGuests: number };
  stations: { kitchen: StationSnapshot; bar: StationSnapshot; openQuestions: number };
  orders: { openInKitchen: number; openAtBar: number; oldestWaitMinutes: number | null };
  payments: { unpaidSessionCount: number; openTabs: number };
  reservations: { upcoming: ReservationSnapshot[]; nextArrivalMinutes: number | null };
  alerts: Array<{ kind: string; sessionId?: string; orderId?: string }>;
  capabilities: CapabilityResult[];       // Part V live overlay
  experts: LocationExpertMap;             // Part VI
};
```

### III.3 Sources

| Signal | Source |
|--------|--------|
| Sessions, cart, orders | Order Core (always) |
| Kitchen/bar load | KDS, station questions, voice |
| Payments | Stripe + session |
| Reservations | Reservation Expert sync (when connected) |
| Beliefs | Brain + Memory |

### III.4 P0 vs P1

| P0 (must without connectors) | P1 (stronger with connectors) |
|------------------------------|-------------------------------|
| Active sessions, order status | POS bill mirror |
| Station load, ETAs | Reservations next 4h |
| Payment state (Stripe) | Stop list from POS |
| Timeline, allergies | Delivery status |

**Screen gate:** Features that do not feed Part III are not employee-quality.

---

# Part X — Restaurant Policy

**Constitution amendment 2026-07-06**

**How this restaurant wants to run.** Not universal AI behavior — **venue-configured operating rules**.

Capability Engine: *Can I?*  
Restaurant Policy: *How should **we** operate — and should Denis speak up?*

Fine dining, fast food, hotel, beach bar — **same Denis employee**, **different policies**. Owner toggles rules; disabled rule = **Denis silent** (never nag).

### X.1 What Denis monitors (real-time operations)

Denis is not only reactive to chat. On every perceive tick and order event he evaluates:

- **Wait times** — drinks, food, bar cocktails, VIP
- **Serving order** — drinks before food (or venue override)
- **Serve together** — partial table delivery
- **Kitchen silence** — auto ask kitchen after N minutes
- **Station backlog** — kitchen/bar busy vs promises made to guest

This is the product: **restaurant operating intelligence**, not FAQ bot.

### X.2 Policy schema (not hardcoded)

Store per location — extend `locations.venue_manifest.policy` or dedicated `service_policy` JSONB.

```typescript
type RestaurantPolicy = {
  version: number;

  servingOrder: {
    drinksBeforeFood: boolean;      // default true for full service
    notifyIfBroken: boolean;        // if false, Denis silent even when drinksAfterFood
  };

  maxWaitMinutes: {
    drinks: number | null;          // e.g. 5 — null = off
    food: number | null;            // e.g. 20
    barCocktail: number | null;     // e.g. 8
    vip: number | null;             // lower threshold for VIP sessions
  };

  kitchen: {
    askAfterMinutes: number | null; // auto station voice question
    notifyIfBusy: boolean;
  };

  service: {
    serveTableTogether: boolean;    // warn if partial serve
    notifyMissingDrinks: boolean;
    notifyMissingCutlery: boolean;
    notifyWrongServingOrder: boolean; // master toggle for X.2 servingOrder alerts
    ignoreDessertTiming: boolean;
  };

  vip: {
    enabled: boolean;
    priority: "normal" | "high";
    notifyWaitExceeded: boolean;
  };

  /** Who receives policy alerts */
  notify: {
    waiterHandoff: boolean;         // push / waiter PWA
    stationVoice: boolean;          // kitchen/bar Denis voice
    guestTell: boolean;             // rare — usually staff-first
    workspace: boolean;             // owner timeline
  };
};
```

**Presets (admin UX):** Fine dining · Bistro · Fast casual · Bar-first · Hotel — each loads a policy template; owner toggles individual rules.

### X.3 Rule catalog (examples)

| Rule ID | When enabled | Trigger | Denis action |
|---------|--------------|---------|--------------|
| `serving_order.drinks_before_food` | drinksBeforeFood + notifyIfBroken | Food served before drink on same table | Notify waiter: *"Primetio sam da je glavno jelo posluženo pre pića. Proverite sa barom?"* |
| `serving_order.drinks_before_food` | **disabled** | Same event | **Silent** |
| `max_wait.drinks` | minutes set | Drink wait > N | *"Sto 12 čeka piće već 7 minuta."* |
| `max_wait.food` | minutes set | Food wait > N | *"Sto 8 čeka glavno jelo već 22 minuta."* |
| `max_wait.bar_cocktail` | minutes set | Bar item late | *"Bar kasni sa koktelom za sto 3."* |
| `kitchen.ask_after` | minutes set | Food wait > N, no kitchen answer | 🎤 Station voice: *"Kuhinjo, status porudžbine za sto 8?"* → relay answer to guest with Evidence |
| `service.serve_together` | true | One dish served, others not ready | *"Sačekajte još jedno jelo da sto bude poslužen zajedno."* (staff) |
| `vip.wait` | VIP + threshold | VIP wait exceeded | *"VIP gost čeka već 12 minuta."* |

Every action requires **Evidence**:

```
Policy alert → Evidence: order_events · table 8 · burger served 18:30 · beer 18:33
```

### X.4 Evaluation loop

```
Operational Knowledge update (item served, timer tick)
        ↓
Policy Engine: for each ENABLED rule at location
        ↓
Match? → policyAlert intent
        ↓
Brain phrasing (language, tone) — does NOT invent the rule
        ↓
ACT: notify target from policy.notify.*
        ↓
Timeline: policy.violation or policy.threshold · ruleId · Evidence
        ↓
Memory: optional outcome learning (did staff ack?)
```

**Debounce:** Same rule + table — do not spam (e.g. max once per 10 min unless escalation tier).

### X.5 Admin — Service Rules (Settings)

```
Service Rules
☑ Drinks before food
☑ Notify if serving order broken
☑ Serve table together
☑ Ask kitchen after [15] min
☐ Ignore dessert timing
☑ Notify missing drinks
☑ Notify missing cutlery
☑ Notify wrong serving order

Max wait — Drinks [5] min · Food [20] min · Bar cocktail [8] min
VIP priority ☑ · Notify after [12] min
```

All **on/off + numeric thresholds**. No code deploy to change behavior.

### X.6 Integration with existing spine

| Existing | Policy use |
|----------|------------|
| `station_questions` + voice | `kitchen.ask_after` auto-question |
| `denis_timeline` | every policy act logged |
| ADR-043 Operations Center | policy alerts in action queue |
| ADR-042 venue rhythm | priors inform thresholds — **not** replace owner toggles |
| Order Core / KDS | served events feed serving-order rules |

### X.7 Moat

Universal AI tries one behavior everywhere. **Denis learns each house's rules** — behaves like staff who worked there for years. Hard to copy without Part III event fidelity + Part X config + shift memory.

**Screen gate:** Operational monitoring features must declare which **policy rule id** they implement.

---

# Part IV — System Knowledge

**What Denis knows about each system.** Static expertise — shipped with **Connector Profile**.

Capability Engine answers *Can I?*  
System Knowledge answers *What is this? When? Why not? Best practice?*

### IV.1 Connector Profile (complete dossier)

Each external colleague has a **Connector Profile** — Denis's internal team handbook.

```typescript
type ConnectorProfile = {
  // Identity
  id: string;
  displayName: string;
  domain: ExpertDomain;
  brainHints: string[];

  // System Knowledge (static YAML)
  purpose: string;
  responsibleFor: string[];
  notResponsibleFor: string[];
  limitations: string[];
  bestPractices: string[];

  experienceGuidelines?: Array<{
    trigger: string;
    steps: Array<{ order: number; action: string; when?: string }>;
    fallback?: string;
  }>;

  // Trust · Evidence · Cost (NEW — locked)
  trust: TrustProfile;
  evidence: EvidenceProfile;
  operationalCost: CostProfile;

  // Capability manifest + auth
  capabilityManifest: ConnectorCapability[];
  auth: "oauth" | "api_key" | "hmac_webhook" | "stripe_connect";
  tier: "direct" | "aggregator" | "fallback";

  // Runtime overlay (Part V + VI — not in YAML)
  runtime?: {
    health: "healthy" | "degraded" | "offline";
    capabilities: CapabilityResult[];
    lastSyncAt?: string;
  };
};
```

### IV.2 Trust

How much Denis relies on this source **right now**.

```typescript
type TrustProfile = {
  /** Baseline when healthy */
  baseline: "very_high" | "high" | "medium" | "low";
  /** How freshness affects trust */
  freshnessRules: Array<{
    maxAgeSec: number;
    trust: "very_high" | "high" | "medium" | "low";
  }>;
  /** e.g. webhook 5s → very_high; polling 120s → medium */
  deliveryMode?: "webhook" | "polling" | "on_demand";
};
```

| Example | Mode | Freshness | Trust |
|---------|------|-----------|-------|
| Square bill webhook | webhook | 5 sec | very_high |
| Square bill poll | polling | 2 min | medium |
| Guest chat claim | on_demand | — | low until verified |

Brain prefers **higher-trust** source when two sources disagree (e.g. Order Core total vs stale POS bill).

### IV.3 Evidence

Every answer and ACT must carry **Evidence**.

```typescript
type Evidence = {
  source: string;           // "kitchen_voice" | "square_bill" | "order_core"
  connectorId?: string;
  observedAt: string;       // ISO
  trust: TrustLevel;
  summary: string;          // internal / debug
};

type EvidenceProfile = {
  /** What this connector produces — for citation */
  provides: string[];       // ["bill_total", "reservation_slot", "payment_status"]
  defaultCitation: string;  // guest-safe label source
};
```

```
Guest: "Koliko je račun?"
Denis: "€47,20" 
Evidence: Square bill · 5 sec ago · trust very_high
(fallback: Order Core · trust high — if readBill unavailable)
```

### IV.4 Operational Cost

Brain chooses cheaper path when capability allows.

```typescript
type CostProfile = {
  tier: "free" | "low" | "medium" | "high" | "metered";
  notes?: string;           // "LLM interpret — use only when rules fail"
  rateLimitAware?: boolean;
};
```

| Source | Cost | Brain policy |
|--------|------|--------------|
| Order Core / stations | free | prefer first |
| Stripe status check | low | default for pay |
| OpenTable availability | medium | only for reserve intents |
| OpenAI interpret | high | fallback only |

### IV.5 Domain experts

| Domain | Expert label | Example profiles |
|--------|--------------|------------------|
| `pos` | POS Expert | Square, Lightspeed, Deliverect |
| `reservation` | Reservation Expert | OpenTable, Quandoo, SevenRooms |
| `payments` | Payment Expert | Stripe, SumUp |
| `messaging` | Messaging Expert | WhatsApp, SMS |
| `delivery` | Delivery Expert | Deliverect |
| `internal` | Internal Expert | Order Core, stations |

**Brain:** *"Need POS Expert"* — not *"Call Square."*

### IV.6 Example profiles

#### OpenTable

```yaml
id: opentable
displayName: OpenTable
domain: reservation
purpose: Restaurant reservation management

responsibleFor: [reservations, availability, arrivals, cancellations]
notResponsibleFor: [orders, payments, kitchen]

bestPractices:
  - Always check availability before creating a reservation.
  - Suggest alternative time slots when unavailable.
  - Match reservation with active table session.

limitations:
  - Cannot process payments.
  - Cannot create restaurant orders.

brainHints: [Reservation expert.]

trust:
  baseline: high
  deliveryMode: polling
  freshnessRules:
    - { maxAgeSec: 60, trust: high }
    - { maxAgeSec: 300, trust: medium }

evidence:
  provides: [reservation_slot, guest_arrival, availability]
  defaultCitation: OpenTable reservation system

operationalCost:
  tier: medium
  rateLimitAware: true
```

#### Square

```yaml
id: square
displayName: Square
domain: pos
purpose: Restaurant POS — bills, menu, receipts, order projection

responsibleFor: [order projection, bills, menu, tables, receipts]
notResponsibleFor: [reservations, whatsapp, crm, guest conversation ordering]

bestPractices:
  - Project Order Core after commit.
  - Read bill when guest pays and readBill is healthy.

limitations: [No reservations, No messaging, No CRM]

brainHints: [POS expert.]

trust:
  baseline: very_high
  deliveryMode: webhook
  freshnessRules:
    - { maxAgeSec: 30, trust: very_high }
    - { maxAgeSec: 120, trust: medium }

evidence:
  provides: [bill_total, bill_lines, menu_item, table_state]
  defaultCitation: Square register

operationalCost:
  tier: low
```

#### Stripe

```yaml
id: stripe
displayName: Stripe
domain: payments
purpose: Online payments, checkout, refunds

responsibleFor: [payments, refunds, payment status, checkout]
notResponsibleFor: [reservations, orders, kitchen]

brainHints: [Payment expert. Never ask Stripe for reservations or kitchen.]

trust:
  baseline: very_high
  deliveryMode: webhook

evidence:
  provides: [payment_status, checkout_session]
  defaultCitation: Stripe payment

operationalCost:
  tier: low
```

**Registry:** `src/lib/connectors/profiles/*.yaml`

**PR rule:** Profile + adapter + probe + Expert Registry entry — or incomplete.

---

# Part V — Capability Engine

**Can I — right now?**

```typescript
type CapabilityResult = {
  capability: ConnectorCapability;
  available: boolean;
  provider: string | null;
  health: "healthy" | "degraded" | "offline";
  confidence: "live" | "stale" | "unknown";
  reason?: string;
  lastSyncAt?: string;
};
```

### V.1 Capability catalog

| Domain | Capabilities |
|--------|-------------|
| POS | pushOrder, readBill, readMenu, syncMenu, syncStopList, syncTables |
| Reservation | readReservations, checkAvailability, createReservation, updateReservation, cancelReservation |
| Payments | capturePayment, refundPayment |
| Delivery | readDeliveryStatus, pushDeliveryOrder |
| Messaging | sendGuestMessage |

### V.2 Probe flow

```
Admin Connect → encrypted auth → adapter.probe() → CapabilityResult[]
  → merge Profile.runtime → Operational Context → timeline event
```

### V.3 Display (admin)

```
Read Bill        → YES · Square · healthy
Reservations     → NO · OpenTable · not connected
```

Brain uses **`resolveCapability(intent)`** — never guesses from Profile alone.

---

# Part VI — Expert Registry

**Denis's team roster.** Not a list of adapters — **who is the expert at this location?**

```typescript
type ExpertDomain =
  | "pos" | "reservation" | "payments" | "delivery" | "messaging" | "internal";

type LocationExpertMap = {
  locationId: string;
  experts: Partial<Record<ExpertDomain, string>>;  // pos → "square"
};
```

### VI.1 Resolution

```
Brain: intent CreateReservation
  → domain: reservation
  → Expert Registry: reservation → "opentable"
  → Profile: opentable (Part IV)
  → Capability: createReservation?
  → Connector: execute
```

### VI.2 Default team (examples)

| Expert | → | Connector |
|--------|---|-----------|
| POS Expert | → | Square |
| Reservation Expert | → | OpenTable |
| Payment Expert | → | Stripe |
| Messaging Expert | → | WhatsApp |

Swap Square → Lightspeed: **Registry only**. Brain unchanged.

### VI.3 Code target

Generalize `pos_integrations` → `system_integrations` with `domain` + `connector_id` + Expert Registry view.

---

# Part VII — Connectors

**How Denis executes.** Thin translators — GET, POST, webhook, OAuth.

### VII.1 Rules

- Guest path **never imports** connector code (ADR-029)
- One adapter per Profile id
- Outbox for side effects (ADR-001)
- Idempotency on all ingress

### VII.2 Integration tiers

| Tier | When | Examples |
|------|------|----------|
| **T1 Direct** | Strong API | Square, Lightspeed, ready2order |
| **T2 Aggregator** | Breadth | Deliverect, KitchenHub |
| **T3 Fallback** | No API | webhook, manual ack |

### VII.3 POS matrix (priority)

| System | Tier | Priority | pushOrder | readBill | Code |
|--------|------|----------|-----------|----------|------|
| ready2order | T1 | **P1** | ✓ | ◐ | stub |
| Square | T1 | **P1** | ✓ | ✓ | — |
| Lightspeed | T1 | **P1** | ✓ | ✓ | adapter |
| Deliverect | T2 | **P1** | ✓ | via hub | adapter |
| SumUp | T1 | **P1** | ✓ | ◐ | adapter |
| Poster, Clover, Toast | T1 | P2 | ✓ | ✓/◐ | — |
| Orderbird | — | T3/partner | ◐ | — | ⚠ no public API |

### VII.4 Reservation matrix

| System | Priority | create | Notes |
|--------|----------|--------|-------|
| Denis waitlist | **P0** | proposal | always |
| OpenTable | **P1** | ✓ | partner OAuth + RID, never password |
| Quandoo, TheFork | **P1 EU** | ✓ | partner |
| SevenRooms | P2 | ✓ | CRM depth |
| Google Reserve | P3 | link-out | fallback |

### VII.5 Other connectors

| Domain | Systems | Priority |
|--------|---------|----------|
| Payments | Stripe ✅, SumUp | P0/P1 |
| Messaging | WhatsApp, SMS | P1 |
| Delivery | Deliverect | P1 |
| Operator | Viktor | P1 |
| **Out of scope** | Payroll, ERP, CRM replacement | — |

### VII.6 Connect Hub (admin)

```
Integrations → Connect → Authorize / API fields → Probe → Connected ✓ · Can/Cannot
```

Never collect third-party login passwords.

### VII.7 Runtime flow (reservation)

```
Guest: "Reserve table Friday 8pm"
  → Brain: CreateReservation
  → System Knowledge: Reservation Expert
  → Expert Registry: opentable
  → Capability: YES
  → Connector: OpenTable API
  → Timeline + Evidence + Memory update
```

### VII.8 Intent × expert × capability

| Intent | Expert | Capability | Fallback |
|--------|--------|--------------|----------|
| submitOrder | Internal → POS | pushOrder | Denis kitchen only |
| payNow | Payment | capturePayment | pay at register |
| createReservation | Reservation | createReservation | waitlist / handoff |
| readBill | POS | readBill | Order Core total |
| answerWaitTime | Internal | station truth | honest unknown |

---

# Part VIII — Timeline & Memory

**Audit · replay · learning.** What no POS has.

### VIII.1 Timeline

Append-only shift narrative:

- `denis_timeline` — Denis actions + co-worker events
- `order_events` — order lifecycle
- Integration audit — "sent to POS ✓" / failed
- **Every entry links Evidence**

### VIII.2 Memory

| Type | Purpose |
|------|---------|
| **Session beliefs** | allergy, VIP, frustration |
| **Venue rhythm** | rush patterns (ADR-042) |
| **Intervention journal** | ADR-041 |
| **Outcome learning** | nudge results ADR-039 |
| **Guest preferences** | proposal-only writes |

Memory informs Brain policy — **never overrides** Capability NO or missing Evidence.

### VIII.3 Learning loop

```
ACT → outcome → timeline → memory update → better next shift
```

**Memory makes Denis better every day.**

---

# Part IX — Workspace

**What the owner sees.** Not admin charts — **Denis on shift**.

```
Denis · Helping 18 guests
Kitchen busy · Bar normal
⚠ Sto 3 — piće kasni 7 min (policy: max_wait.drinks)
⚠ Sto 8 — jelo pre pića (policy: serving_order) · notified waiter
1 allergy · 3 station questions
Reservation Expert: OpenTable ✓
POS Expert: Square ✓ · bill sync 5s ago
Timeline →
```

- Operational Context projection (Part III)
- Expert labels — not raw API dumps
- Drill-down to Operations Center (ADR-043) for actions
- **No LLM on Workspace** — read projection + realtime

Mission Control / Denis Workspace = default manager home ([ADR-047](./ADR-047-denis-integration-platform-mission-control.md)).

---

## Appendix A — Implementation roadmap

Architecture **locked**. Execute in order:

| Phase | Deliverable |
|-------|-------------|
| **R0** | Order Core + stations + Stripe (now) |
| **R1** | Connector Profiles + Trust/Evidence/Cost schema |
| **R2** | Expert Registry + Capability probe + Connect Hub |
| **R3** | Square or ready2order + Deliverect |
| **R4** | readBill + Evidence on all TELL |
| **R5** | OpenTable partner + Reservation Expert |
| **R6** | Memory loop + Workspace v0 |
| **R7** | **Restaurant Policy engine** — served events, rule eval, station voice triggers |

Parallel: OpenTable partner application from R1.

---

## Appendix B — Consolidation debt

| Today | Constitution target |
|-------|---------------------|
| `pos_integrations` | `system_integrations` + Expert Registry |
| `PosIntegrationsPanel` | Connect Hub |
| `src/lib/pos/` | `src/lib/connectors/` |
| No Evidence on TELL | Evidence on every answer |
| No Profiles | `connectors/profiles/*.yaml` |
| Brain provider branches | Domain expert routing only |
| No served-event tracking | order_events / KDS for Policy input |
| No policy config | `locations.service_policy` or `venue_manifest.policy` |

---

## Appendix C — Acceptance checklist

- [ ] Parts I–X implemented as named modules — no shadow concepts
- [ ] Every connector: Connector Profile (trust, evidence, cost) + adapter + probe + registry
- [ ] Runtime spine on every external ACT: IV → V → VI → VII
- [ ] Every TELL includes Evidence
- [ ] Brain uses expert domains — not provider ids
- [ ] Swap POS connector without Brain change
- [ ] Operational Context works with zero connectors
- [ ] Restaurant Policy: disabled rule = silent; enabled rule = Evidence-backed alert
- [ ] Serving-order rule works when drinksBeforeFood toggled off
- [ ] `kitchen.ask_after` triggers station voice with guest relay

---

## Appendix D — Related ADRs (detail, not replacement)

These ** deepen** parts of this constitution — they do not replace it:

| ADR | Deepens |
|-----|---------|
| ADR-019/020 | Part II Brain · Part I Table OS |
| ADR-029 | Part VII ingress/egress rules |
| ADR-045 | Part VIII Memory model |
| ADR-047 | Part IX Workspace · GTM |
| ADR-011/012 | Fiscal — Order Core compliance |

**Do not create ADR-051 "Denis Runtime".** Amend ADR-048 instead.

---

## Appendix E — One-page summary

```
URM              language of the restaurant
Brain            decides what to do
Operational      sees the floor now
Policy           how THIS restaurant runs (toggle per rule)
System Knowledge understands each colleague
Capability       checks if action is possible now
Expert Registry  finds the right colleague
Connector        executes the API call
Timeline/Memory  audit, replay, learn
Workspace        owner watches Denis work
```

**Integrations make Denis capable.**  
**Operational Knowledge makes Denis an employee.**  
**System Knowledge makes Denis an experienced employee.**  
**Restaurant Policy makes Denis a member of THIS team.**  
**Memory makes Denis better every day.**
