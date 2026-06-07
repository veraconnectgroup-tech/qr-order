# ADR-033 — Svi agent promptovi (copy-paste)

> **Jovica:** Otvori novi agent chat → kopiraj **jedan** blok ispod → pošalji.  
> **Red:** Po broju (AGENT-01 → AGENT-02 → …). Ne preskači osim gde piše SKIP.  
> **Pravilo:** Jedan agent = jedan PR. `pnpm eval:denis` PASS. Session report. **Ne commit-uj** osim AGENT-00.

**Pilot:** Skyline `b0000000-0000-4000-8000-000000000001` · QR `skyline-lounge/demo-table-1` · iota `https://qr-order-iota.vercel.app`

**Već CODE (ne pokreći ponovo):** 032.1–032.4 · 034-A.1–034-A.5 · 019-D.1–019-D.3 · 019-E.1–019-E.3 · 019-F.1–019-F.3

---

## Brza mapa

| Agent | PR | Ko | Zavisnost |
|-------|-----|-----|-----------|
| AGENT-00 | commit+push | operator kaže commit | — |
| AGENT-01 | 032.2 | deploy | posle 00 |
| AGENT-02 | 032.3 | QR test doc | posle 01 |
| AGENT-03 | 032.4 | tracker | posle 02 |
| AGENT-04 | 034-A.2 | kod | posle 03 |
| AGENT-05 | 034-A.3 | kod | posle 04 |
| AGENT-06 | 034-A.4 | kod | posle 05 |
| AGENT-07 | 034-A.5 | tracker | posle 06 |
| AGENT-08 | 019-D.1 | kod | posle 07 |
| AGENT-09 | 019-D.2 | kod | posle 08 |
| AGENT-10 | 019-D.3 | tracker | posle 09 |
| AGENT-11 | 019-E.1 | kod | posle 10 |
| AGENT-12 | 019-E.2 | kod | posle 11 |
| AGENT-13 | 019-E.3 | tracker | posle 12 |
| AGENT-14 | 019-F.1 | kod | posle 13 |
| AGENT-15 | 019-F.2 | kod | posle 14 |
| AGENT-16 | 019-F.3 | tracker | posle 15 |
| AGENT-17 | 031-H.1 | kod | posle 16 |
| AGENT-18 | 031-H.2 | kod | posle 16 |
| AGENT-19 | F4.1 | kod | posle 16 |
| AGENT-20 | E2.1 | kod | posle 16 |
| AGENT-21 | MR9.1 | kod | posle 16 |
| AGENT-22 | I1.1 | kod | posle 16 |
| AGENT-23 | I2.1 | kod | posle 22 |

---

## AGENT-00 — Commit sve lokalno (samo kad Jovica kaže „commituj“)

```
ADR-033 AGENT-00. Commit sve Denis promene na main.

Pre commit:
- pnpm eval:denis
- pnpm type-check
- pnpm lint

Uključi: cognition/waiter, cognition/order, timeline fixtures, ADR-032–035 docs, eval testovi.
Poruka commita: fokus na ADR-032 obligation + ADR-034-A.1 order comprehend + eval fixtures.

Posle commit: git push origin main. Session report sa SHA.
```

---

## AGENT-01 — PR-032.2 Deploy iota + migration

```
ADR-033 AGENT-01 · PR-032.2.

Pročitaj: docs/architecture/ADR-032-waiter-obligation-spine.md, ADR-033-active-tracker.md.

Zadatak:
1. Proveri da main ima obligation kod (cognition/waiter/).
2. Supabase remote: primeni migration supabase/migrations/00118_skyline_denis_locale_sr.sql (safe rollout — ADR-001-safe-rollout.md).
3. Deploy na iota (qr-order-iota.vercel.app) — Vercel production ili git push ako auto-deploy.
4. Proveri CRON denis-pilot-tick + CRON_SECRET.

Acceptance:
- iota build zelen
- migration 00118 na remote
- /api/denis/signal dostupan

pnpm eval:denis PASS. Session report. Ne commit-uj osim deploy fixeva.
```

---

## AGENT-02 — PR-032.3 iota QR test (checklist)

```
ADR-033 AGENT-02 · PR-032.3.

URL: https://qr-order-iota.vercel.app/skyline-lounge/demo-table-1

Testiraj 5 scenarija, popuni checklist u session report:

1. Poruči "može jedno pivo i beef burger" → u cart samo burger → Denis MORA pitati tip piva (ne ćuti).
2. Na recap reci "da" dok pivo fali → NE šalje kuhinji, pita za pivo.
3. Dodaj Pilsner → recap → "da" → submit radi.
4. "burger sa salatom umesto pomfrita" → Denis napomena za kuhinju / substitution gap.
5. Sačekaj 60s watcher cron → proactive waiter_gap poruka bez guest inputa.

Ako FAIL: bugfix PR unutar ADR-032 (ne novi ADR). eval:denis PASS. Ne commit-uj.
```

---

## AGENT-03 — PR-032.4 Zatvori ADR-032

```
ADR-033 AGENT-03 · PR-032.4.

Pročitaj ADR-032 exit gate u ADR-033-active-tracker.md.

Ažuriraj docs/architecture/ADR-033-active-tracker.md:
- ADR-032 → COMPLETE
- ADR-034-A → ACTIVE

Ažuriraj DENIS-FULL-IMPLEMENTATION-BACKLOG.md redove za ADR-032 → CODE/DEPLOY.

pnpm eval:denis && pnpm verify:denis PASS. Session report. Ne commit-uj.
```

---

## AGENT-04 — PR-034-A.2 Runtime → cognition/order

```
ADR-033 AGENT-04 · PR-034-A.2 · Stub C5.

Pročitaj: ADR-034-denis-perfection-doctrine.md §4, ADR-035 §P3 C5.

Zadatak:
grep -rn "kernel-ordering-bridge\|applyPostLlmOrdering" src/lib/denis/runtime/ src/components/guest/
→ sve na applyOrderComprehend iz @/lib/denis/cognition/order

Fajlovi: apply-kernel-ordering.ts, apply-structured-perception-ordering.ts, run-denis-turn.ts (ako ima).

Acceptance:
- runtime ne importuje lib/ai/ordering direktno osim kroz cognition/order
- pnpm eval:denis PASS
- pnpm type-check PASS

Jedan PR. Session report. Ne commit-uj.
```

---

## AGENT-05 — PR-034-A.3 Obriši bridge shim

```
ADR-033 AGENT-05 · PR-034-A.3 · ARCH-2.

Pročitaj ADR-034 §3 ARCH-1/2.

Zadatak:
1. Obriši ili prazan shim src/lib/ai/ordering/kernel-ordering-bridge.ts
2. kernel-ordering-bridge.test.ts → prebaci na src/__tests__/order-comprehend.test.ts
3. grep gap submit block u lib/ai/ordering — mora biti 0 (obligation samo cognition/waiter)
4. Ukloni stale importe

Acceptance:
grep -rn "kernel-ordering-bridge" src/ → samo docs ili 0
pnpm eval:denis PASS

Jedan PR. Ne commit-uj.
```

---

## AGENT-06 — PR-034-A.4 Jedan perceive entry (Stub C6)

```
ADR-033 AGENT-06 · PR-034-A.4 · Stub C6.

Pročitaj ADR-034 ARCH-3, ADR-035 P3 C6.

Zadatak:
- Kreiraj canonical src/lib/denis/cognition/perceive/ (ili proširi postojeći)
- perceive-guest-chat-turn.ts → thin re-export ili merge
- execute-chat-turn.ts → jedan export
- architecture compliance PASS (src/lib/denis/architecture/compliance.ts)

Acceptance:
grep -rn "perceiveGuestChatTurn\|executeChatTurn" src/lib/denis/runtime/ → jedan modul
pnpm eval:denis && pnpm verify:denis PASS

Jedan PR. Ne commit-uj.
```

---

## AGENT-07 — PR-034-A.5 Zatvori 034-A

```
ADR-033 AGENT-07 · PR-034-A.5.

Acceptance iz ADR-034 §4:
grep kernel-ordering-bridge u runtime = 0
grep perceive duplikat = 0
pnpm eval:denis && pnpm verify:denis PASS
iota 5 scenarija još jednom

Ažuriraj tracker: ADR-034-A → COMPLETE, ADR-019 Phase D → ACTIVE.
Session report. Ne commit-uj.
```

---

## AGENT-08 — PR-019-D.1 WORLD signal handler

```
ADR-033 AGENT-08 · PR-019-D.1 · Stub M5.

Pročitaj ADR-019 Phase D, src/lib/denis/loop/tell-world-order.ts, outbox handlers commerce-denis-world.

Zadatak:
Outbox commerce.order_status → enqueue denis world signal → run-denis-world-signal → tell-world-order → PROJECT.

Acceptance:
runWorldTellUnificationFixture PASS
pnpm eval:denis PASS

Jedan PR. Ne commit-uj.
```

---

## AGENT-09 — PR-019-D.2 Push = chat text

```
ADR-033 AGENT-09 · PR-019-D.2 · Stub M5.

Zadatak:
Kad order ready: push notification body === tell.committed message === view headline.

Dodaj eval fixture word-match (pilot gate).

Acceptance:
world tell unification + novi eval PASS
pnpm eval:denis PASS

Jedan PR. Ne commit-uj.
```

---

## AGENT-10 — PR-019-D.3 Zatvori Phase D

```
ADR-033 AGENT-10 · PR-019-D.3.

Tracker: Phase D → COMPLETE, Phase E → ACTIVE.
Backlog ažuriraj. Session report. Ne commit-uj.
```

---

## AGENT-11 — PR-019-E.1 Actor FIFO pilot

```
ADR-033 AGENT-11 · PR-019-E.1 · Stub M2.

Pročitaj ADR-019 Phase E, table session actor, Redis lock.

Zadatak:
- Enable actor na pilot lokaciji (rollout config)
- Eval: 2-phone race fixture
- FIFO + signalId dedupe test

pnpm eval:denis PASS. Jedan PR. Ne commit-uj.
```

---

## AGENT-12 — PR-019-E.2 View SSE

```
ADR-033 AGENT-12 · PR-019-E.2 · Stub F6/M8.

Pročitaj ADR-035 P4 M8, P5 F6.

Zadatak:
- guest-denis-layer: SSE primary za view version
- poll fallback ≥30s
- API route za view SSE ako fali

pnpm eval:denis PASS. Jedan PR. Ne commit-uj.
```

---

## AGENT-13 — PR-019-E.3 Zatvori Phase E

```
ADR-033 AGENT-13 · PR-019-E.3.

Tracker: Phase E → COMPLETE, Phase F → ACTIVE. Session report. Ne commit-uj.
```

---

## AGENT-14 — PR-019-F.1 Transcript TRUTH write

```
ADR-033 AGENT-14 · PR-019-F.1 · Stub T4.

Pročitaj ADR-019 Phase F, ADR-034 ARCH-4.

Zadatak:
grep -rn "ai_sessions" src/ guest path messages write → ukloni
Transcript write samo denis_timeline (tell.committed, perception.ingested)
foldTranscriptFromTimeline = jedini read za guest chat bootstrap

Acceptance:
grep ai_sessions.messages write u guest API = 0
pnpm eval:denis PASS

Jedan PR. Ne commit-uj.
```

---

## AGENT-15 — PR-019-F.2 Guest UI view.transcript only

```
ADR-033 AGENT-15 · PR-019-F.2 · Stub F5.

Pročitaj ADR-035 P5 F4/F5.

Zadatak:
ai-concierge-chat.tsx / guest-denis-layer: čitaj view.transcript, ne lokalni message merge.
Ukloni parallel fetch koji duplira stanje.

pnpm eval:denis PASS. Jedan PR. Ne commit-uj.
```

---

## AGENT-16 — PR-019-F.3 Zatvori Phase F

```
ADR-033 AGENT-16 · PR-019-F.3.

Tracker: Phase F → COMPLETE, ADR-020 §Kad → ACTIVE.
ARCH-4 SOLID u ADR-035 T4. Session report. Ne commit-uj.
```

---

## AGENT-17 — PR-031-H.1 Waiter 80+ scenarija

```
ADR-033 AGENT-17 · PR-031-H.1 · Stub C3.

Pročitaj src/lib/denis/eval/fixtures/waiter-parity/scenarios.ts (trenutno ~45).

Zadatak:
Proširi WAITER_PARITY_SCENARIOS na 80+.
Pokrij: gap, substitution, multi-turn, DE/EN/SR, waiting, rush.
Pass rate ≥95% u runWaiterParitySuite.

pnpm eval:denis PASS. Jedan PR. Ne commit-uj.
```

---

## AGENT-18 — PR-031-H.2 Produkcijski timeline fixtures

```
ADR-033 AGENT-18 · PR-031-H.2 · Stub T7.

Pročitaj src/lib/denis/eval/fixtures/timeline/, run-timeline-obligation-fixture.ts.

Zadatak:
Dodaj 10+ anonymized timeline JSON scenarija (iota-style).
Replay suite PASS u pilot gate.

pnpm eval:denis PASS. Jedan PR. Ne commit-uj.
```

---

## AGENT-19 — PR-F4.1 View-only guest UI

```
ADR-033 AGENT-19 · PR-F4.1 · Stub F4.

Pročitaj ADR-035 P5 F4, menu-view.tsx, guest-denis-layer.tsx.

Zadatak:
Ukloni business logic merge cart+scene+chat u React.
Jedan izvor: GET /api/denis/view + signal write.

grep manualCartSnapshot merge u components/guest → 0 business odluka

pnpm eval:denis PASS. Jedan PR. Ne commit-uj.
```

---

## AGENT-20 — PR-E2.1 Menu RAG embeddings

```
ADR-033 AGENT-20 · PR-E2.1 · Stub C10.

Pročitaj ADR-023 MR-6/E2.

Zadatak:
Keyword catalog search → embeddings (Vercel AI Gateway) + Redis cache.
Eval fixture: "nešto lagano" → relevantan menu item.

pnpm eval:denis PASS. Jedan PR. Ne commit-uj.
```

---

## AGENT-21 — PR-MR9.1 Playbook pack

```
ADR-033 AGENT-21 · PR-MR9.1 · Stub C11/E6.

Pročitaj ADR-023 MR-9.

Zadatak:
playbookPackId u venue manifest → loader u perceive/FSP.
Eval: Skyline vs generic chain ton različit.

pnpm eval:denis PASS. Jedan PR. Ne commit-uj.
```

---

## AGENT-22 — PR-I1.1 Operator API read

```
ADR-033 AGENT-22 · PR-I1.1 · Stub I1.

Pročitaj ADR-029 integration spine.

Zadatak:
Operator API: session metrics, waiter.gap_rate, beliefs summary.
Read-only + audit log. Contract test.

pnpm test:run PASS. Jedan PR. Ne commit-uj.
```

---

## AGENT-23 — PR-I2.1 Webhooks denis.*

```
ADR-033 AGENT-23 · PR-I2.1 · Stub I2.

Pročitaj ADR-029.

Zadatak:
Outbox denis.session.updated webhook, versioned payload, OpenAPI snippet.
CI contract test.

Jedan PR. Ne commit-uj.
```

---

## AGENT-24 — ADR-020 Continuous mind (posle F)

```
ADR-033 AGENT-24 · ARCH-6.

Pročitaj ADR-020 §Kad, ADR-035 P4 M9.

Zadatak:
Watcher + world + turn → jedan obligation state merge.
Continuous mind eval fixture.

pnpm eval:denis PASS. Jedan PR. Ne commit-uj.
```

---

## AGENT-25 — Table OS L3 InterpretationTask

```
ADR-033 AGENT-25 · ARCH-7 · Stub C12.

Pročitaj ADR-020 Table OS L3, decide-turn-plan.ts.

Zadatak:
topGoal → schema-driven perceive (InterpretationTask).
Eval: goal-directed ne regex-laže plan.

pnpm eval:denis PASS. Jedan PR. Ne commit-uj.
```

---

## AGENT-26 — Manifest promote gate

```
ADR-033 AGENT-26.

Pročitaj ADR-023 manifest+sim, run-manifest-promote-gate.ts.

Zadatak:
CI blokira manifest promote ako timeline sim regression.
Quality contract u pilot gate.

pnpm eval:denis PASS. Jedan PR. Ne commit-uj.
```

---

## Session report template (svaki agent)

```markdown
## AGENT-XX session

- **PR:** 
- **Stub:** 
- **eval:denis:** PASS / FAIL
- **type-check:** PASS / FAIL
- **Šta urađeno:** 1 rečenica
- **Bloker:** none / opis
- **Sledeći agent:** AGENT-YY
- **Commit:** ne / operator treba
- **ADR-036:** sekcija dopunjena da / ne
```

---

## ADR-036 — isti prompt za SVAKOG agenta (posle PR-a)

```
Posle svog PR-a otvori docs/architecture/ADR-036-agent-architecture-proposals.md.
U sekciju ## AGENT-XX (tvoj broj) upiši:

1. Šta si radio (1 rečenica)
2. Šta je danas slabo u tom delu arhitekture
3. Kako bi izgledao MAKSIMUM za taj deo (stubovi, fajlovi, pravila)
4. Šta obrisati / spojiti (bez patch na patch)
5. Kako testirati da je gotovo (eval / pilot)
6. Koliko nedelja realno

Piši samo u svoju sekciju. Ne menjaj tuđe. Ne commit-uj.
```

---

## SKIP (već urađeno)

| PR | Razlog |
|----|--------|
| 032.1 | timeline obligation fixtures CODE |
| 034-A.1 | applyOrderComprehend CODE |
| 034-A.2 | runtime → cognition/order CODE |
| 034-A.3 | bridge shim obrisan CODE |
| 034-A.4 | cognition/perceive canonical CODE |
| 034-A.5 | tracker 034-A COMPLETE CODE |

---

## AGENT-PILOT-P0 — iota pilot 0/5 → 5/5 (v2)

**North star:** `pnpm pilot:iota` → `=== 5/5 PASS ===` na `https://qr-order-iota.vercel.app`  
**Pilot:** Skyline `b0000000-0000-4000-8000-000000000001` · QR `demo-table-1` · harness `scripts/iota-obligation-pilot.ts`

**Jedna linija (Jovica):**
```
ADR-033 AGENT-PILOT-P0 v2. Kopiraj pun blok ispod iz ovog fajla. Ne commit-uj.
```

```
ADR-033 AGENT-PILOT-P0 v2 — iota obligation pilot 5/5.

## 0) DIAGNOZA PRVO (pre bilo kakvog koda)

Pokreni i upiši u session report:

  pnpm eval:denis
  pnpm test:run src/__tests__/waiter-obligation.test.ts
  pnpm pilot:iota    # samo ako imaš Supabase CLI link — inače preskoči

Proveri da li već postoji:
  grep -n "lineSatisfiesDrinkGap\|generic pivo in cart" src/lib/denis/cognition/waiter/assess-waiter-obligation.ts src/__tests__/waiter-obligation.test.ts

ODLUKA:
  A) waiter-obligation test PASS + pilot FAIL  → kod OK lokalno, fokus: preostali runtime path + DEPLOY iota
  B) waiter-obligation test FAIL               → obligation contract još nije zatvoren
  C) pilot scenario 1 elapsedMs > 15000        → TDE/LLM SLA, ne view bug

Ne radi dupli fix ako test "generic pivo in cart keeps drink_unspecified gap" već PASS.

## 1) Tačan FAIL sa iote (referenca)

| ID | Pilot assert (iz scripts/iota-obligation-pilot.ts) | Poslednji live output |
|----|-----------------------------------------------------|------------------------|
| 1_gap_drink_clarify | ok + <15s + !submit + msg(pivo\|pilsner\|weizen) + (viewGap\|transcript pivo) | 24s, viewGap=false, msg OK |
| 2_gap_blocks_confirm | ok + <15s + !submit + viewGap=true | missing_submit_context, viewGap=false |
| 3_gap_cleared_submit | pilsner ok + confirm submit + !viewGap + <15s | submit=false |
| 4_substitution_gap | !submit + (msg zamena/salat/kuhinj\|viewGap) | samo recap |
| 5_autonomous_waiter_gap | cron ok + (nudges≥1\|viewGap) + gapTell | nudges=0 |

## 2) Root cause (hipoteza — potvrdi grep-om, ne nagađaj)

Eval/fixtures: cart = samo burger → gap ostaje.
Live turn: comprehend/backfill može dodati generičko "Pivo" u draft.
Ako `cartHasDrink()` tretira to kao resolved → FOLD briše gap → viewGap=false → 2–5 padaju.

Lanac koji MORA biti konzistentan na SVIM putevima (fold, turn, watcher):

  mergeTableSessionObligation → obligation.gaps[0]
  → buildViewLayers (id: waiter-gap-*)  [samo ako meta.phase === "ordering"]
  → compileBeliefs (waiterGapCount, canConfirm)
  → decideTurnPlan waiterGapsBlockConfirm na CONFIRM
  → run-session-watcher proactive waiter_gap

## 3) Fix redom (jedan PR, minimalan diff)

### FIX-1 — Jedan izvor istine: "da li je piće razrešeno"

Fajl: src/lib/denis/cognition/waiter/assess-waiter-obligation.ts
- `lineSatisfiesDrinkGap` / `cartHasDrink`: generičko pivo|beer|bier NE zatvara drink_unspecified
- Eksportuj helper ako treba drugim modulima

Fajl: src/lib/ai/ordering/order-message-backfill.ts
- `draftHasDrinkInCart` mora koristiti ISTU logiku (ne duplirati regex)
- Generičko piće ne sme biti backfill-ovano u draft dok needsDrinkClarify (proveri backfillDraftFromOrderMessage)

Test (obavezno ako ne postoji):
  src/__tests__/waiter-obligation.test.ts
  "generic pivo in cart keeps drink_unspecified gap (eval/live parity)"
  → gaps=1, buildViewLayers ima waiter-gap banner, CONFIRM → waiter.gap_blocks_confirm

### FIX-2 — CONFIRM ne sme ići u act submit

Fajl: src/lib/denis/cognition/tde/decide-turn-plan.ts → waiterGapsBlockConfirm
Fajl: src/lib/denis/runtime/run-denis-turn.ts → beliefs pre decideTurnPlan
- structuredIntent CONFIRM + gapCount>0 → template_tell, NE order.submit
- Greška "missing_submit_context" = submit se pokrenuo pre gap blocka → bug

### FIX-3 — Template SLA <15s (scenariji 1–3)

Fajl: src/lib/denis/cognition/tde/decide-turn-plan.ts
- Order line sa drink_unspecified → template_tell (requiresLlm: false), ne transactional_perceive
- Proveri decideTurnPlan za "moze jedno pivo i beef burger" sa gap beliefs

Test: waiter-obligation "template clarify plan when beliefs carry open drink gap"

### FIX-4 — Substitution (scenarij 4)

Input: "beef burger sa salatom umesto pomfrita"
Fajl: assess-waiter-obligation.ts + guest-substitution parse
- gap kind substitution_note ILI msg sa zamena/salat/kuhinj/napomen

### FIX-5 — Cron watcher (scenarij 5)

Fajl: src/lib/denis/runtime/run-session-watcher.ts
- mergeTableSessionObligation(source: "watcher") mora videti isti gap kao fold
- emit-proactive-nudge → guestNudges++

## 4) Gate (svi moraju PASS)

  pnpm eval:denis
  pnpm test:run src/__tests__/waiter-obligation.test.ts
  pnpm type-check
  pnpm lint

Ne menjaj PASS kriterijume u scripts/iota-obligation-pilot.ts.

## 5) Van scope-a (NE DIRAJ)

- ADR-020 §Kad / mental-model / guest-recovery refaktori
- Pilot harness relaksacija SLA
- module-level Map/Set
- commit bez Jovicine reči

## 6) Session report (format)

| Sekcija | Sadržaj |
|---------|---------|
| Diagnoza | A/B/C odluka iz koraka 0 |
| Root cause | 1 rečenica, potvrđeno testom |
| Fajlovi | lista |
| eval | N/N |
| Pilot prognoza | tabela 1–5: PASS/FAIL + zašto |
| Deploy | DA — iota mora dobiti ovaj commit pre pilot retesta |
| Commit msg | predlog, ne izvršavaj |

## 7) Acceptance

PR gotov kada:
- waiter-obligation parity test PASS
- eval:denis PASS
- session report kaže "5/5 PASS posle iota deploy" sa jasnim razlogom po scenariju
```

---

*Jovica: daj agentima AGENT-00 kad hoćeš commit, pa AGENT-01 redom.*
