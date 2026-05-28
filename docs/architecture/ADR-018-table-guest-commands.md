# ADR-018: Table Guest Commands & Denis Handoff Spine

| Field | Value |
|-------|-------|
| **Status** | **Accepted** — M28 implemented |
| **Date** | 2026-05-27 |
| **Depends on** | [ADR-004](./ADR-004-denis-kernel.md) · [ADR-005](./ADR-005-denis-maximum.md) · [ADR-017](./ADR-017-denis-scene-first-presentation.md) |

## One sentence

**Every guest action a human can tap (waiter call, bill, payment method) is a `TableGuestCommand` perceived at T0, executed in ACT via ACL, narrated from committed facts — chat and chips share one path.**

## Commands

| Command | ACL | Guest narrate (SR) |
|---------|-----|-------------------|
| `WAITER.REQUEST` | `executeDenisWaiterHandoff` → `waiter_calls` | Na putu sam — samo trenutak. |
| `BILL.REQUEST` | clarify slot → ask method | Kako plaćate — kes, kartica, online? |
| `BILL.SET_METHOD(at_bar)` | `requestSessionPaymentInPerson` | Dolazim sa računom. |
| `BILL.SET_METHOD(card_at_table)` | same | Stižem sa terminalom. |
| `BILL.SET_METHOD(online)` | scene sheet hint | Otvaram plaćanje karticom. |

## Invariants

1. **LLM never decides** handoff — T0 `perceiveTableGuestCommand` or `structuredIntent` from chips.
2. **Handoff ACT is live by default** (`handoff.liveExecution: true`) — not gated on `actLayerEnabled`.
3. **Legacy LLM message overridden** when handoff ACT succeeds (`resolveActHandoffOutcome.overrideLegacy`).
4. **Chips use `structuredIntent`** — no direct `/api/waiter-calls` from scene UI.

## Code map

| Area | Path |
|------|------|
| Perceive | `src/lib/denis/commands/perceive-table-guest-command.ts` |
| ACL waiter | `src/lib/denis/acl/execute-denis-waiter-handoff.ts` |
| ACL payment | `src/lib/denis/acl/execute-denis-payment-handoff.ts` |
| Session resolve | `src/lib/denis/acl/resolve-handoff-session.ts` |
| Payment spine | `src/lib/sessions/request-session-payment-in-person.ts` |
| Act | `src/lib/denis/runtime/act/execute-skill.ts` |
| Narrate | `src/lib/denis/runtime/act/handoff-narration.ts` |

## Tracks

| Track | Scope |
|-------|-------|
| **M28** ✅ | T0 + ACL + narrate override + chip `structuredIntent` |
| Phase **A** | `foldTableSessionState()` — was “M29 beliefs loader” |
| Phase **B** | Online payment sheet bridge from turn meta (was M30) |
