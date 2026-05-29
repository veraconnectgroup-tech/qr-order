# Denis — Full Implementation Backlog

| Field | Value |
|-------|--------|
| **Purpose** | **Single contract** — everything envisioned must land here with status |
| **Rule** | Vision ADRs describe *north star*; **this doc** describes *done vs not* |
| **Updated** | 2026-05-29 |
| **As-built code map** | [denis-implementation-map.md](./denis-implementation-map.md) |

---

## Status legend

| Status | Meaning |
|--------|---------|
| **CODE** | Merged on `main`, tests pass |
| **DEPLOY** | On production (iota) + rollout enables guest path |
| **OPEN** | Not started or stub only |
| **PARTIAL** | Code exists; gate/verify/deploy/doc incomplete |

**Definition of done (every item):** CODE + `pnpm eval:denis` + row updated here + deploy note if guest-visible.

---

## Wave 0 — Cognition spine (ADR-030 / ADR-031)

| ID | Deliverable | Status | Code / gate |
|----|-------------|--------|-------------|
| C0 | Comprehend-first, leadership guards | **CODE** | `conversation-leadership.ts`, ADR-030 |
| C1 | Situation Pack (FSP) | **CODE** | `build-situation-pack.ts`, `situation-pack.test.ts` |
| C2 | ACT guarantee (slot/confirm) | **CODE** | `fuzzy-slot-reply.ts`, `resolve-pending-slot-act.ts` |
| C3 | Waiter-parity eval (48 scenarios) | **CODE** | `run-waiter-parity.ts`, pilot gate |
| C4 | Quality contract (MR-7) | **CODE** | `contract-eval.ts`, admin strip |
| C5 | Sim-before-promote (MR-8) | **CODE** | `manifest-promote-gate.ts`, admin panel |
| I0 | Cognition gate before Operator API | **PARTIAL** | eval green locally; doc gate + iota deploy |

---

## Wave 1 — Maximum Runtime (ADR-023 MR)

| ID | Deliverable | Status | Code / gate |
|----|-------------|--------|-------------|
| MR-0 | Language + leadership + followGuest | **CODE** | `conversation-leadership.ts` — verify on iota |
| MR-1 | `compileBeliefs()` + timeline | **CODE** | `compile-beliefs.ts`, `mind.beliefs_compiled` |
| MR-2 | `decideTurnPlan()` + utterance plan | **CODE** | `cognition/tde/*` |
| MR-3 | TDE wire in `run-denis-turn` | **CODE** | `runTdePerceive` |
| MR-4 | Venue manifest schema + merge | **CODE** | `venue-manifest.schema.ts` |
| MR-5 | Evidence pointers + retrievers | **CODE** | `plan-evidence.ts`, `retrievers/*` |
| MR-6 | Menu RAG (keyword v1) | **PARTIAL** | `menu-rag.ts` — embeddings **OPEN** (E2) |
| MR-7 | Quality contract + admin strip | **CODE** | Wave 0 C4 |
| MR-8 | Sim gate before promote | **CODE** | Wave 0 C5 |
| MR-9 | Org playbook pack | **OPEN** | `playbookPackId` + pack loader |

---

## Wave 2 — Unified brain phases (ADR-019)

| ID | Deliverable | Status | Code / gate |
|----|-------------|--------|-------------|
| A | FOLD `TableSessionState` | **CODE** | `loop/fold-table-session-state.ts` |
| B | VIEW `GET /api/denis/view` | **CODE** | `project-view.ts` |
| C | SIGNAL `POST /api/denis/signal` | **CODE** | `api/denis/signal/route.ts` |
| D | WORLD → TELL + push | **PARTIAL** | `tell-world-order.ts` — operator webhooks **OPEN** |
| E | Table Session Actor + SSE | **PARTIAL** | `actor/*` — Redis-gated; order poll fallback **OPEN** |
| F | Transcript from timeline only | **PARTIAL** | fold transcript — legacy messages **OPEN** |
| G1 | Guest UI → view only | **CODE** | `guest-denis-layer`, `menu-view` |
| G2 | ACL submit single path | **CODE** | `execute-denis-order-command` |
| G3 | Pilot gate + SR eval | **CODE** | `run-pilot-gate.ts` |
| G4 | Retire legacy perceive path | **PARTIAL** | shim remains; full delete **OPEN** |

---

## Wave 3 — Proactive enterprise (ADR-020 Kad + ADR-021)

| ID | Deliverable | Status | Code / gate |
|----|-------------|--------|-------------|
| D-PRO | Proactive through same brain loop | **CODE** | `plan-proactive-turn.ts` + `run-denis-sense.ts` |
| D-EVAL | Anticipation eval suite (20+) | **CODE** | `fixtures/anticipation/` + pilot gate |
| D-MEM | Guest memory in FSP every turn | **CODE** | `plan-evidence.ts` guest.memory ≥1 |
| D-NUDGE | pairing / dessert / slow-kitchen at phase | **CODE** | `decide-proactive-turn-plan.ts` phase guards |
| D-WORLD | Kitchen ready = same TELL as chat | **CODE** | Phase D tell unification |
| D-PLAY | Playbook examples in every LLM turn | **PARTIAL** | wired in perceive; pack resolver **OPEN** |

---

## Wave 4 — Elite enterprise (ADR-022)

| ID | Deliverable | Status |
|----|-------------|--------|
| E1 | Narrate model from tier profile | **PARTIAL** |
| E2 | Menu RAG embeddings + Redis | **OPEN** |
| E3 | Org tier ceiling + playbook packs | **OPEN** |
| E4 | Credit multiplier + SLA dashboard | **OPEN** |
| E5 | Per-org eval + sim CI on promote | **OPEN** |

---

## Wave 5 — Integration / Viktor (ADR-028 / ADR-029)

| ID | Deliverable | Status |
|----|-------------|--------|
| I1 | Operator API read + audit | **PARTIAL** |
| I2 | `denis.*` webhooks + rollup | **OPEN** |
| I3 | OpenAPI + contract tests | **OPEN** |
| I4 | Admin Connect UI | **OPEN** |
| I5 | Config proposals (`operator:propose`) | **OPEN** |
| I6 | Ingress adapters (POS in) | **OPEN** |
| V4 | Viktor Skill read-only | **OPEN** |

---

## Wave 6 — Market modules (DENIS-TABLE-OS)

| ID | Deliverable | Status |
|----|-------------|--------|
| M-US | US tax, tips, receipt | **OPEN** |
| M-UK | VAT display | **OPEN** |
| M-EU | eReceipt | **OPEN** |

---

## Wave 7 — Commerce experience (ADR-013 / ADR-014)

| ID | Deliverable | Status |
|----|-------------|--------|
| CE-1→7 | Journey signals only (no second brain) | **PARTIAL** |

---

## Execution order (one PR each)

See **[DENIS-PHASED-IMPLEMENTATION-PLAN.md](./DENIS-PHASED-IMPLEMENTATION-PLAN.md)** for F0→F9.

Summary:
```
F0 deploy pilot → F1 hardening → F2 proactive brain → F3 real-time
→ F4 enterprise brain → F5 operator → F6 commerce → F7 elite → F8 Viktor → F9 markets
```

---

## Agent one-liner

```
Read DENIS-FULL-IMPLEMENTATION-BACKLOG.md. Pick first OPEN/PARTIAL in execution order.
One PR. CODE + eval + update this doc row. No new ADR ✅ until row is CODE.
```

---

*End of backlog*
