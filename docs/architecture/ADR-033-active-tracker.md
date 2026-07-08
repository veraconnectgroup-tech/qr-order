# ADR-033 — Active ADR Tracker

| Field | Value |
|-------|--------|
| **Purpose** | Koji ADR radimo **sada** — jedan po jedan, nedeljama |
| **Rule** | **Ne počinje sledeći ADR** dok trenutni nije **COMPLETE** |
| **Perfection** | [ADR-034](./ADR-034-denis-perfection-doctrine.md) — menjamo arhitekturu ako eval kaže |
| **Stubovi (detalj)** | [ADR-035](./ADR-035-pillar-strengthening-plan.md) — stub po stub, sloj po sloj |
| **Updated** | 2026-07-08 — ADR-020 §Kad COMPLETE; ADR-031 hardening ACTIVE |

---

## Status legend

| Status | Značenje |
|--------|----------|
| **COMPLETE** | CODE + eval + verification + DEPLOY (ako guest-visible) |
| **ACTIVE** | Samo ovaj ADR sme da ima novi PR-ovi |
| **QUEUED** | Čeka redom |
| **BLOCKED** | Čeka čoveka (Supabase, Vercel, QR pilot) |

---

## Trenutno ACTIVE

| ADR | Naziv | Nedelja u toku | Status |
|-----|-------|----------------|--------|
| **[ADR-031](./ADR-031-denis-maximum-cognition-phases.md) hardening** | Waiter scenarios + iota fixtures | 21–24 | **ACTIVE** |

**Exit gate ADR-031:** 80+ waiter scenarios green · iota fixtures in eval · `pnpm eval:denis` PASS.

### ADR-020 §Kad (COMPLETE — 2026-07-08)

| # | Stub | Šta | Status |
|---|------|-----|--------|
| 020-K.1 | D-PLAY | playbook pack resolver + perceive wiring | **CODE** |
| 020-K.2 | ARCH-6 | watcher + world continuous mind hardening | **CODE** |
| 020-K.3 | D-EVAL | anticipation eval 40+ scenarija | **CODE** |

**Acceptance:** `resolvePlaybookPack` wired in `run-tde-perceive` · `run-continuous-mind-fixture` green · 46 anticipation scenarios · `table_os_pilot` preset ships full stack · `pnpm eval:denis` PASS.

### Sledeći PR-ovi (ADR-031 hardening, redom)

### ADR-019 Phase F (COMPLETE — PR-019-F.3)

| # | Stub | Šta | Status |
|---|------|-----|--------|
| 019-F.1 | T4 | transcript write samo timeline; retire ai_sessions dual-write | **CODE** |
| 019-F.2 | F5 | guest UI čita `view.transcript` only | **CODE** |
| 019-F.3 | — | tracker: Phase F → COMPLETE, ADR-020 §Kad → ACTIVE | **CODE** |

**Acceptance (2026-06-07):** `persistMessages` default false na guest path · `loadAiSessionHistory` čita timeline (`timelineToStoredMessages`) · `guest-denis-layer` / `ai-concierge-chat` bootstrap iz `view.transcript` · `replay-table-session` bez `ai_sessions.messages` · ARCH-4 SOLID (ADR-035 T4, F5) · `pnpm eval:denis` + `pnpm verify:denis` PASS.

### ADR-019 Phase E (COMPLETE — PR-019-E.3)

| # | Stub | Šta | Status |
|---|------|-----|--------|
| 019-E.1 | M2 | actor FIFO pilot + 2-phone race eval | **CODE** |
| 019-E.2 | F6/M8 | guest view SSE primary | **CODE** |
| 019-E.3 | — | tracker: Phase E → COMPLETE, Phase F → ACTIVE | **CODE** |

**Acceptance (2026-06-07):** `table-session-actor` Redis FIFO + lock · `runActorFifoEvalSuite` (FIFO order + signalId dedupe + 2-phone race) · `GET /api/denis/view/stream` SSE primary, poll fallback ≥30s · pilot rollout gate · `pnpm eval:denis` + `pnpm verify:denis` PASS.

### ADR-019 Phase D (COMPLETE — PR-019-D.3)

| # | Stub | Šta | Status |
|---|------|-----|--------|
| 019-D.1 | M5 | outbox → world signal → tell-world-order | **CODE** |
| 019-D.2 | M5 | push body === tell message === headline | **CODE** |
| 019-D.3 | — | tracker: Phase D → COMPLETE, Phase E → ACTIVE | **CODE** |

**Acceptance (2026-06-07):** order status outbox → Denis world signal → TELL → PROJECT → push · **isti tekst** (push = headline = transcript) · `runWorldTellUnificationFixture` word-match u pilot gate · ADR-019 §12 tests 1/2/4 · `pnpm eval:denis` + `pnpm verify:denis` PASS.

### ADR-034-A (COMPLETE — PR-034-A.5)

| # | Stub | Šta | Status |
|---|------|-----|--------|
| 034-A.1 | C5 | `cognition/order/applyOrderComprehend` | **CODE** |
| 034-A.2 | C5 | runtime → samo cognition/order | **CODE** |
| 034-A.3 | ARCH-2 | obriši bridge shim + gap duplikat | **CODE** |
| 034-A.4 | C6 | jedan perceive entry (`cognition/perceive`) | **CODE** |
| 034-A.5 | — | tracker: ADR-034-A → COMPLETE, Phase D → ACTIVE | **CODE** |

**Acceptance (2026-06-07):** `kernel-ordering-bridge` u runtime = 0 · `pnpm eval:denis` + `pnpm verify:denis` PASS · iota 5 scenarija PASS.

### ADR-032 (COMPLETE — PR-032.4)

| # | Stub | Šta | Status |
|---|------|-----|--------|
| 032.1 | C3 | iota timeline fixtures u eval | **CODE** |
| 032.2 | C3 | deploy main → iota + migration 00118 | **DEPLOY** |
| 032.3 | C3 | iota QR 5 scenarija (operator) | **DEPLOY** |
| 032.4 | — | tracker: ADR-032 → COMPLETE, ADR-034-A → ACTIVE | **CODE** |

---

## Redosled (ne preskači)

| # | ADR | Nedelje | Status | Napomena |
|---|-----|---------|--------|----------|
| 1 | [ADR-032](./ADR-032-waiter-obligation-spine.md) | 2–3 | **COMPLETE** | obligation + autonomous tell — iota green |
| 2 | [ADR-034-A](./ADR-034-denis-perfection-doctrine.md) §4 | 4–6 | **COMPLETE** | **Jedan mozak** — bridge obrisan, cognition/order + perceive |
| 3 | [ADR-019](./ADR-019-denis-unified-brain.md) Phase D | 3–4 | **COMPLETE** | WORLD → TELL, kitchen = chat |
| 4 | [ADR-019](./ADR-019-denis-unified-brain.md) Phase E | 3–4 | **COMPLETE** | Actor FIFO, SSE |
| 5 | [ADR-019](./ADR-019-denis-unified-brain.md) **Phase F** | 2–3 | **COMPLETE** | Transcript = timeline only (ARCH-4) |
| 6 | **[ADR-020](./ADR-020-denis-table-operating-system.md) §Kad** | 4–6 | **COMPLETE** | Playbook + ARCH-6 + 46 anticipation scenarios |
| 7 | [ADR-031](./ADR-031-denis-maximum-cognition-phases.md) **hardening** | 3–4 | **ACTIVE** | 80+ waiter scenarios, iota fixtures |
| 8 | [ADR-023](./ADR-023-denis-maximum-runtime.md) **MR-9** | 3–4 | QUEUED | Playbook pack po org |
| 9 | [ADR-023](./ADR-023-denis-maximum-runtime.md) **MR-6/E2** | 4–6 | QUEUED | Menu RAG embeddings |
| 10 | [ADR-023](./ADR-023-denis-maximum-runtime.md) **manifest+sim** | 3–4 | QUEUED | Promote gate, quality contract |
| 11 | Table OS **L3** interpretation | 4–8 | QUEUED | Goal-directed perceive (ARCH-7) |
| 12 | [ADR-029](./ADR-029-denis-integration-spine.md) **I-track** | 6–8 | QUEUED | Operator API + webhooks |
| 13 | [ADR-028](./ADR-028-viktor-denis-integration.md) | 6–10 | QUEUED | Viktor read skill |
| 14 | [ADR-013/014](./ADR-013-competitive-guest-journey.md) via signals | 8–12 | QUEUED | Journey = signals only |
| 15 | [ADR-022](./ADR-022-denis-elite-enterprise.md) ops via ADR-023 | 4–6 | QUEUED | SLA, credits, per-org eval |

**Ukupno:** ~12–18 meseci minimum. Normalno **2+ godine** do punog enterprise + Viktor.

---

## Kada označiti ADR kao COMPLETE

- [x] Svi acceptance kriterijumi iz tog ADR-a / verification checklist (ADR-019 Phase F)
- [x] `pnpm eval:denis` + `pnpm verify:denis` PASS (2026-06-07)
- [x] Redovi u [backlog](./DENIS-FULL-IMPLEMENTATION-BACKLOG.md) → CODE ili DEPLOY (Phase E, F)
- [x] Ovaj fajl: ACTIVE → sledeći u redu postaje **ACTIVE** (ADR-020 §Kad)

---

## Agent prompt (copy-paste)

```
ADR-020 §Kad mode. Pročitaj ADR-020 §3.3 + ADR-033-active-tracker.md + ADR-035 P6.
Radi SAMO §Kad. Jedan PR. eval:denis PASS. Ne commit-uj.
```

---

*Ažuriraj ovaj fajl kada ADR pređe u COMPLETE — to je jedina ručna kontrola redosleda.*
