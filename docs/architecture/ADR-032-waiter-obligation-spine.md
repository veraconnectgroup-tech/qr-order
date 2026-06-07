# ADR-032: Waiter Obligation Spine (Table OS 2×)

| Field | Value |
|-------|--------|
| **Status** | **Accepted** |
| **Date** | 2026-05-29 |
| **Extends** | [ADR-019](./ADR-019-denis-unified-brain.md) · [ADR-020](./ADR-020-denis-table-operating-system.md) |
| **Code** | `src/lib/denis/cognition/waiter/` |

---

## Problem

Table OS loop (SIGNAL→FOLD→DECIDE→ACT→TELL→PROJECT) was architecturally correct but **waiter quality** still felt like chat because:

1. Gap detection lived only in legacy `kernel-ordering-bridge` (post-LLM patch).
2. Gaps did not **persist** across turns — guest says *„da"* at recap while pivo still missing → submit could proceed.
3. FACE had no visible “what’s missing” layer.

## Decision

Add **Waiter Obligation** as a first-class cognition primitive — same role Cursor’s type-checker has for code.

```typescript
WaiterObligation = {
  understood: string[];   // what guest asked for
  inCart: string[];       // what Denis has
  gaps: WaiterGap[];      // what must be clarified
  nextAction: ...;        // clarify | confirm | continue
  canConfirm: boolean;    // false while gaps exist
}
```

### Where it runs

| Step | Behaviour |
|------|-----------|
| **FOLD** | `assessWaiterObligation()` from cart + last order-line in transcript |
| **compileBeliefs** | `waiter.gap_count`, `waiter.can_confirm`, `waiter.primary_gap` |
| **DECIDE** | `waiter.gap_blocks_confirm` → template TELL, no submit |
| **ACT** | `kernel-ordering-bridge` + `run-denis-turn` block `submitOrder` when `!canConfirm` |
| **TELL** | `enforceWaiterTell()` — never silent omission |
| **PROJECT** | inline layer on view when gap active |

### Invariants

- **No confirm with holes** — `canConfirm === false` → kitchen never receives partial intent.
- **Gaps persist** — parsed from transcript order-line, not only current message.
- **0-token clarify** — gap templates before LLM (`waiter.gap_clarify.*`).

## Quality gate

- `pnpm eval:denis` includes `wp_gap_blocks_confirm_drink`
- `src/__tests__/waiter-obligation.test.ts`

## 3. Autonomous State Writer (Viktor parity at table)

Denis must **write without a guest turn** when folded state changes — same as Viktor posts in Slack when metrics shift.

| Trigger | Writer |
|---------|--------|
| FOLD finds `obligation.gaps` | `detectWaiterObligationTell()` |
| Session watcher cron (60s) | `planProactiveTurn` → `waiter_gap` **before** welcome/upsell |
| Guest turn | `enforceWaiterTell()` on ACT/TELL |

**Priority:** `waiter_gap` bypasses `commerce.active` proactive block — cart with holes is operational, not marketing.

**Dedupe:** `waiter_gap:{primaryGap}` + transcript text match — no spam.

### One-line product rule (for operators + agents)

> **Denis = Viktor za sto:** vidi celo stanje, sam piše šta sledi, nikad ne ćuti.

## Next (3× path)

1. Real iota timeline fixtures → obligation replay CI
2. Venue playbook examples in obligation prompts
3. Viktor reads `waiter.gap_rate` from Operator API
4. WORLD signals (kitchen ready, delay) → same autonomous writer path
