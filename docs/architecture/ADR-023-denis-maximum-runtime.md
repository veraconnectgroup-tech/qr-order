# ADR-023: Denis Maximum Runtime — Production Architecture

| Field | Value |
|-------|-------|
| **Status** | **Accepted** — ceiling architecture for Vera / Denis Table OS |
| **Date** | 2026-05-29 |
| **Supersedes** | [ADR-022](./ADR-022-denis-elite-enterprise.md) (tier-only model) as engineering north star |
| **Unifies** | [ADR-005](./ADR-005-denis-maximum.md) · [ADR-019](./ADR-019-denis-unified-brain.md) · [ADR-020](./ADR-020-denis-table-operating-system.md) · [ADR-021](./ADR-021-denis-concierge-tuning.md) |
| **As-built** | [denis-implementation-map.md](./denis-implementation-map.md) — M0–M28, phases A–F ✅ |
| **Code target** | `src/lib/denis/cognition/` · `src/lib/denis/loop/` · `src/lib/denis/runtime/` |

---

## 0. One sentence

**Denis Maximum Runtime** is an **event-sourced table agent**: TRUTH from timeline + commerce, **Beliefs** compiled after every FOLD, **Policy** (kernel + flow) decides ACT, **Language** (template → optional LLM) speaks — with **anticipation** from world signals and **enterprise manifests** for chains.

This is the **strongest Denis we should build**. Everything beyond §12 is a different product.

---

## 1. How this fits what you already have

You are **not** starting from zero. Maximum Runtime **names and completes** the spine you shipped:

| Already built | Maximum Runtime role |
|---------------|----------------------|
| ADR-019 loop A–F | **Runtime spine** — SIGNAL→FOLD→DECIDE→ACT→TELL→PROJECT |
| ADR-020 Table OS | **Category** — Ko·Gde·Kad·Kako, one orchestrator |
| M0–M28 kernel/venue/eval | **Policy plane** — goals, VKG, ops, party, copilot |
| `denis_timeline` | **TRUTH** — append-only, replay, audit |
| ACL + act submit F8–F9 | **ACT** — only path to Order Core |
| Phase E actor + view SSE | **Temporal runtime** — FIFO per table session |
| ADR-009 metering | **Commercial** — credits, org ops |
| Fiscal journal ADR-012 | **Downstream TRUTH** — Denis never signs TSE |
| Conversation leadership (code) | **Language guard** — no “ne razumem” |

Maximum Runtime adds the **missing middle**: explicit **Belief Graph** + **Turn Decision Engine** + **Venue Manifest** + **Quality Contract**.

---

## 2. The stack (one diagram)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ENTERPRISE PLANE                                                        │
│ Venue Manifest · org ceiling · sim-before-promote · quality contract    │
├─────────────────────────────────────────────────────────────────────────┤
│ TEMPORAL PLANE (ADR-020 anticipation)                                   │
│ Table Session Actor · scheduler · world signals · proactive TELL        │
├─────────────────────────────────────────────────────────────────────────┤
│ COGNITION PLANE (this ADR)                                              │
│ compileBeliefs → decideTurnPlan → planUtterance → [LLM?] → TELL         │
├─────────────────────────────────────────────────────────────────────────┤
│ POLICY PLANE (ADR-004/005 — built)                                      │
│ Goal stack · Flow DSL · VKG · conflict · risk R0–R5 · ops beliefs       │
├─────────────────────────────────────────────────────────────────────────┤
│ TRUTH PLANE (ADR-019 — built)                                           │
│ denis_timeline · orders · cart · fiscal journal · guest memory (consent)│
├─────────────────────────────────────────────────────────────────────────┤
│ FACE PLANE (ADR-019 B + ADR-017)                                        │
│ GET /api/denis/view · SSE · transcript · layers · chrome headline       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Guest APIs (only two):** `POST /api/denis/signal` · `GET /api/denis/view` (+ SSE).

---

## 3. Cognition doctrine — Belief → Policy → Language

### 3.1 TRUTH (immutable)

Events only. No LLM writes here.

- `denis_timeline` append-only
- Order Core facts (`orders`, `order_items` snapshots)
- Fiscal journal (ADR-012)
- Consented `denis_guest_memory`

### 3.2 BELIEF (derived, scored, replayable)

After every **FOLD**, `compileBeliefs(TableSessionState) → BeliefGraph`:

```typescript
type Belief = {
  key: string;           // e.g. "conversation.language"
  value: unknown;
  confidence: number;    // 0..1
  source: "explicit" | "inferred" | "ops" | "memory" | "default";
  expiresAt?: string;
};
```

**Core beliefs (M-Runtime-1):**

| Key | Example | Source |
|-----|---------|--------|
| `conversation.language` | `sr` | explicit / sticky / memory |
| `conversation.mode` | `banter` \| `ordering` \| `settling` | inferred from utterance |
| `commerce.pending_slot` | `serve_size` | draft + catalog |
| `venue.rush` | `true` | ops / floor graph |
| `venue.skip_upsell` | `true` | rush + config |
| `guest.return_visit` | `true` | memory projection |
| `policy.require_confirm` | `true` | manifest |

Beliefs are **logged** to timeline (`mind.beliefs_compiled`) for enterprise replay.

### 3.3 POLICY (code only — never LLM)

Existing kernel:

```
beliefs + flowNode + cart → deriveGoalStack → planTurnWithReflex → skills → ACL
```

**Invariants:**

- Money, submit, waiter, storno → **ACT + ACL only**
- Upsell when `venue.skip_upsell` belief → suppressed in DECIDE
- R0–R5 risk gate before every skill

### 3.4 LANGUAGE (last — template first)

```
planUtterance(beliefs, goal, committedFacts) → UtterancePlan
  → tryTemplate(plan)           // i18n, 0 tokens
  → else narrateFromFacts (T3)  // optional LLM, facts-only
  → leadership sanitizer        // never refusal
```

**Maximum target:** `llm_invocation_rate < 30%` of guest turns on elite venues.

| Tier | Template coverage | LLM use |
|------|-------------------|---------|
| Standard | T0 + T1 | perceive JSON (mini) |
| Premium | + relational templates | RC 4o for banter only |
| Elite | + playbook templates | TC 4o for hard slots |
| Enterprise | + org pack | narrate 4o paraphrase |

---

## 4. Turn Decision Engine (TDE)

Single code path between FOLD and perceive:

```
SIGNAL → FOLD → compileBeliefs → decideTurnPlan(beliefs, goals)
         → [ACT if planned]
         → planUtterance
         → [perceive LLM only if plan.requiresLlm]
         → TELL → PROJECT
```

**Turn plan types:**

| Plan | When | LLM |
|------|------|-----|
| `reflex_only` | T0 chip, undo, handoff | ❌ |
| `template_tell` | status, confirm list, blocked | ❌ |
| `slot_extract` | missing size/modifier | optional mini |
| `transactional_perceive` | new order lines | JSON schema |
| `relational_perceive` | banter, vague recommend | free text → chat |
| `narrate_paraphrase` | committed facts, need warmth | T3 facts-only |

**Transactional vs relational** is a **plan branch**, not two competing chatbots. Director = `decideTurnPlan` (code).

---

## 5. Temporal runtime (anticipation-first)

Table OS means Denis **runs the session over time**, not only answers chat.

| Source | Signal | Denis behaviour |
|--------|--------|-----------------|
| Order `ready` | `commerce.order_status` | TELL + push = same headline |
| Payment settled | `commerce.payment_settled` | SETTLE goal → thanks |
| KDS stress | `venue.kds_stress` | skip upsell belief |
| Scheduler tick | `system.proactive_tick` | dessert / browse nudge |
| Floor backlog | `venue.capacity` | honest wait in FACE |

**Table Session Actor** (Phase E ✅): FIFO queue per `table_session_id` — no two-phone races.

**View transport:** PROJECT bumps `face.version` → SSE/Realtime — guest does not poll.

---

## 6. Venue Manifest (enterprise deploy unit)

Declarative package merged with `ConciergeConfig`:

```yaml
manifest_version: 1
identity:
  persona: playful_luxury
  languages: [de, en, sr]
  default_language: de

capabilities:
  relational: 3      # 0–4 lattice
  transactional: 3
  catalog_rag: 2
  guest_memory: 2
  anticipation: 2

policy:
  require_explicit_confirm: true
  rush_skip_upsell: true
  max_upsells_per_session: 1

models:
  transactional: gpt-4o
  relational: gpt-4o
  narrate: gpt-4o-mini

quality_contract:
  refusal_rate_max: 0
  eval_pass_min: 1.0
  shadow_parity_min: 0.99
  llm_invocation_max: 0.35
```

**Promotion gate:** sim replay last 7d timeline → eval green → owner sign-off → bump manifest version.

**Org ceiling:** chain contract caps `capabilities.*` — location cannot exceed.

Storage: `locations.venue_manifest` JSONB (new migration) or nested in `ai_concierge_config.manifest` until migration.

---

## 7. Context = Evidence pointers (not prompt stuffing)

LLM receives **UtterancePlan + Evidence**, not full menu every turn:

| Pointer | Loaded when |
|---------|-------------|
| `commerce.*` | always |
| `transcript.window` | always (last N) |
| `guest.memory` | capability ≥ 2 |
| `venue.ops` | capability ≥ 1 |
| `catalog.rag` | recommend / vague order |
| `playbook.examples` | relational / transactional LLM |
| `staff.hint` | enterprise only |

Retriever logic lives in `src/lib/denis/cognition/context/` — deterministic, budgeted by tier.

---

## 8. Service tiers (budget, not intelligence)

Tiers map to **token budget + capability ceiling** — intelligence comes from beliefs + policy.

| Tier | Customer | LLM budget | Capabilities |
|------|----------|------------|--------------|
| **standard** | Shadow / observe | mini, unified perceive | L0–L1 |
| **premium** | Single premium venue | RC=4o, TC=mini, split | L2 |
| **elite** | High ARPU, multilingual | RC+TC=4o, RAG | L3 |
| **enterprise** | Chain, white-label | + narrate 4o, org pack | L4 |

Ops tuning details: [ADR-021](./ADR-021-denis-concierge-tuning.md).  
Tier defaults code: `src/lib/denis/elite/tier-defaults.ts` → migrate to `cognition/`.

---

## 9. Quality Contract (sellable enterprise)

| SLO | Target | Enforcement |
|-----|--------|-------------|
| Refusal phrases | 0% | leadership sanitizer + eval |
| Language switch | ≤ 1 turn | belief `language` explicit |
| Order golden eval | 100% | block manifest promote |
| Shadow parity | ≥ 99% | ADR-006 gate |
| LLM invocation | ≤ 35% elite | turn metrics alert |
| p95 turn latency | < 4s | observability |
| Hallucinated SKU | 0 | ACL + price snapshots |

**Escalation:** belief confidence `< 0.6` on order slot → template “Potvrđujem sa timom” + `staff.hint` signal — never dead-end.

Timeline: `runtime.turn_profile` metadata (tier, plan, llm_used, beliefs_hash).

---

## 10. Implementation map (Maximum → code)

| Track | Deliverable | Depends on | Status |
|-------|-------------|------------|--------|
| **MR-0** | Ship language + leadership + `followGuest` | — | 🟡 local |
| **MR-1** | `compileBeliefs()` + 6 core beliefs + timeline event | FOLD | 🔲 |
| **MR-2** | `decideTurnPlan()` + `UtterancePlan` + template-first | MR-1 | 🔲 |
| **MR-3** | TDE wire in `run-denis-turn` (LLM only when plan says) | MR-2 | 🔲 |
| **MR-4** | Venue Manifest schema + merge | ConciergeConfig | 🔲 |
| **MR-5** | Evidence pointers (commerce, transcript, ops, guest) | MR-2 | 🔲 |
| **MR-6** | Menu RAG pointer | products + Redis | 🔲 |
| **MR-7** | Quality Contract metrics + admin strip | MR-3 | 🔲 |
| **MR-8** | Sim gate before manifest promote | M20 venue sim | 🔲 |
| **MR-9** | Org manifest pack + custom eval | platform admin | 🔲 |

**One PR = one MR track.** Same rule as ADR-019 phases.

### Folder layout

```
src/lib/denis/cognition/
  beliefs/          compile-beliefs.ts, belief-types.ts
  tde/              decide-turn-plan.ts, utterance-plan.ts, template-utterance.ts
  context/          plan-evidence.ts, retrievers/*
  manifest/         venue-manifest.schema.ts, merge-manifest.ts
  quality/          turn-profile.ts, contract-eval.ts
  resolve-runtime-profile.ts   # tier + manifest + ConciergeConfig
```

---

## 11. What Maximum Runtime explicitly does NOT do

| Out of scope | Why |
|--------------|-----|
| Second orchestrator / experience pipeline | ADR-020 §17 |
| LLM creates orders without ACL | Fiscal + ADR-010 |
| LLM reads/writes fiscal journal | ADR-012 |
| General AGI / open-domain chat | Different product |
| Fine-tuned per-venue model v1 | Ops cost; beliefs + playbook first |
| On-device LLM | No table-session truth |
| Copilot-style document Q&A | Not table scope |

---

## 12. Acceptance — “Maximum feels maximum”

1. **Banter:** “Denis legendo gde si” → belief `mode=banter`, SR template/LLM, **no** clarify, **no** refusal.
2. **Order:** “1x Cola 0,5L” → belief `mode=ordering`, TC plan, ACL submit path.
3. **World:** kitchen `ready` → push text = transcript line (Phase D ✅).
4. **Anticipation:** rush → no dessert chip; slow kitchen → empathy tell.
5. **Return guest:** memory → welcome belief → personalized T1 template.
6. **Enterprise:** manifest v2 sim green → promote; v2 rollback instant.
7. **Metrics:** elite venue `llm_invocation_rate` trending down as templates grow.

---

## 13. Operator sequence (Jovica)

```
1. Deploy MR-0 (language + leadership)
2. Pilot one venue: ADR-021 profile 4.1 + tier premium
3. MR-1 + MR-2 (beliefs + TDE) — one PR
4. MR-3 wire — measure llm_invocation_rate
5. MR-4 manifest — enterprise sales ready
6. Phase E SSE everywhere — no poll
```

**Verify always:** `pnpm verify:denis` · `pnpm eval:denis`

**Implement agent:** [ADR-023-session-prompts.md](./ADR-023-session-prompts.md) · **Operator:** [ADR-023-operator.md](./ADR-023-operator.md) · **Review:** [ADR-023-verification-checklist.md](./ADR-023-verification-checklist.md)

---

## 14. Document map

| Question | Read |
|----------|------|
| Why Table OS? | [ADR-020](./ADR-020-denis-table-operating-system.md) |
| Loop + signal/view | [ADR-019](./ADR-019-denis-unified-brain.md) |
| Ops tuning / pilot | [ADR-021](./ADR-021-denis-concierge-tuning.md) |
| Rollout + risk | [ADR-006](./ADR-006-denis-control-plane.md) |
| As-built code | [denis-implementation-map.md](./denis-implementation-map.md) |
| **Maximum production ceiling** | **ADR-023 (this)** |

---

## 15. Relation to ADR-005 and ADR-022

- **ADR-005** = cognitive **layers** (L1–L5) — largely **built** (M0–M28).
- **ADR-022** = early **tier/LLM** sketch — **superseded** by belief-first model here.
- **ADR-023** = how layers + loop + enterprise **run together in production** — the ceiling that matches Vera’s moat: **event-sourced table agent with policy brain and optional language LLM**.

**Pitch line:** *Copilot adds chat to POS. Denis Maximum Runtime is the POS for the table session.*
