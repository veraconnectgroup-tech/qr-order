# ADR-033 — Session Prompts (autonomous implement agent)

> **Pravilo #1:** Radi **samo ACTIVE ADR** iz [ADR-033-active-tracker.md](./ADR-033-active-tracker.md).  
> **Pravilo #2:** Jedan ADR = **nedeljama**. Jedna sesija = **jedan PR** unutar tog ADR-a.  
> **Pravilo #3:** Ne prelazi na sledeći ADR dok trenutni nije **COMPLETE**.

---

## Operator checklist (svaka sesija)

- [ ] Pročitaj **[ADR-033-active-tracker.md](./ADR-033-active-tracker.md)** — koji je ACTIVE?
- [ ] Pročitaj **taj ADR** + njegov verification checklist (ako postoji)
- [ ] Pročitaj [DENIS-FULL-IMPLEMENTATION-BACKLOG.md](./DENIS-FULL-IMPLEMENTATION-BACKLOG.md) — redovi za taj ADR
- [ ] **Jedan PR** unutar ACTIVE ADR-a
- [ ] `pnpm test:run` · `pnpm type-check` · `pnpm lint` · `pnpm eval:denis`
- [ ] Session report
- [ ] **Ne commit-uj** osim ako operator kaže

---

## 🟢 Default prompt (uvek ovo u novi chat)

```
ADR-033 ACTIVE ADR mode.

1. Pročitaj docs/architecture/ADR-033-active-tracker.md — koji ADR je ACTIVE?
2. Pročitaj taj ADR dokument u potpunosti.
3. Uradi JEDAN mali PR unutar tog ADR-a (ne prelazi na sledeći ADR).
4. pnpm eval:denis mora biti PASS.
5. Ažuriraj backlog redove za taj ADR.
6. Session report. Ne commit-uj.
```

---

## ACTIVE ADR: ADR-020 §Kad (continuous mind) — trenutno

**Trajanje:** 4–6 nedelja · **Doc:** [ADR-020](./ADR-020-denis-table-operating-system.md) §3.3 · **Checklist:** [ADR-035](./ADR-035-pillar-strengthening-plan.md) P6

### Koraci unutar §Kad (jedan PR po sesiji)

| Korak | Prompt |
|-------|--------|
| **020-K.1 Playbook** | `ADR-020 §Kad korak K.1. playbookPackId resolver + perceive wiring. eval:denis. Ne prelazi §Kad.` |
| **020-K.2 Continuous** | `ADR-020 §Kad korak K.2. watcher + world continuous mind hardening. eval PASS. Ne prelazi §Kad.` |
| **020-K.3 Anticipation** | `ADR-020 §Kad korak K.3. anticipation eval 40+ scenarija. eval PASS. Ne prelazi §Kad.` |

**Exit gate:** proactive kroz isti brain · playbook u templates · anticipation eval proširen · autonomous tell · `pnpm eval:denis` PASS.

---

## COMPLETE: ADR-019 Phase F (TRUTH)

**Trajanje:** 2–3 nedelje · **Doc:** [ADR-019](./ADR-019-denis-unified-brain.md) §Phase F

Koraci 019-F.1–019-F.3 **CODE** (2026-06-07). Transcript 100% iz timeline · `persistMessages` default false · guest UI `view.transcript` only · ARCH-4 SOLID.

---

## COMPLETE: ADR-019 Phase E (ACTOR + SSE)

**Trajanje:** 3–4 nedelje · **Doc:** [ADR-019](./ADR-019-denis-unified-brain.md) §Phase E

Koraci 019-E.1–019-E.3 **CODE** (2026-06-07). Actor FIFO + signalId dedupe + SSE view stream + 2-phone race eval green.

---

## COMPLETE: ADR-019 Phase D (WORLD)

**Trajanje:** 3–4 nedelje · **Doc:** [ADR-019](./ADR-019-denis-unified-brain.md) §Phase D

Koraci 019-D.1–019-D.3 **CODE** (2026-06-07). Outbox → world signal → TELL → PROJECT → push · isti tekst (push = headline = transcript) · `runWorldTellUnificationFixture` word-match u pilot gate.

---

## COMPLETE: ADR-034-A (Architecture Unification)

**Trajanje:** 4–6 nedelje · **Doc:** [ADR-034 §4](./ADR-034-denis-perfection-doctrine.md)

Koraci 034-A.1–034-A.5 **CODE** (2026-06-07). Bridge obrisan, `cognition/order` + `cognition/perceive` canonical.

---

## COMPLETE: ADR-032 (Waiter Obligation)

**Trajanje:** 2–3 nedelje · **Doc:** [ADR-032](./ADR-032-waiter-obligation-spine.md)

Koraci 032.1–032.4 **CODE/DEPLOY** (2026-06-07). Obligation + autonomous tell — iota green.

---

## QUEUED: ADR-023 tracks (jedan track = više nedelja)

| Track | Nedelje | Prompt stub |
|-------|---------|-------------|
| MR-9 playbook | 3–4 | `ADR-023 MR-9 ACTIVE. playbookPackId + loader + perceive. Jedan PR.` |
| MR-6/E2 RAG | 4–6 | `ADR-023 E2 ACTIVE. Embeddings + Redis + eval no unknown SKU. Jedan PR.` |
| Manifest+sim | 3–4 | `ADR-023 manifest ACTIVE. promote gate + sim replay. Jedan PR.` |

---

## QUEUED: ADR-029 + ADR-028 (mesecima, ne nedeljama)

```
ADR-029 I-track ACTIVE. Pročitaj ADR-029-session-prompts.md.
Jedan I-korak po sesiji. Posle cognition ADR-i COMPLETE. Ne commit-uj.
```

---

## 🔵 Review agent

```
ADR-033 review. Pročitaj active-tracker — koji ADR je ACTIVE?
Proveri da poslednji PR ispunjava exit gate tog ADR-a.
eval:denis. Session report. Bez koda.
```

---

## 🔴 iota bug (ostaje u ACTIVE ADR)

```
ADR-033 bugfix unutar ACTIVE ADR [032]. iota: [opis].
Fixture + fix + eval PASS. Ne počinji novi ADR. Ne commit-uj osim ako operator kaže.
```

---

## ADR-035 — stub po stub (kad ACTIVE ADR ima više stubova)

**Doc:** [ADR-035-pillar-strengthening-plan.md](./ADR-035-pillar-strengthening-plan.md)

```
ADR-035 pillar [STUB_ID]. Pročitaj ADR-035 §[P1–P7].
Ojačaj stub [STUB_ID] iz PARTIAL/STUB u SOLID.
Jedan PR. Ne gradi nov most. eval:denis PASS. Ne commit-uj.
```

**Primeri:**
- `ADR-035 pillar C5` — order comprehend, ADR-034-A korak 034-A.1
- `ADR-035 pillar T4` — transcript TRUTH, Phase F
- `ADR-035 pillar M5` — WORLD ingress, ADR-019-D

---

## Session report template

```markdown
## ADR-033 session

- **ACTIVE ADR:** ADR-032 (ili koji je u trackeru)
- **Korak unutar ADR-a:** 032.2
- **PR scope:** jedna rečenica
- **eval:denis:** PASS / FAIL
- **Blizu ADR COMPLETE?** da / ne — šta fali
- **Next session:** isti ADR, korak 032.3
- **Human:** none | QR test | commit | supabase
```

---

*Ne radi „ceo enterprise“ u jednom promptu. Radi ACTIVE ADR nedeljama.*
