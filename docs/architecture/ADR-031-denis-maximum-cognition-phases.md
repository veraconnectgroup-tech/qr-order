# ADR-031: Denis Maximum Cognition — Phased Build (Brain to 100%)

| Field | Value |
|-------|--------|
| **Status** | **Accepted** — implementation track |
| **Date** | 2026-05-29 |
| **Extends** | [ADR-030](./ADR-030-denis-conversation-comprehension.md) · [ADR-023](./ADR-023-denis-maximum-runtime.md) · [ADR-020](./ADR-020-denis-table-operating-system.md) |
| **Code** | `cognition/context/build-situation-pack.ts` · `plan-evidence.ts` · `run-denis-turn.ts` |

---

## 0. One sentence

**Denis becomes “100% smart” when every LLM turn receives a Unified Situation Pack from TRUTH, ACT closes the loop on guest replies, and journey eval gates deploy — not when the model gets bigger.**

---

## 1. Maturity ladder

| % | Phase | Deliverable | Gate |
|---|-------|-------------|------|
| 55 | **C0** | ADR-030 comprehend-first (done) | unit tests |
| **70** | **C1** | **Situation Pack (FSP)** on every LLM turn | `situation-pack.test.ts` ✅ |
| 85 | **C2** | ACT guarantee — pending slot / confirm | ✅ local |
| 95 | **C3** | Waiter-parity journey eval (48) | ✅ CODE |
| 98 | **C4** | Quality contract metrics (MR-7) | ✅ CODE |
| 100 | **C5** | Sim-before-promote (MR-8) | ✅ CODE |

**Next track:** Phase D — proactive in brain loop ([backlog Wave 3](./DENIS-FULL-IMPLEMENTATION-BACKLOG.md)).

---

## 2. Formula

```
SMART = TRUTH (see all) × PROCESS (know phase) × ACT (do it) × LANGUAGE (speak facts)
```

---

## 3. Phase C1 — Unified Situation Pack (FSP)

### 3.1 Problem

`TableSessionState` knows phase, flow, orders, cart, party — but perceive prompt received **fragments**. Transcript pointer existed but was **not wired** from timeline in `run-denis-turn`.

### 3.2 Solution

`buildSituationPack()` assembles one deterministic block before menu:

```
SITUATION PACK (truth — do not contradict):
PROCESS: phase, flow_node, session
DIALOGUE: mode, awaiting, pressure, last_denis
COMMERCE: draft, cart, open orders
PARTY / GUEST / VENUE OPS (when present)
RECENT TRANSCRIPT
PHASE BEHAVIOR: phase-specific instructions
```

### 3.3 Wiring

- `run-denis-turn` → `timelineToStoredMessages(state.timeline)` → `planEvidence({ transcript, sessionPhase: foldMeta.phase })`
- `planEvidence` → FSP first on `requiresLlm` turns; RAG + playbook unchanged

### 3.4 Acceptance

- [x] LLM turn includes `situation.pack` pointer
- [x] `session.phase` + `flow_node` visible in prompt
- [x] Transcript last 5 turns from timeline
- [x] No duplicate dialogue.frame block (merged into FSP)

---

## 4. Phase C2 — ACT guarantee ✅

| Step | Code |
|------|------|
| C2.1 | `fuzzy-slot-reply.ts` — typo/phrase → serve size |
| C2.2 | `resolve-pending-slot-act.ts` — deterministic cart mutate (0 credits) |
| C2.3 | `run-denis-turn` — pre-LLM ACT + post-LLM retry if still pending |
| C2.4 | `decide-turn-plan` — removed `slot_extract` guest reply path |

### C2 acceptance

- [x] T0/fuzzy slot fill before LLM when session has pending
- [x] Post-perceive retry when LLM left pending unchanged
- [x] No `slot_extract` on guest pending-slot replies
- [x] Tests: `fuzzy-slot-reply.test.ts`, `denis-tde.test.ts`

**One PR per phase.** C1 ✅ · C2 ✅ — next: **C3 journey eval**.

---

## 5. Phase C3 — Journey eval ✅

Folder: `src/lib/denis/eval/fixtures/waiter-parity/` · runner: `run-waiter-parity.ts`

**Deploy gate:** `pnpm eval:denis` waiter parity ≥ 95% (in `runPilotGate`).

---

## 6. Phase C4/C5 ✅

See `cognition/quality/` and `manifest/manifest-promote-gate.ts`.

---

## 7. Anti-patterns

1. Bigger model without FSP  
2. Template interpreting guest replies during ordering  
3. Deploy without journey eval  
4. Viktor / Operator code in guest hot path  

---

## 7. Agent prompt (one line)

```
Read ADR-031. Implement next open phase only (C1→C5). Wire FSP in run-denis-turn. pnpm test:run situation-pack + denis-tde + denis-eval.
```

---

*End of ADR-031*
