# Architecture Index — QR Order / Denis / Vera Group

| Field | Value |
|-------|--------|
| **Purpose** | Single map of **all** architecture MDs — what applies where, what is built, what to ship next |
| **Updated** | 2026-05-29 (ADR-033 multi-year enterprise AI roadmap) |
| **Start here** | [DENIS-ARCHITECTURE-START-HERE.md](./DENIS-ARCHITECTURE-START-HERE.md) → **[ADR-033](./ADR-033-enterprise-ai-roadmap.md)** → **[DENIS-FULL-IMPLEMENTATION-BACKLOG.md](./DENIS-FULL-IMPLEMENTATION-BACKLOG.md)** |

---

## 1. How to read the stack (top → bottom)

```
┌─────────────────────────────────────────────────────────────┐
│ PRODUCT VISION     ADR-020 + DENIS-TABLE-OS-ARCHITECTURE (master) │
│ ENGINEERING SPINE  ADR-019 · Truth·Mind·Face · Phases A–E   │
│ MAXIMUM RUNTIME    ADR-023 · Belief→Policy→Language · MR-0–9│
├─────────────────────────────────────────────────────────────┤
│ DENIS COGNITIVE    ADR-005 Maximum · ADR-004 Kernel         │
│ DENIS PLATFORM     ADR-003 PPAN · timeline · Flow DSL       │
│ DENIS CONTROL      ADR-006 rollout · risk · eval              │
├─────────────────────────────────────────────────────────────┤
│ GUEST PRESENTATION ADR-017 Scene-first · ADR-016 Scene API  │
│ GUEST COMMANDS     ADR-018 handoff spine (M28 ✅)           │
│ DESIGN             ADR-007 · ADR-008 · denis-spatial plan   │
├─────────────────────────────────────────────────────────────┤
│ ORDER / RELIABILITY ADR-001 · outbox · idempotency (A1–A8) │
│ STAFF ACCESS       ADR-024 · surfaces · permissions · fiscal │
│ DENIS COMMERCIAL   ADR-009 F1–F7 · credits · metering       │
│ DENIS ORDERING     ADR-010 F8–F9 · act submit cutover       │
├─────────────────────────────────────────────────────────────┤
│ FISCAL             ADR-011 tactical · ADR-012 journal spine  │
│ GUEST JOURNEY      ADR-013 MVP · ADR-014 enterprise         │
│                    ⚠ subsume into Denis signals (ADR-020 §17)│
└─────────────────────────────────────────────────────────────┘
```

**Operational truth:** [denis-implementation-map.md](./denis-implementation-map.md) — as-built M0–M28, gaps §4, phases §7/§7b.

---

## 2. Document catalog (every architecture MD)

### 2.1 Denis — read these for AI / guest brain

| Doc | Role | Status | When to read |
|-----|------|--------|--------------|
| [ADR-020](./ADR-020-denis-table-operating-system.md) | **Category** — Table OS, goals, Ko·Gde·Kad·Kako, §14–21 refinements | Accepted | Product, pitch, “why us” |
| [**DENIS-ARCHITECTURE-START-HERE.md**](./DENIS-ARCHITECTURE-START-HERE.md) | **1-page entry** — bet, locked rules, build order | Active | **Everyone — read first** |
| [**ADR-033**](./ADR-033-enterprise-ai-roadmap.md) | **Enterprise roadmap** — **1 ADR = nedeljama**, 2+ godine | Accepted | Execution doctrine |
| [**ADR-033 active tracker**](./ADR-033-active-tracker.md) | **Koji ADR radimo SADA** — redosled, COMPLETE gate | Active | **Agent čita prvo** |
| [ADR-033 session prompts](./ADR-033-session-prompts.md) | **Autonomous agent** — jedan PR po sesiji unutar ACTIVE ADR | Active | Other AI sessions |
| [ADR-033 operator](./ADR-033-operator.md) | **Jovica one-liner** — merge + QR test only | Active | Copy-paste |
| [ADR-032](./ADR-032-waiter-obligation-spine.md) | **Waiter Obligation** — gap contract + autonomous writer | Accepted | Pilot quality |
| [**ADR-034**](./ADR-034-denis-perfection-doctrine.md) | **Perfection doctrine** — eval > arch preservation; ARCH-1→7 | Accepted | **Bar za savršenstvo** |
| [**ADR-035**](./ADR-035-pillar-strengthening-plan.md) | **Pillar plan** — stub po stub, 7 slojeva, P1–P7 | Accepted | **Ojačavanje temelja** |
| [**ADR-033 batch**](./ADR-033-agent-batch-prompts.md) | **Agent prompts** — svi PR-ovi copy-paste | Accepted | **Daj agentima** |
| [**ADR-036**](./ADR-036-agent-architecture-proposals.md) | **Agent proposals** — maks arhitektura po stubu | Living | **Posle svakog PR-a** |
| [**DENIS-TABLE-OS-ARCHITECTURE.md**](./DENIS-TABLE-OS-ARCHITECTURE.md) | **Master spec** — 5 planes, waiter parity, Viktor flywheel §19 | Accepted | Full stack |
| [DENIS-TABLE-OS-session-prompts.md](./DENIS-TABLE-OS-session-prompts.md) | **Implement agent** — O0–O6 tracks | Active | Autonomous build |
| [ADR-019](./ADR-019-denis-unified-brain.md) | **Engineering** — loop, signal/view, phases A–E | Accepted | Every Denis PR |
| [ADR-023](./ADR-023-denis-maximum-runtime.md) | **Production ceiling** — Belief→Policy→Language, manifest, TDE, MR-0–9 | Accepted | Elite/enterprise, “maximum Denis” |
| [ADR-023-operator.md](./ADR-023-operator.md) | **Jovica one-liner** — MR track prompts | Active | Copy-paste agent |
| [ADR-023-session-prompts.md](./ADR-023-session-prompts.md) | **Implement agent** — MR-0→MR-9 detail | Active | Autonomous implementation |
| [ADR-023-verification-checklist.md](./ADR-023-verification-checklist.md) | **Review agent** — verify MR | Active | Post-implement review |
| [ADR-031](./ADR-031-denis-maximum-cognition-phases.md) | **Maximum cognition phases** — FSP, ACT, journey eval to 100% | Accepted | Brain build C1–C5 |
| [ADR-030](./ADR-030-denis-conversation-comprehension.md) | **Comprehension-first** — dialogue frame, leadership guard | Accepted | Cognition enterprise |
| [ADR-025 operator](./ADR-025-operator.md) | **Jovica one-liner** — T1→T3 prompts | Active | Copy-paste agent |
| [ADR-025 session prompts](./ADR-025-session-prompts.md) | **Implement agent** — T1/T2/T3 detail | Active | Autonomous implementation |
| [ADR-025 verification](./ADR-025-verification-checklist.md) | **Review agent** — test matrix G1–G8 | Active | Post-implement review |
| [ADR-028](./ADR-028-viktor-denis-integration.md) | **Viktor partner** — Operator API, webhooks, GTM | Accepted | Denis + Viktor offering |
| [ADR-029](./ADR-029-denis-integration-spine.md) | **Integration spine** — 3 channels, contracts, I-track, guest isolation | Accepted | **All integrations — read first** |
| [ADR-029 session prompts](./ADR-029-session-prompts.md) | **Implement agent** — I3/I4 contract + admin connect | Active | After I1/I2 |
| [ADR-028 session prompts](./ADR-028-session-prompts.md) | **Implement agent** — V1–V3 Operator API | Active | After O1 gate |
| [VIKTOR-DENIS-CURSOR-PROMPTS.md](./VIKTOR-DENIS-CURSOR-PROMPTS.md) | **Copy-paste agent prompts** — P0/P1/P2/P4 (corrected) | Active | Viktor integration build |
| [denis-implementation-map.md](./denis-implementation-map.md) | **As-built** — code paths, M-tracks, verify | Active | Before any Denis code |
| [ADR-005](./ADR-005-denis-maximum.md) | Cognitive + Venue OS + surfaces layers | Proposed (M0–M28 largely built) | Kernel/venue features |
| [ADR-004](./ADR-004-denis-kernel.md) | Beliefs, goals, VKG, scheduler | Proposed | Planner/beliefs work |
| [ADR-003](./ADR-003-denis-platform-v2.md) | PPAN, timeline, T0–T3 | Proposed | Platform/timeline |
| [ADR-006](./ADR-006-denis-control-plane.md) | Rollout, shadow, risk R0–R5 | Accepted | Ops, canary, denis_only |
| [ADR-038](./ADR-038-guest-mental-model.md) | **Guest Mental Model (GMM)** — posture fold, rank, policy manifest | Approved | Proactive pilot, enforce rollout |
| [ADR-039](./ADR-039-nudge-outcome-learning.md) | **Nudge outcome loop** — fold → `anticipation.resolved` → M16 | Approved L1–L4 | Learning, admin digest |
| [ADR-040](./ADR-040-unified-proactive-decision-spine.md) | **UPDS** — one loop/decider/emitter; Kad in offer fold; audit gate | Approved | **Before any proactive refactor PR** |
| [ADR-041](./ADR-041-intervention-journal-spine.md) | **IJS** — Intervention Journal; trajectory fold; actor wake; commerce spine | **P0–P5 ✅** (default off) | Shadow pilot: `intervention.mode=shadow` + actor |
| [ADR-042](./ADR-042-venue-rhythm-priors.md) | **VRP** — Venue rhythm priors; session.completed rollup; admin heatmap | **P0–P4 ✅** (default off) | Shadow: `rhythm.mode=shadow` |
| [ADR-021](./ADR-021-denis-concierge-tuning.md) | **ConciergeConfig tuning** — profiles, LLM tiers, pilot runbook | Accepted | Ops pilot, multilingual |
| [ADR-022](./ADR-022-denis-elite-enterprise.md) | ~~Elite tier sketch~~ → superseded by ADR-023 | Superseded | Historical |
| [ADR-009](./ADR-009-atomic-turn-commercial-spine.md) | Metering, credits, timeline debit | Accepted F1–F7 | Commercial/billing |
| [ADR-010](./ADR-010-denis-ordering-cutover.md) | Act submit, GA gate, legacy retire | Accepted F8–F9 | Ordering path |
| [ADR-018](./ADR-018-table-guest-commands.md) | Waiter/bill T0 + ACL | M28 ✅ | Handoff chips |
| [ADR-002](./ADR-002-ai-concierge-orchestrator.md) | Bootstrap orchestrator (superseded by 003+) | Proposed | Historical / config V1–V18 |
| [ADR-002 detail](./ADR-002-denis-architecture-detail.md) | Deep bootstrap spec | Proposed | Session/context types |

### 2.2 Guest UI & scene

| Doc | Role | Status |
|-----|------|--------|
| [ADR-017](./ADR-017-denis-scene-first-presentation.md) | Scene-first, desk = sheet layer | Accepted SC-6/7 |
| [ADR-016](./ADR-016-guest-scene-contract.md) | `composeScene`, `guest_scene`, refresh | SC-1–7 ✅, SC-5 pending |
| [ADR-007](../design/ADR-007-visual-system.md) | Tokens, Denis Spatial v4 | Accepted |
| [ADR-008](../design/ADR-008-web-design-architecture.md) | Enterprise web components | Draft |
| [denis-spatial-implementation-plan.md](../design/denis-spatial-implementation-plan.md) | Floor tiles, dashboard spatial | Approved |

### 2.3 Order platform & reliability

| Doc | Role | Status |
|-----|------|--------|
| [ADR-001](./ADR-001-universal-ordering-platform.md) | Order core, outbox, POS, channels | Approved |
| [ADR-001 warnings](./ADR-001-implementation-warnings.md) | Traps (create-order, PIN, migrations) | Mandatory before A-track |
| [ADR-001 safe rollout](./ADR-001-safe-rollout.md) | Supabase push rules | Mandatory before db push |
| [ADR-001 operator](./ADR-001-operator.md) | One-line prompts for Jovica | Ops |
| [ADR-001 session prompts](./ADR-001-session-prompts.md) | A1–A8 copy-paste | Autonomous agents |
| [supabase-migration-baseline.md](./supabase-migration-baseline.md) | Hybrid migration history | DB work |
| [reliability-v2-fiscal-hybrid.md](./reliability-v2-fiscal-hybrid.md) | POS/fiscal hybrid notes | Reference |
| [POS-SPEED-ARCHITECTURE.md](./POS-SPEED-ARCHITECTURE.md) | **Waiter POS latency** — Vera Maximum M1+M2 | Proposed |
| [POS-SPEED-operator.md](./POS-SPEED-operator.md) | **Jovica one-liner** — P0→P3 | Active |
| [**POS-SPEED-all-prompts.md**](./POS-SPEED-all-prompts.md) | **SVI copy-paste promptovi** — jedan fajl | Active |
| [POS-SPEED-parallel-agents.md](./POS-SPEED-parallel-agents.md) | Copy-paste + ko dira šta | Active |
| [POS-SPEED-session-prompts.md](./POS-SPEED-session-prompts.md) | Track detail P0–P3 | Active |
| [POS-SPEED-verification-checklist.md](./POS-SPEED-verification-checklist.md) | Parent verify | Active |

### 2.4 Staff access & surfaces

| Doc | Role | Status |
|-----|------|--------|
| [ADR-024](./ADR-024-staff-duties-access.md) | **Staff apps** — surfaces, permission catalog, fiscal duties, compliance guards | Accepted |
| [ADR-024 operator](./ADR-024-operator.md) | **Jovica one-liner** — S-track prompts | Active |
| [ADR-024 session prompts](./ADR-024-session-prompts.md) | Implement agent S0–S7 detail | Active |
| [ADR-024 parallel agents](./ADR-024-parallel-agents.md) | A1–A5 parallel (posle S2) | Active |
| [ADR-024 verification](./ADR-024-verification-checklist.md) | Review agent | Active |

**Surfaces:** `/waiter` · `/bar` · `/kitchen` · `/dashboard` · `/admin` · `/fiscal` (optional tablet)

### 2.5 Fiscal

| Doc | Role | Status |
|-----|------|--------|
| [ADR-011](./ADR-011-fiscal-compliance-spine.md) | Tactical KassenSichV fixes | Proposed |
| [ADR-012](./ADR-012-fiscal-journal-spine.md) | Append-only fiscal journal (target) | Proposed |

### 2.6 Guest journey & commerce experience

| Doc | Role | Status | ⚠ |
|-----|------|--------|---|
| [ADR-013](./ADR-013-competitive-guest-journey.md) | Feedback, tips, reorder, Für dich | Proposed MVP | **Do not build `runGuestExperiencePipeline` as second brain** — triggers → Denis signals ([ADR-020 §17](./ADR-020-denis-table-operating-system.md)) |
| [ADR-014](./ADR-014-commerce-experience-platform.md) | Enterprise CE, capability registry | Proposed | Capabilities emit **signals**, not parallel UX writers |

---

## 3. Canonical model (resolve naming chaos)

Use **one vocabulary** everywhere (ADR-020 §15):

| Term | Meaning | Code / DB |
|------|---------|-----------|
| **TRUTH** | Immutable facts | `denis_timeline`, orders, fiscal journal |
| **MIND** | Folded cognition (discarded each loop) | `foldTableSessionState()` / `TableSessionState` |
| **FACE** | What UI shows (versioned projection) | `TableSessionView`, `guest_scene` slice |

**Loop** (ADR-019): `SIGNAL → FOLD → DECIDE → ACT → TELL → PROJECT`

**Guest API target** (ADR-019):

- Write: `POST /api/denis/signal`
- Read: `GET /api/denis/view` (+ SSE Phase E)

**Today (hybrid — retire in Phase D):**

- `/api/ai/chat`, `/api/denis/turn`, `/api/denis/sense`
- `GET /api/guest/scene` + chat session + Zustand cart + order poll
- Direct `/api/waiter-calls` from some guest paths
- Legacy `/api/ai/order/submit`

---

## 4. As-built vs destination (honest)

| Capability | Built (M0–M28, F1–F9) | Destination gap |
|------------|------------------------|-----------------|
| Kernel PPAN, timeline, eval | ✅ | Wire **FOLD** before every DECIDE (Phase A) |
| Scene compose + guest_scene | ✅ | Merge into **FACE** (Phase B) |
| Handoff commands M28 | ✅ | Enforce no direct waiter REST (Phase C/D) |
| Proactive tick (menu only) | ✅ | Order page + **WORLD** events (Phase D) |
| Act submit pilot | ✅ | `denis_only` on pilot venue |
| Staff push (VAPID) | ✅ | Guest push (Phase D) |
| Party, floor, ops, VKG | ✅ | Feed **MIND** only via FOLD |
| Shadow rollout default | ✅ | **`denis_only`** for product truth |
| Table Session Actor | ✅ | Phase E |
| View SSE / no poll | ✅ | Phase E |
| ADR-013 pipeline | ✅ signals via actor | **Signals only** — `runCommerceExperience` upstream facts enqueue actor |

---

## 5. Known contradictions (resolve like this)

| Tension | Resolution |
|---------|------------|
| ADR-005 says “north star” vs ADR-020 “category vision” | **ADR-020** = product category; **ADR-005** = cognitive layers; **ADR-019** = ship path |
| ADR-018 M29 “beliefs loader” vs ADR-019 Phase A | **Same work** — `foldTableSessionState()`; M29 label deprecated → Phase A |
| ADR-013 `runGuestExperiencePipeline` vs ADR-019 one brain | **ADR-020 §17 wins** — experience = Denis signals |
| ADR-014 `runCommerceExperience` vs Denis | Enterprise registry OK; **handlers enqueue signals**, no FACE writers |
| ADR-016 depends on ADR-014 | Scene contract stays; **FACE projection** absorbs scene + transcript |
| ADR-003 Phase C/D vs ADR-019 Phase A–E | ADR-003 platform phases = historical; **use ADR-019 A–E** for guest brain |
| Scene-first (ADR-017) vs chat as brain | **Scene = FACE layer**; chat = transcript slice — not separate intelligence |
| `denis-implementation-map` “one M-track per PR” vs Phase A–E | **One phase step per PR** (A1, A2… within Phase A if needed) |

---

## 6. Recommended execution order (best path)

### Now — Phase A (FOLD / Mind)

**Why first:** Without unified FOLD, every other doc is vision on a hybrid codebase.

1. `src/lib/denis/loop/fold-table-session-state.ts` (or `runtime/`)
2. Wire into `runDenisTurn`, `runDenisSense`, proactive tick
3. Timeline event `mind.fold_completed` with version hash
4. Eval fixtures assert MIND sees orders + cart + ops
5. Enable **`denis_only`** on Skyline pilot (ops)

**Do not start:** ADR-013 pipeline, ADR-014 event store, or new guest REST.

### Next — Phase B (FACE / view)

1. `table_session_view` materialized row (or extend `guest_scene` + transcript blob)
2. `GET /api/denis/view`
3. Guest UI reads view only on order page first (highest pain)

### Then — Phase C (SIGNAL)

1. `POST /api/denis/signal` wraps chat/chips/telemetry
2. Delete direct waiter REST from guest components
3. Thin deprecate `/api/ai/chat` body routing

### Then — Phase D (WORLD)

1. Order status outbox → Denis signal → TELL + `session.message` + guest push
2. Acceptance: push + transcript + dock headline identical (ADR-019 §12 test #1)

### Before chain / multi-device — Phase E (ACTOR)

1. Per-table signal queue + lock
2. Supabase Realtime on `view.version`
3. ADR-013 triggers as signal types only

### Phase F (single TRUTH) — ✅ COMPLETE (2026-06-07)

1. Transcript = timeline only (`tell.committed`, `signal.message`)
2. Retire dual-write to `ai_sessions.messages` on guest path
3. Dispute replay = timeline + Order Core rows

**Next:** [ADR-020 §Kad](./ADR-020-denis-table-operating-system.md) — continuous mind (tracker ACTIVE)

### Parallel (non-blocking) tracks

| Track | Doc | Note |
|-------|-----|------|
| Fiscal journal | ADR-012 | Independent of Denis phases |
| ADR-001 A4–A8 | warnings | If not already complete |
| SC-5 dashboard tile | ADR-016 | Reads same FACE |
| Design DE-* | ADR-008 | UI polish on FACE renderers |

---

## 7. What to read before which PR

| PR type | Read |
|---------|------|
| Layer 12 (docs, a11y, eval gate, ops) | [CONTRIBUTING.md](../CONTRIBUTING.md) · [DENIS-OPS runbook](../runbooks/DENIS-OPS.md) · `/api/docs` |
| Any Denis | This index · map §3–4 · ADR-019 · ADR-020 §15–16 |
| Guest UI | ADR-017 · ADR-007 · target FACE from ADR-019 §2 |
| Handoff / waiter | ADR-018 |
| Order create / outbox | ADR-001 · warnings |
| Fiscal | ADR-011 or ADR-012 |
| Guest journey feature | ADR-013 spec **but implement as Denis signal** |
| Rollout / canary | ADR-006 · map rollout table |
| DB migration | baseline · safe-rollout |

---

## 8. Cursor / agent entry points

| File | Role |
|------|------|
| [.cursor/rules/project.mdc](../../.cursor/rules/project.mdc) | Always-on stack + ADR links |
| [.cursor/rules/denis-architecture.mdc](../../.cursor/rules/denis-architecture.mdc) | Denis PR checklist |
| [.cursor/rules/commit-checklist.mdc](../../.cursor/rules/commit-checklist.mdc) | Outbox, serverless, no duplicate side effects |
| [ADR-019-operator.md](./ADR-019-operator.md) | **Jovica:** one-line prompts |
| [ADR-019-session-prompts.md](./ADR-019-session-prompts.md) | **Implement agent:** Phase A→F detail |
| [ADR-019-verification-checklist.md](./ADR-019-verification-checklist.md) | **Review agent:** verify implementation |

**Denis Maximum Runtime implement one-liner:** [ADR-023-operator.md](./ADR-023-operator.md) → default prompt.  
**Denis review one-liner:** verification checklist + Phase [X].

---

## 9. Single sentence for the company

> **TRUTH in the timeline, MIND in the loop, FACE for the guest** — one Denis actor per table, one signal in, one view out, commerce only through ACL.

That is the architecture. Everything else in `docs/` is either **built spine** (M0–M28), **domain ADR** (fiscal, order), or **presentation** (scene, design).
