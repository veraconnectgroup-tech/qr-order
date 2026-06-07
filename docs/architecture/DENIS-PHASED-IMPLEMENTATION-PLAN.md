# Denis — Phased Implementation Plan (remainder)

| Field | Value |
|-------|--------|
| **Purpose** | Fazni plan za **sve što nije CODE+DEPLOY** |
| **Source of truth** | [DENIS-FULL-IMPLEMENTATION-BACKLOG.md](./DENIS-FULL-IMPLEMENTATION-BACKLOG.md) |
| **Rule** | **1 PR = 1 korak** · `pnpm eval:denis` · ažuriraj backlog red |
| **Horizon** | **2+ godine** — **1 ADR = nedeljama** — [ADR-033](./ADR-033-enterprise-ai-roadmap.md) · [active tracker](./ADR-033-active-tracker.md) |
| **Agent prompts** | [ADR-033-session-prompts.md](./ADR-033-session-prompts.md) |
| **Updated** | 2026-05-29 |

---

## Šta je već gotovo (ne ulazi u plan)

| Track | Status |
|-------|--------|
| C0–C5 cognition (FSP, ACT, eval, contract, sim gate) | **CODE** |
| MR-0 → MR-8 (beliefs, TDE, manifest, RAG keyword, quality) | **CODE** |
| ADR-019 A–C, G1–G3 (FOLD, VIEW, SIGNAL, pilot gate) | **CODE** |
| M0–M27 platform (timeline, scheduler, party, venue sim…) | **CODE** |

**Problem danas:** CODE ≠ gost vidi na telefonu. **Faza 0** to rešava.

---

## Pregled faza

```
F0  Deploy pilot          → gost vidi novi mozak
F1  Pilot hardening       → I0 gate, legacy retire start
F2  Proactive brain       → "predviđa više" (Kad)
F3  Real-time guest       → SSE, actor, transcript TRUTH
F4  Enterprise brain      → memory, playbook pack, RAG v2
F5  Operator egress        → Viktor read (webhooks + OpenAPI)
F6  Commerce journey      → ADR-013/014 signals only
F7  Elite ops             → SLA, credits, per-org eval
F8  Viktor + ingress      → skill, proposals, POS in
F9  Market modules        → US / UK / EU (kad pilot region)
```

---

## Faza 0 — Ship pilot (DEPLOY)

**Cilj:** Ono što je na `main` stigne do gosta na iota pilot venue.

| Korak | Deliverable | Acceptance |
|-------|-------------|------------|
| F0.1 | Push `main` → Vercel iota | Deploy green |
| F0.2 | Admin → Settings → Denis rollout: `denis_only`, `narrateWithLlm: true` | System status: **Guest sees new brain = OK** |
| F0.3 | Telefon test: slot typo, confirm, waiting status | Ručni checklist (5 scenarija) |
| F0.4 | Zatvori **I0** u backlogu | `pnpm eval:denis` + pilot gate green on CI |

**PR:** ops-only (config) · **0 code PR** ako je deploy već green.

**Agent prompt:**
```
F0 Denis deploy. Proveri iota deploy sa main. U admin settings uključi denis_only + narrateWithLlm
na pilot lokaciji. Proveri Denis system status panel. Ručni test 5 scenarija. Ažuriraj backlog I0 → DEPLOY.
```

---

## Faza 1 — Pilot hardening

**Cilj:** Stabilan pilot pre proactive features. Zatvori PARTIAL iz Wave 2 G4.

| Korak | ID | Deliverable | Acceptance |
|-------|-----|-------------|------------|
| F1.1 | G4-a | Perceive evidence budgets (ADR-025 T3) | Token caps u `plan-evidence.ts`; test |
| F1.2 | G4-b | Retire `execute-chat-turn` shim re-exports | Grep = 0 guest hot-path legacy |
| F1.3 | G4-c | Delete `order-executor.ts` kad act submit live | Jedan submit path |
| F1.4 | — | ADR-025 verify matrix u CI | `denis-tde.test.ts` + checklist doc |

**PR:** 2–3 · zavisi od F0.

**Gate:** pilot gate + waiter parity ≥95%.

---

## Faza 2 — Proactive brain (enterprise "Kad")

**Cilj:** Denis predlaže u pravom trenutku — kroz **isti loop**, ne paralelni hack.

| Korak | ID | Deliverable | Acceptance |
|-------|-----|-------------|------------|
| F2.1 | D-PRO | `system.proactive_tick` → FOLD → beliefs → TDE → tell | **CODE** — `planProactiveTurn` in `run-denis-sense.ts` |
| F2.2 | D-NUDGE | Phase guards: no dessert u `waiting`/`rush` | **CODE** — `decide-proactive-turn-plan.ts` |
| F2.3 | D-NUDGE | pairing / dessert / slow-kitchen templates iz playbook | **PARTIAL** — template catalog; playbook pack OPEN |
| F2.4 | D-EVAL | `fixtures/anticipation/` 20+ scenarija | **CODE** — 23 scenarija + pilot gate |
| F2.5 | — | Admin: proactive profile presets | **OPEN** |

**PR:** 4–5 · **najveći product jump** posle F0.

**Agent prompt (F2.1):**
```
F2.1 D-PRO. Pročitaj DENIS-PHASED-IMPLEMENTATION-PLAN.md Faza 2.
Wire proactive_tick kroz compileBeliefs + decideTurnPlan + template/LLM tell u run-denis-sense.
Obriši dupli parallel path gde je moguće. pnpm eval:denis. Ažuriraj backlog D-PRO → CODE.
```

---

## Faza 3 — Real-time guest (Phase E + F)

**Cilj:** Gost ne poll-uje; multi-phone bez race; jedan transcript.

| Korak | ID | Deliverable | Acceptance |
|-------|-----|-------------|------------|
| F3.1 | E-a | Order status SSE primary (poll fallback samo offline) | `order-status-tracker` → `useDenisView` SSE |
| F3.2 | E-b | Table Session Actor bez Redis fallback doc | Actor enabled na pilot; test multi-device |
| F3.3 | F-a | Transcript 100% iz timeline | `fold-transcript` only; retire `ai_sessions.messages` write |
| F3.4 | F-b | View SSE push na turn complete | Guest layer refresh bez poll |
| F3.5 | D | Operator webhook stub za `denis.session.updated` | Outbox handler + test (pred F5) |

**PR:** 3–4.

---

## Faza 4 — Enterprise brain (memory + playbook + RAG)

**Cilj:** Return guest, chain playbook, bolji menu retrieval.

| Korak | ID | Deliverable | Acceptance |
|-------|-----|-------------|------------|
| F4.1 | D-MEM | Guest memory u FSP svaki LLM turn | `plan-evidence` uvek `guest.memory` kad consent |
| F4.2 | MR-9 | `organizations.ai_concierge_config.elite.playbookPackId` | Schema + merge |
| F4.3 | MR-9 | Pack loader: org pack + location overlay | `resolve-playbook-pack.ts` |
| F4.4 | D-PLAY | `playbook.examples` pointer na svaki perceive | Eval: playbook u prompt |
| F4.5 | MR-6/E2 | Menu RAG embeddings + Redis cache | ADR-022 E2; eval no unknown SKU |
| F4.6 | E3 | Org tier ceiling u manifest merge | Dva locationa isti org — shared pack |

**PR:** 4–5.

---

## Faza 5 — Operator egress (Viktor read)

**Cilj:** Partneri čitaju Denis — nikad ne blokiraju guest.

| Korak | ID | Deliverable | Acceptance |
|-------|-----|-------------|------------|
| F5.1 | I1 | Operator API routes komplet + audit | Contract tests green |
| F5.2 | I2 | `denis.session.updated`, `denis.order.phase_changed` webhooks | Outbox-only; versioned payload |
| F5.3 | I2 | Session rollup projection | Viktor metrics endpoint |
| F5.4 | I3 | OpenAPI spec + sandbox keys | `docs/openapi/denis-operator-v1.yaml` |
| F5.5 | I3 | Contract tests u CI | `operator-api.test.ts` full |

**PR:** 3–4 · **Gate:** I0/F0 complete.

---

## Faza 6 — Commerce journey (ADR-013 / ADR-014)

**Cilj:** Guest journey triggers = Denis signals only (feedback, tips, reorder, split…).

| Korak | ID | Deliverable | Acceptance |
|-------|-----|-------------|------------|
| F6.1 | CE-1 | Feedback → signal → TELL | No parallel UX writer |
| F6.2 | CE-2 | Reorder chip → signal | |
| F6.3 | CE-3 | Split bill / pay handoff signals | ADR-018 spine |
| F6.4 | CE-4→7 | Pre/post visit, loyalty hooks | Per ADR-014 map |

**PR:** 1 po CE koraku (4–7 PR).

---

## Faza 7 — Elite ops

**Cilj:** Enterprise prodaja — SLA, credits, per-org quality.

| Korak | ID | Deliverable | Acceptance |
|-------|-----|-------------|------------|
| F7.1 | E1 | Narrate model iz tier profile svaki turn | Observability `tier` tačan |
| F7.2 | E4 | Credit multiplier po tier | Billing projection |
| F7.3 | E4 | Enterprise SLA dashboard (platform) | p95, llm rate, eval pass |
| F7.4 | E5 | Per-org eval extension + sim CI on promote | Manifest promote blokira regression |

**PR:** 3–4.

---

## Faza 8 — Viktor + ingress

**Cilj:** Viktor kao prvi operator; POS signals in.

| Korak | ID | Deliverable | Acceptance |
|-------|-----|-------------|------------|
| F8.1 | V4 | Viktor Skill (read-only) | ADR-028 acceptance |
| F8.2 | I5 | `operator:propose` config/playbook | Owner approve flow |
| F8.3 | I4 | Admin Connect UI | Generic connector |
| F8.4 | I6 | Prvi ingress adapter (POS catalog sync stub) | Validated signal in |

**PR:** 4+ · posle F5.

---

## Faza 9 — Market modules

**Cilj:** Global core — region modules, ne forkovi.

| Korak | ID | Deliverable | Acceptance |
|-------|-----|-------------|------------|
| F9.1 | M-US | Tax, tips, receipt semantics | US pilot venue |
| F9.2 | M-UK | VAT display rules | |
| F9.3 | M-EU | Generic eReceipt hook | |

**PR:** 1 po regionu · **tek kad ima pilot u regionu**.

---

## Timeline (predlog)

| Faza | Trajanje | Kumulativni efekat |
|------|----------|-------------------|
| **F0** | 1 dan | Gost vidi mozak |
| **F1** | 3–5 dana | Stabilan pilot |
| **F2** | 1–2 nedelje | **"Predviđa više"** |
| **F3** | 1 nedelja | Real-time, bez polla |
| **F4** | 1–2 nedelje | Return guest + chain |
| **F5** | 1–2 nedelje | Viktor read |
| **F6** | 2–3 nedelje | Full guest journey |
| **F7–F9** | po potrebi prodaje | Enterprise + global |

---

## PR checklist (svaka faza)

- [ ] `pnpm eval:denis` green
- [ ] `pnpm type-check` + `pnpm lint`
- [ ] Backlog red → **CODE** (ili **DEPLOY** za F0)
- [ ] `denis-implementation-map.md` ako novi route/table
- [ ] System status panel ažuriran ako novi gap zatvoren

---

## Sledeći korak (tačno sada)

| # | Akcija |
|---|--------|
| 1 | **F0** — deploy iota + `denis_only` pilot |
| 2 | **F2.1** — D-PRO proactive u brain loop |
| 3 | **F2.4** — anticipation eval |

Copy-paste agent:
```
Pročitaj DENIS-PHASED-IMPLEMENTATION-PLAN.md. Uradi F0 (deploy pilot). Pa F2.1 (D-PRO).
Jedan PR po koraku. pnpm eval:denis. Ažuriraj DENIS-FULL-IMPLEMENTATION-BACKLOG.md.
```

---

## Related docs

| Doc | Role |
|-----|------|
| [DENIS-FULL-IMPLEMENTATION-BACKLOG.md](./DENIS-FULL-IMPLEMENTATION-BACKLOG.md) | Row-level status |
| [DENIS-ARCHITECTURE-START-HERE.md](./DENIS-ARCHITECTURE-START-HERE.md) | North star |
| [ADR-031](./ADR-031-denis-maximum-cognition-phases.md) | C track (done) |
| [ADR-020](./ADR-020-denis-table-operating-system.md) | Ko·Gde·Kad·Kako |
| [VIKTOR-DENIS-CURSOR-PROMPTS.md](./VIKTOR-DENIS-CURSOR-PROMPTS.md) | I/V agent prompts |

---

*End of phased plan*
