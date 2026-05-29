# ADR-030: Denis Conversation Comprehension — Enterprise Cognition

| Field | Value |
|-------|--------|
| **Status** | **Accepted** — replaces partial ADR-025 slot/leadership gaps |
| **Date** | 2026-05-29 |
| **Supersedes** | ADR-025 §4.1 rows 2–4 (slot_extract as guest reply path) |
| **Extends** | [ADR-025](./ADR-025-tde-state-driven-routing.md) · [ADR-023](./ADR-023-denis-maximum-runtime.md) · [ADR-019](./ADR-019-denis-unified-brain.md) |
| **Code** | `compile-beliefs` · `decide-turn-plan` · `conversation-leadership` · `plan-evidence` |

---

## 0. One sentence

**Every guest message that expects understanding goes through LLM with dialogue frame context; templates only speak system facts; leadership never overrides ordering/clarify turns.**

---

## 1. Why architecture must change

Three parallel paths fought each other:

| Path | Problem |
|------|---------|
| `decideTurnPlan` → `slot_extract` template | Guest reply never comprehended |
| `conversation-leadership` | Rewrote LLM `clarify` → `"Tu sam!"` on typos |
| `ORDERING_GUEST_PATTERN` in beliefs | Typo `"povo"` → mode `banter` → context lost |

Infrastructure (TRUTH, loop, ACL) is enterprise. **Language layer was not.**

---

## 2. North star principles

| # | Principle |
|---|-----------|
| P1 | **Comprehend-first** — default guest text → `transactional_perceive` unless pure social or settling |
| P2 | **Speak-only templates** — templates for status/thanks/conflict headline only; never interpret guest input |
| P3 | **Dialogue frame** — beliefs encode what Denis is waiting for, not regex on current message |
| P4 | **Leadership guards ordering** — never rewrite `clarify` when `conversation.awaiting` or commerce pressure |
| P5 | **ACT via ACL only** — LLM proposes; policy executes |
| P6 | **Eval gates deploy** — typo/slot/confirm scenarios must pass before pilot |

---

## 3. Target stack

```
Guest message
      │
      ▼
┌─────────────────┐
│ FOLD → beliefs  │  dialogue frame + commerce pressure
└────────┬────────┘
         ▼
┌─────────────────┐
│ decideTurnPlan  │  L0 T0 | L1 speak-only | L2 perceive
└────────┬────────┘
         ▼
┌─────────────────┐
│ planEvidence    │  DIALOGUE FRAME + cart + transcript
└────────┬────────┘
         ▼
┌─────────────────┐
│ LLM perceive    │  transactional (default) | relational (social)
└────────┬────────┘
         ▼
┌─────────────────┐
│ leadership      │  refusal fix only; preserve clarify in ordering
└────────┬────────┘
         ▼
      ACT → TELL
```

---

## 4. Dialogue frame beliefs

| Key | Values | Derivation |
|-----|--------|------------|
| `conversation.awaiting` | `null` \| `serve_size` \| `modifier` \| `confirm` \| … | pending slot + flow node |
| `commerce.pressure` | `none` \| `open` \| `confirm` | cart/orders + recap/submit |
| `commerce.awaiting_confirm` | boolean | `pressure === confirm` |
| `conversation.mode` | sticky `ordering` when pressure/awaiting | **not** regex on guest message |
| `commerce.pending_slot` | unchanged | cart draft missing serve size |

**Removed from mode switch:** `ORDERING_GUEST_PATTERN` / `isCasualSocialMessage` as belief drivers.

---

## 5. Director algorithm (revised)

### L0 — T0 / handoff (0 credits)
Unchanged — contextual confirm only.

### L1 — Speak-only templates (0 credits)
Only when Denis **announces** system truth:
- `settle.thanks`, `cart.conflict`, `status.headline`

**Deleted:** `slot_extract` for guest **replies**.  
**Deleted:** `banter.welcome` as default reply path.

### L2 — Perceive (default)

```typescript
if (settling) → template_tell settle.thanks
if (pureSocialBanter && !commercePressure) → relational_perceive
if (vagueRecommend) → relational_perceive
else → transactional_perceive  // DEFAULT comprehend-first
```

When `conversation.awaiting !== null` → always `transactional_perceive`.

---

## 6. Conversation leadership (revised)

**Before:** `clarify` + casual message → `"Tu sam!"`  
**After:** preserve LLM output when:

- `commerce.pressure !== "none"`, OR
- `conversation.awaiting !== null`, OR
- `turnPlan.kind === transactional_perceive`

Still rewrite **refusal** replies (`"ne razumem"`, language refusal).

---

## 7. Evidence pack — dialogue block

```
DIALOGUE FRAME:
- mode: ordering
- awaiting: serve_size
- pressure: open
- pending_slot: serve_size
- last_denis: "Da li želiš 0,5L ili 0,3L?"
```

---

## 8. Implementation tracks

| Track | Deliverable |
|-------|-------------|
| **C1** ✅ | Leadership ordering guard |
| **C2** ✅ | Dialogue frame beliefs |
| **C3** ✅ | Comprehend-first default perceive |
| **C4** | Waiter-parity eval (typo, slot, 40 scenarios) |
| **C5** | Remove dead slot_extract template path |
| **C6** | Tool-use ACT (`set_serve_size`) — future maximum |

---

## 9. Anti-patterns (reject)

1. Template as response to guest input during ordering  
2. Leadership override on clarify in awaiting context  
3. Regex as LLM gate in `decideTurnPlan`  
4. Deploy without eval gate  
5. Second AI in guest path (Viktor sync)

---

## 10. Success metrics

| Metric | Target |
|--------|--------|
| `banter.welcome` on ordering turn | **0%** |
| Slot template loop on guest reply | **0%** |
| Typo recovery (eval) | **≥95%** |
| Session → order conversion (pilot) | **≥55%** |

---

*End of ADR-030*
