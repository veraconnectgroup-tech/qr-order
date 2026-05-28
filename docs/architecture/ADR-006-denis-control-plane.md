# ADR-006: Denis Control Plane — Governance, Risk, Observability, Rollout

| Field | Value |
|-------|-------|
| **Status** | **Accepted** — operational overlay (does **not** supersede [ADR-005](./ADR-005-denis-maximum.md)) |
| **Date** | 2026-05-27 |
| **Depends on** | [ADR-003](./ADR-003-denis-platform-v2.md) · [ADR-004](./ADR-004-denis-kernel.md) · [ADR-005](./ADR-005-denis-maximum.md) |

---

## 0. One sentence

**Control Plane** defines how Denis is **governed, observed, simulated, and rolled out** — mapped onto existing PPAN + Kernel, not a second agent brain.

---

## 1. Why this exists

ADR-005 defines **what Denis does**. Production needs **how we trust it**:

| Gap | Control plane answer |
|-----|----------------------|
| Policy scattered | Unified **risk gate** before every action |
| PPAN vs “agent loop” confusion | **Explicit mapping** (no duplicate state machine) |
| Shadow mentioned but not staged | **Rollout ladder** |
| Timeline without traces | **traceId + provenance** per turn |
| Eval without risk asserts | **R0–R5** on every skill |

---

## 2. Mapping — not a second brain

| Control plane term | Existing runtime | Layer |
|--------------------|------------------|-------|
| **Perceive** | PERCEIVE (ADR-003) | `runtime/perceive/` |
| **Interpret** | T0 reflex + T2 slot extract | `runtime/perceive/` |
| **Plan** | Goal stack + Flow DSL | `kernel/` + `platform/flows/` |
| **Decide** | Policy engine + **risk gate** | `kernel/` + this ADR |
| **Act** | Skills + ACL | `runtime/act/` + `acl/` |
| **Observe** | Timeline append | `platform/` |
| **Learn** | L3 edge queue (offline) | `learning/` — **never in live turn loop** |

**Rule:** No LLM step named “decide”. Decide = deterministic policy + risk class.

---

## 3. Risk-gated actions (R0–R5)

Every planned action carries a risk class. **Higher risk → more gates.**

| Class | Meaning | Examples | Gates |
|-------|---------|----------|-------|
| **R0** | Narration only | template status, linted T3 | narration contract |
| **R1** | Suggestion | VKG pairing chip, browse list | policy read-only |
| **R2** | Draft mutation | `cart.add`, `cart.remove`, correction | policy + cart-validator |
| **R3** | Staff-visible | staff copilot draft, floor hint | staff channel only |
| **R4** | Guest-visible commitment | recap, confirm prompt | explicit guest signal |
| **R5** | Irreversible / external | `order.submit`, waiter call API | ACL + idempotency + policy |

**Invariants:**

- R5 **only** through `src/lib/denis/acl/` (+ legacy `order-executor` until M7 cutover)
- T3 output is **always R0** (never promotes to R2+)
- Rollout mode may **block** classes (see §6)

Skill registry (M3+) must declare `riskClass` per skill.

---

## 4. Policy engine (consolidated)

Single `evaluateActionRisk(action, ctx)` — wraps ADR-002 policy checks + risk class:

```typescript
type RiskDecision =
  | { allow: true; riskClass: DenisRiskClass }
  | { allow: false; riskClass: DenisRiskClass; reason: string; guestMessage: string }
  | { allow: true; riskClass: DenisRiskClass; requireStaffApproval: true };
```

| Check | Applies to |
|-------|------------|
| Allergen / 86 / closed | R1–R5 |
| Max items / total | R2, R5 |
| Upsell caps | R1, R2 |
| `requireExplicitConfirm` | R4, R5 |
| Staff override flag | all — forces HANDOFF or template |
| Rollout mode block | see §6 |

Staff override: belief `staff.aiPaused` → block R1–R5, R0 empathy template only.

---

## 5. Observability contract

Every turn writes to `denis_timeline` with:

```typescript
type TurnEnvelope = {
  traceId: string;              // UUID v4 per turn
  surface: "chat" | "nudge" | "sense" | "staff";
  rolloutMode: RolloutMode;
  configVersion: 1;
  latencyMs?: { perceive; plan; act; narrate };
  tokenUsage?: { prompt; completion; model };
};
```

**Required events per guest turn (minimum):**

1. `perception.ingested` — includes envelope  
2. `intent.resolved` — tier T0|T2  
3. `plan.created` — planned actions + **risk class each**  
4. `skill.executed` | `policy.blocked`  
5. `narration.sent` — tier template|T3  

**Provenance chain:** `evidenceEventSeq` on beliefs (ADR-004) ← timeline `seq`.

**Metrics (M10+):** p50 LLM/turn, R5 count, policy block rate, lint fail rate, cost per session.

---

## 6. Rollout ladder

```typescript
type RolloutMode =
  | "simulation"      // eval harness only — no guest impact
  | "shadow"          // dual-run, guest sees legacy
  | "staff_only"      // copilot + admin debug, no guest chat
  | "cohort"          // % tables or allowlist tokens
  | "live";           // full production
```

**Storage:** `ConciergeConfig.rollout.mode` (M10 config extension) + env override for platform ops.

| Mode | Guest sees | Denis executes | Timeline |
|------|------------|----------------|----------|
| simulation | — | full replay | fixture |
| shadow | legacy chat | full PPAN+ | written |
| staff_only | menu only | staff channel | written |
| cohort | Denis if in cohort | full | written |
| live | Denis | full | written |

**Promotion criteria (M10 gate):**

- Shadow ≥99% action parity on fixtures  
- Zero R5 without ACL path in red-team  
- p50 LLM ≤0.5/turn on golden set  

---

## 7. Simulation harness

Extends ADR-005 eval — same fold code as production.

```
eval/fixtures/timeline/*.jsonl   # recorded sessions
eval/fixtures/venue/*.json       # fake ops state (86, rush)
eval/run-replay.ts               # fold → assert beliefs + risk
eval/assert-risk.ts              # no R5 without mock ACL ack
```

**Fake venue state** injects as `realtime.ingested` events — no live DB.

---

## 8. Module layout (control plane)

```
src/lib/denis/
├── platform/
│   ├── risk-levels.ts           # R0–R5 types + skill map (M3)
│   └── timeline-*               # traceId on append (M2)
├── kernel/
│   └── evaluate-action-risk.ts  # M6 — wraps policy + rollout
└── eval/
    ├── shadow-diff.ts           # M10
    └── assert-risk.ts           # M10
```

---

## 9. Implementation tracks (additive)

| Track | Control plane deliverable |
|-------|---------------------------|
| **M2** | `traceId` on timeline events |
| **M3** | `riskClass` on skill registry + Flow DSL |
| **M6** | `evaluateActionRisk()` unified |
| **M10** | rollout config, shadow diff, eval risk asserts |
| **M18** | admin trace viewer (beliefs + timeline + risk) |

Does **not** block M2–M9 kernel spine.

---

## 10. Approval checklist

- [ ] ADR-006 accepted as **operational overlay**, not new north star  
- [ ] R0–R5 required on skill registry from M3  
- [ ] traceId on all timeline appends from M2  
- [ ] Rollout modes enforced before guest cutover (M10)  
- [ ] “Learn” stays offline — not in turn loop  

---

## 11. Operator prompt

```
Denis Control Plane mode. Read ADR-006 + denis-implementation-map.md §9.
Implement next open control-plane track. Map to PPAN/Kernel — no duplicate agent loop.
Run pnpm verify:denis. Do not commit unless asked.
```

---

**Related:** [Implementation map](./denis-implementation-map.md) · [ADR-005 Maximum](./ADR-005-denis-maximum.md)
