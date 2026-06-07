# ADR-037 — Agent synthesis (P0 / P1 / P2)

| Field | Value |
|-------|--------|
| **Source** | [ADR-036](./ADR-036-agent-architecture-proposals.md) AGENT-00…26 |
| **Rule** | Jedan stub po PR · bez duplikata između agenata |
| **Updated** | 2026-06-07 |

---

## P0 — blokira COMPLETE / live pilot

| # | Šta | Stub / fajl | Agenti |
|---|-----|---------------|--------|
| 1 | **iota obligation pilot harness** — čista sesija, 5 koraka, assert response + view | `scripts/iota-obligation-pilot.ts` | 02, 17, 18 |
| 2 | **Pravilo:** `eval:denis` PASS ≠ ADR COMPLETE dok pilot harness nije PASS | session report + tracker | 02, 17 |
| 3 | **Signal SLA** — template/gap turn <15s; fallback `executeDenisSignalCore` kad actor queue ne drain-uje | `table-session-actor.ts`, `run-denis-signal.ts` | 02, 11, 13 |
| 4 | **Cleanup stubova** — perceive shim obrisan; `persistMessages` grana gone; `sceneRefreshBump` van guest UI | `cognition/perceive`, `guest-denis-layer`, `menu-view` | 06, 12, 14, 19 |
| 5 | **Obligation = eval = stol** — isti `assessWaiterObligation` u FOLD, confirm block, cron `waiter_gap` | `cognition/waiter/*` | 01, 02, 03 |
| 6 | **ADR-036** — jedan dokument, sekcije netaknute posle merge-a | `ADR-036-agent-architecture-proposals.md` | 00 |

**P0 exit:** `pnpm exec tsx scripts/iota-obligation-pilot.ts` 5/5 · `eval:denis` + `verify:denis` PASS · nema `signal_timeout` na gap turnu.

---

## P1 — sledeće 1–3 nedelje (MAKSIMUM stubovi)

| # | Šta | Stub | Agenti |
|---|-----|------|--------|
| 1 | **Live transport gate** — SSE view reconnect eval; 2-phone FIFO na iota; poll ≥30s samo fallback | F6/M8, M2 | 11, 12, 13 |
| 2 | **WORLD live pilot** — kitchen Ready → push body = transcript line; atom outbox sa status PATCH | M5, D.2–D.3 | 08, 09 |
| 3 | **Transcript TRUTH read** — operator/dashboard na timeline fold; compliance `GUEST_TRANSCRIPT_DUAL_WRITE` | T4, ARCH-4 | 14, 16, 22 |
| 4 | **Guest UI view-only** — derived transcript render; order tracker na `controlledView`; bez parallel order poll | F4, F5, ARCH-5 | 15, 19 |
| 5 | **Waiter eval hardening** — shared `iotaBurgerPivoGap` helper; waiter-parity ↔ timeline jedan DSL; 80+ stabilno | C3, T7 | 17, 18 |
| 6 | **Continuous mind** — world FOLD+merge pre TELL; `mind.obligation_snapshot` u timeline | ARCH-6, M9 | 24 |
| 7 | **L3 perceive** — Zod schema po `InterpretationSchema`; obriši regex veto u `resolvePerceivePlan` | C12, ARCH-7 | 25 |
| 8 | **Menu RAG** — no-unknown-SKU eval; Redis invalidation gate; live „lagano“ pilot | C10, MR-6 | 20 |
| 9 | **Playbook pack** — jedan `resolvePlaybookPackId`; DB/registry; iota ton diff | MR-9, C11 | 21 |
| 10 | **Operator I-track** — shared `timeline-kpi.ts`; `denis.order.phase_changed`; throttle webhooks | I1, I2 | 22, 23 |
| 11 | **Manifest promote** — production JSON timeline sim; `evaluateManifestPromoteGate` bez duplog eval run-a | MR-8 | 26 |
| 12 | **ARCH-2 finiš** — `order-message-backfill` → `platform/transcript-order-line`; 0 `lib/ai/ordering` u `cognition/waiter` | 034-A.5 | 05, 07 |
| 13 | **Order lifecycle u cognition** — `finalizeOrderFlow` / draft ACL van runtime `lib/ai/ordering` | C5 | 04, 07 |

---

## P2 — queued (ne blokira §Kad start)

| # | Šta | Track | Agenti |
|---|-----|-------|--------|
| 1 | Venue-manifest playbook gaps (ne regex drink) | ADR-031 hardening | 03, 05 |
| 2 | 150+ waiter-parity + matrix generator DE/EN/SR | C3 | 17 |
| 3 | 20+ anonymized production timeline JSON fixtures | T7, P9 | 18 |
| 4 | `ai_sessions.messages` column deprecate + migration | ARCH-4 | 16 |
| 5 | Enterprise cross-location RAG + observability | MR-6/E2 | 20 |
| 6 | Platform admin playbook assign + chain eval | MR-9/E6 | 21 |
| 7 | Viktor read skill + sandbox contract CI (I3) | ADR-028/029 | 22, 28 |
| 8 | Journey signals ADR-013/014 (samo Denis signals) | ADR-020 §17 | 13 |
| 9 | L3 secondary goals + 15+ eval + shadow diff | C12 | 25 |
| 10 | Chain rollout GA gate pre `tableSessionActor` šire | Phase E | 11, 13 |
| 11 | Anticipation eval 40+ + autonomous WORLD writer | ADR-020 §Kad | 03, 08 |
| 12 | `execute-chat-turn.ts` delete posle signal GA | Phase F | 14, 16 |

---

## Redosled implementacije (jedan PR po sesiji)

```
P0 harness + SLA + cleanup  →  P1 transport/world/transcript  →  P1 eval hardening  →  P2 enterprise
```

**Aktivni tracker:** [ADR-033-active-tracker.md](./ADR-033-active-tracker.md) · **Perfection:** [ADR-034](./ADR-034-denis-perfection-doctrine.md) · **Stubovi:** [ADR-035](./ADR-035-pillar-strengthening-plan.md)
