# ADR-032: Denis Commit Contract — Say It Only After ACT

| Field | Value |
|-------|--------|
| **Status** | **Accepted** — pilot execution track |
| **Date** | 2026-05-29 |
| **Extends** | [ADR-030](./ADR-030-denis-conversation-comprehension.md) · [ADR-031](./ADR-031-denis-maximum-cognition-phases.md) · [ADR-020](./ADR-020-denis-table-operating-system.md) |
| **Code** | `commit-outcome-messages.ts` · `run-denis-turn.ts` · `execute-act-phase.ts` · ACL |

---

## 0. One sentence

**Denis plans in language; the platform commits in ACL. Guest-visible success claims exist only after ACT returns ok.**

---

## 1. Problem

Pilot behaved like AI chat:

- Said *"poručio si"* / *"poslato"* without `orders` row
- Said *"proveriću"* instead of reading TRUTH
- Bill / waiter requests sometimes acknowledged in text without dashboard side effect

Architecture was correct (ACL, handoff skills, Situation Pack). **Execution contract was not enforced on TELL.**

---

## 2. Commit types (three real actions)

| Commit | Guest intent (examples) | ACL | Dashboard effect |
|--------|-------------------------|-----|------------------|
| **ORDER_SUBMIT** | confirm after recap, *"može"*, *"to je sve"* | `executeDenisOrderCommand` | Order in KDS / kitchen |
| **BILL_REQUEST** | *"račun"*, *"želim da platim"*, *"pošalji račun"* | `executeDenisPaymentHandoff` | `payment_requested_at` + staff push |
| **WAITER_CALL** | *"konobar"*, *"pozovi osoblje"* | `executeDenisWaiterHandoff` | `waiter_calls` row + staff push |

Everything else is **language only** (clarify, sell, explain menu).

---

## 3. Stack (unchanged — enforced)

```
Guest message
     │
     ▼
FOLD → Situation Pack (TRUTH: cart, orders, phase, bill state)
     │
     ▼
LLM perceive (plan: message + cartActions + submitOrder)
     │
     ▼
T0 handoff detect (bill / waiter — no LLM required)
     │
     ▼
ACT (ACL) — order.submit | handoff.payment | handoff.waiter
     │
     ▼
TELL — guest text FROM commit outcome OR honest failure
     │
     ✗ LLM must NOT claim success before ACT ok
```

---

## 4. TELL rules

| ACT result | Guest message source |
|------------|---------------------|
| `order.submit` ok + orderNumber | Template: *"Poslato — #N ide u kuhinju"* |
| `order.submit` failed | `guestBlockedReason` (missing context, empty cart, …) |
| `submitOrder` true but ACT not attempted | *"Nisam mogao poslati — osvežite i pokušajte"* |
| `handoff.payment` ok | Template: method + staff notified |
| `handoff.waiter` ok | Template: *"Konobar je obavešten"* |
| No open orders + status question | Situation Pack truth — never fake async |

**Sanitizer** remains last-resort; primary path is ACT-first TELL.

---

## 5. Pilot config (required)

Location preset **`table_os_pilot`**:

- `rollout.mode: denis_only`
- `ordering.actLayerEnabled: true`
- `ordering.actDryRun: false`
- `ordering.actSubmitEnabled: true`
- `handoff.liveExecution: true` (default)
- `handoff.waiterCall: true`
- `handoff.paymentHint: true`

Without this, ACL runs in preview — guest sees chat, kitchen sees nothing.

---

## 6. Sales / conversation (LLM job)

Not regex modules. Instructions + menu + phase:

- Vague *"pivo"* → *"Pilsner 0,5L ili Weizen?"* (one line)
- Named product + size → `order` immediately, no chit-chat
- No welcome after guest stated intent
- Sell like excellent waiter — not spam, not cards

---

## 7. Acceptance (pilot gate)

| Scenario | Pass |
|----------|------|
| Confirm after recap | `orders` row + Denis says #N |
| *"jedno pivo"* → pick → confirm | Kitchen receives order |
| *"želim da platim"* | Dashboard payment request + push |
| *"pošalji račun"* | Same as bill request |
| *"pozovi konobara"* | `waiter_calls` row |
| *"jesi poslao?"* with no order | Honest: not sent yet |
| Denis never says *"poslato"* without order ID | 100% eval |

Run: `pnpm eval:denis` + manual on `demo-table-1`.

---

## 8. Implementation checklist

- [x] ADR-032 (this doc)
- [x] `commit-outcome-messages.ts` — ACT-first guest copy
- [x] `run-denis-turn` — override TELL from ACT; handoff ACL fallback
- [x] Bill phrase expansion (SR/DE/EN)
- [x] Prompt: commit contract + smart sales + skip welcome on intent
- [ ] Deploy uncommitted fixes to iota
- [ ] Skyline Lounge → `rollout.mode: denis_only` (auto-enables live ACT submit)
- [ ] Guest path sends `deviceFingerprint` (fixed in `guest-denis-layer.tsx`)

---

*End of ADR-032*
