# Denis — predlozi agenata (jedan dokument)

Svaki agent dopunjava **samo svoju sekciju** posle PR-a.

---

## AGENT-00

**Stanje (2026-06-07):** Indeks agenata — svaki AGENT-01…26 dopunjava svoju sekciju posle PR-a; ACTIVE tracker = ADR-020 §Kad.

---

## AGENT-01

**1. Šta sam radio**  
PR-032.2: proverio obligation kod (`cognition/waiter/`), potvrdio migration `00118` na remote, iota deploy (`d75b058`) i CRON `denis-pilot-tick` + `CRON_SECRET`.

**2. Šta je danas slabo**  
Obligation postoji u dva sloja — legacy `kernel-ordering-bridge` / `order-message-backfill` na `main` (deployed), puna spina u uncommitted `cognition/waiter/` — gap detekcija, `canConfirm`, autonomous `waiter_gap` nisu jedan izvor istine; deploy i eval mogu biti zeleni na različitim granama istog ADR-a.

**3. MAKSIMUM (stubovi, fajlovi, pravila)**  
- Jedan modul: `src/lib/denis/cognition/waiter/` — `assess` → `beliefs` → `decide` → `enforceTell` → `detectAutonomousTell`.  
- Pravilo: **nijedan gap/substitution/drink-clarify van waiter/**; bridge samo ACL poziv, bez gap logike.  
- FOLD uvek piše `state.conversation.obligation`; PROJECT layer `waiter.gap` kad `gaps.length > 0`.  
- Autonomous writer: `waiter_gap` prioritet u `plan-proactive-turn` pre commerce proactive; dedupe `waiter_gap:{primaryGap}`.  
- Deploy gate u ADR trackeru: `main` SHA = iota SHA = eval working tree pre oznake DEPLOY.

**4. Šta obrisati / spojiti**  
- Obrisati gap/drink-clarify iz `kernel-ordering-bridge.ts` i `order-message-backfill.ts` kad waiter preuzme (ADR-034-A.3).  
- Spojiti `run-denis-turn` + `fold-table-session-state` dupli `assessWaiterObligation` u jedan fold output koji runtime samo čita.  
- Ne patchovati recap u tri mesta — jedan `enforceWaiterTell` na ACT/TELL i jedan `detectWaiterObligationTell` na cron.

**5. Kako testirati da je gotovo**  
- `pnpm eval:denis` — `wp_gap_blocks_confirm_drink` + `iota timeline obligation replay` (7 scenarija).  
- `waiter-obligation.test.ts` + `waiter-autonomous-tell.test.ts` PASS na `main` (ne samo lokalno).  
- iota pilot: burger+pivo → Denis pita tip piva; „da“ na recap sa rupom → nema submit.  
- CRON: `GET /api/cron/denis-pilot-tick` 200 sa `CRON_SECRET`; `sessionWatcher.scanned > 0`.

**6. Koliko nedelja realno**  
**2 nedelje** za COMPLETE ADR-032 (commit spine + iota 5 QR + tracker), ako je sledeći korak samo deploy bez ARCH-2; **+1 nedelja** za uklanjanje bridge duplikata (ADR-034-A).

---

## AGENT-02

**1. Šta sam radio**  
PR-032.3: iota QR checklist — 5 scenarija waiter obligation na `skyline-lounge/demo-table-1` (pivo+burger gap, confirm block, Pilsner submit, substitution, 60s cron `waiter_gap`).

**2. Šta je danas slabo**  
Eval/timeline replay je green, ali **live pilot nije verifikovan** — `POST /api/denis/signal` na iota vraća `signal_timeout` (~55s actor wait); postojeća sesija nije u gap preduvetu (`"da"` ide u `comprehend`, ne `waiter.gap_blocks_confirm`); cron tick radi ali `guestNudges: 0` bez gap stanja; nema CI gate-a koji sprečava „zeleno u fixture-u, crveno na stolu“.

**3. MAKSIMUM (stubovi, fajlovi, pravila)**  
- **Pilot harness:** `scripts/iota-obligation-pilot.ts` — nova sesija, 5 koraka, assert na `view`/response (`submitOrder`, `planReason`, Denis text); pokreće se u session reportu posle deploy-a.  
- **Pravilo:** `eval:denis` PASS ≠ ADR COMPLETE dok pilot harness ili ručni QR checklist nije PASS na **čistoj** sesiji.  
- **Actor:** `HTTP_WAIT_MS` + lock/LLM budžet dokumentovan; fallback `executeDenisSignalCore` direktno kad queue ne drain-uje u SLA (<15s za template gap).  
- **Obligation na stolu = obligation u eval-u:** isti `assessWaiterObligation` output u FOLD, thinking preview i full turn — bez divergencije `comprehend` vs `gap_blocks_confirm`.  
- **Cron:** scenario 5 = gap ostaje otvoren → `emitProactiveNudge` → `waiter_gap` pre welcome; dedupe test u `waiter-autonomous-tell.test.ts` + pilot assert na transcript posle 60s.

**4. Šta obrisati / spojiti**  
- Ne oslanjati se na prljava pilot sesija — pilot harness uvek `findOrCreate` / fresh session, ne reuse `demo-table-1` bez reset-a.  
- Spojiti **live verification** u jedan put: timeline fixtures + waiter parity + iota pilot script (ne tri odvojena checklist-a u različitim ADR fajlovima).  
- Kad waiter spine preuzme gap (034-A): obrisati parallel confirm path u bridge-u — inače pilot #2 prolazi u eval-u a failuje na iota zbog starog submit-a.  
- `thinking` preview i `signal` full turn moraju deliti isti `decideTurnPlan` ulaz (jedan `buildDenisTurnContext`), ne dva skrivena konteksta.

**5. Kako testirati da je gotovo**  
- `pnpm eval:denis` — `tl_iota_*` (5 relevantnih) + `wp_gap_blocks_confirm_drink` + `wp_gap_cleared_after_pilsner` + `wp_gap_substitution_note` + `waiter-autonomous-tell`.  
- iota pilot (čista sesija): 1→5 scenarija iz PR-032.3; svaki assert: Denis govori, nema submit sa rupom, #3 submit radi, #5 autonomous poruka bez guest inputa.  
- `GET /api/cron/denis-session-watcher` sa gap sesijom → `guestNudges >= 1`, `kind: waiter_gap`.  
- `signal` ne sme vraćati `signal_timeout` na template gap turn-u (<15s).

**6. Koliko nedelja realno**  
**3–5 dana** za zatvaranje live pilota (fresh session + signal SLA fix); **+1 nedelja** za pilot harness u repo i tracker gate; **+1 nedelja** (ADR-034-A) da live i eval budu isti mozak bez bridge duplikata — ukupno **~2 nedelje** do pouzdanog COMPLETE ADR-032 sa automatskim pilot gate-om.

---

## AGENT-03

**PR:** ADR-033 AGENT-03 · PR-032.4 (zatvaranje ADR-032 Waiter Obligation Spine)

1. **Šta sam radio:** Zatvorio ADR-032 — ažurirao active-tracker (032 → COMPLETE, 034-A → ACTIVE), backlog C7 → DEPLOY, potvrdio `pnpm eval:denis` + `pnpm verify:denis` PASS.

2. **Šta je danas slabo:** Obligation živi u `cognition/waiter`, ali `assess-waiter-obligation.ts` i dalje vuče `lib/ai/ordering/order-message-backfill` za parsiranje transcripta — dual-path pre ARCH-2. Gap detekcija je heuristička (regex + `menuSection === "drinks"`), ne venue-manifest playbook. Autonomous tell (`detect-waiter-obligation-tell`) radi, ali nema WORLD signala (kitchen ready, delay) u istom writeru. Eval pokriva ~48 waiter-parity + 7 iota timeline scenarija — daleko od 80+ iz ADR-031 hardening-a.

3. **MAKSIMUM za Waiter Obligation:**
   - **Stubovi:** `cognition/waiter/assess-waiter-obligation.ts` (jedini izvor istine) · `merge-table-session-obligation.ts` (FOLD persist) · `enforce-waiter-tell.ts` (guest turn) · `detect-waiter-obligation-tell.ts` (autonomous) · `obligation-to-beliefs.ts` (MIND compile) · `waiter-obligation-types.ts` (contract)
   - **Fajlovi:** fold → beliefs → DECIDE (`waiter.gap_blocks_confirm`) → ACT gate (`!canConfirm → no submit`) → TELL templates (`waiter.gap_clarify.*`) → VIEW inline layer · proactive `waiter_gap` priority iznad commerce
   - **Pravila:** `canConfirm === false` → kitchen nikad ne vidi partial intent · gap persist iz transcript order-line, ne samo trenutna poruka · 0-token clarify pre LLM · dedupe `waiter_gap:{primaryGap}` · obligation bypass `commerce.active` block

4. **Šta obrisati / spojiti:** U ARCH-2 (034-A.3): ukloniti svaki gap/confirm guard iz `kernel-ordering-bridge` i `apply-kernel-ordering` — samo `cognition/waiter` + beliefs. Spojiti `order-message-backfill` parsiranje u `cognition/order` ili `platform/transcript-order-line.ts` — waiter ne sme importovati `lib/ai/ordering/*`. Jedan perceive entry (034-A.4) umesto shim + legacy perceive. Ne patchovati bridge — obrisati duplikat.

5. **Kako testirati da je gotovo:**
   - `pnpm eval:denis` — `wp_gap_blocks_confirm_drink`, waiter-parity 60+ scenarija
   - `pnpm verify:denis` — nema `lib/ai/ordering` u `cognition/waiter/*`
   - `src/__tests__/waiter-obligation.test.ts` + `waiter-autonomous-tell.test.ts` + `run-timeline-obligation-fixture.ts`
   - iota pilot: burger+pivo gap, zamena, confirm block, autonomous tell bez guest turna
   - `grep -rn "canConfirm\|waiterObligation" src/lib/ai/ordering` → 0 rezultata posle ARCH-2

6. **Koliko nedelja realno:** ADR-032 spine = **2–3 nedelje** (DONE). Do MAKSIMUM-a (playbook gaps, WORLD writer, 80+ eval, ARCH-2 cleanup) = još **3–4 nedelje** unutar ADR-034-A + ADR-031 hardening — ukupno **~5–6 nedelja** od spine do „savršen konobar“ merljivog na P1/P3 iz ADR-034.

---

## AGENT-04

**PR:** ADR-033 AGENT-04 · PR-034-A.2 · Stub C5 (Order comprehend runtime wire)

1. **Šta sam radio:** Prebacio guest hot path sa `applyPostLlmOrdering` / `kernel-ordering-bridge` na `applyOrderComprehend` iz `cognition/order` u `apply-structured-perception-ordering.ts` i `apply-kernel-ordering.ts`, bridge ostao thin shim bez gap logike.

2. **Šta je danas slabo:** Dva mozga i dalje dele ordering — `cognition/order` radi post-LLM comprehend, ali runtime direktno vuče `lib/ai/ordering/*` za draft (`initDraftFromStorage`), ACT (`finalizeOrderFlow`, `clearedDraftAfterSubmit`), i TELL (`sanitizeGuestOrderHonesty`); `apply-kernel-ordering.ts` zadržava legacy „kernel“ terminologiju; `resolve-pending-slot-act` i `perceive-guest-chat-turn` paralelno pozivaju ordering-turn bez jednog ingress-a; bridge shim još postoji za stare testove.

3. **MAKSIMUM za Order comprehend (C5):**
   - **Stubovi:** `cognition/order/apply-order-comprehend.ts` (jedini post-LLM cart+submit) · `load-order-draft.ts` (session → draft) · `persist-order-draft.ts` (draft → session) · `order-comprehend-types.ts` (contract, bez `lib/ai/ordering` u runtime importima)
   - **Fajlovi:** perceive → `applyOrderComprehend` → ACT `mergeOrderComprehendIntoTurn` + `persistOrderDraft` · waiter obligation posle comprehend, ne unutar bridge-a · beliefs `order.draft_lines` iz fold-a
   - **Pravila:** 0 gap/substitution/drink-clarify u `cognition/order` — samo cart mutation + submit intent · runtime `grep lib/ai/ordering` u perceive/act ordering putu = 0 · jedan tip `ApplyOrderComprehendResult` kroz ceo turn · empty-cart submit block ostaje u order, confirm block samo u waiter

4. **Šta obrisati / spojiti:** Obrisati `kernel-ordering-bridge.ts` + `kernel-ordering-bridge.test.ts` (već duplikat u `order-comprehend.test.ts`). Preimenovati/spojiti `apply-kernel-ordering.ts` u `cognition/order` persist helper. Draft engine tipove premestiti u `denis/kernel/cart-projection` ili `cognition/order` — runtime ne importuje `lib/ai/ordering/draft-*`. `resolve-pending-slot-act` koristi `applyOrderComprehend` ili shared `finalizeOrderFlow` wrapper iz `cognition/order`, ne direktno legacy. Ne patchovati bridge — obrisati.

5. **Kako testirati da je gotovo:**
   - `grep -rn "kernel-ordering-bridge\|applyPostLlmOrdering" src/lib/denis/runtime/ src/components/guest/` → 0
   - `grep -rn "lib/ai/ordering" src/lib/denis/runtime/perceive/ src/lib/denis/runtime/act/apply-*ordering*` → 0 (posle A.3–A.4)
   - `pnpm eval:denis` + `pnpm verify:denis` PASS
   - `src/__tests__/order-comprehend.test.ts` — cart apply, empty-cart submit block, bez gap patching
   - iota: espresso add → cart 1 line; recap submit sa praznom korpe → blocked message; gap scenarij ide kroz waiter, ne kroz order comprehend

6. **Koliko nedelja realno:** A.2 runtime wire = **gotovo** (1 sesija). Do MAKSIMUM-a C5 (obrisati bridge, draft ACL u cognition/order, nula legacy importa u runtime) = **2–3 nedelje** unutar ADR-034-A (A.3–A.5). Ceo ARCH-1 (C5 + C6 perceive ingress) = **4–6 nedelja** po ADR-034 planu.

---

## AGENT-05

**PR:** ADR-033 AGENT-05 · PR-034-A.3 · ARCH-2

1. **Šta sam radio:** Obrisao `kernel-ordering-bridge` shim i `kernel-ordering-bridge.test.ts`, ostavio canonical `applyOrderComprehend` + `order-comprehend.test.ts`, potvrdio da gap/submit guard živi samo u `cognition/waiter`.

2. **Šta je danas slabo:** ARCH-2 shim je gone, ali `cognition/waiter` i dalje zavisi od `lib/ai/ordering/order-message-backfill` za parsiranje (`needsDrinkClarify`, `appendOrderGapClarify`) — gap detekcija je formalno u waiter-u, heuristike su još u legacy AI sloju. `applyOrderComprehend` i dalje vuče `maybeBackfillOrderDraft` iz backfill-a (cart, ne gap), pa guest hot path nije čist cognition-only. Nema venue-manifest playbooka za gap vrste — regex + `menuSection === "drinks"`.

3. **MAKSIMUM za ARCH-2 / jedan mozak ordering:**
   - **Stubovi:** `cognition/order/apply-order-comprehend.ts` (samo cart + submit intent) · `cognition/waiter/assess-waiter-obligation.ts` (jedini gap izvor) · `cognition/waiter/enforce-waiter-tell.ts` (TELL bez legacy importa) · `platform/transcript-order-line.ts` (parsiranje segmenta iz transcripta) · `beliefs` → `decide-turn-plan` (`waiter.gap_blocks_confirm`)
   - **Fajlovi:** perceive → `applyOrderComprehend` → FOLD `assessWaiterObligation` → beliefs → DECIDE gate → ACT `!canConfirm` → TELL templates `waiter.gap_clarify.*` · nula `lib/ai/ordering/*` u `cognition/*`
   - **Pravila:** gap nikad ne menja cart u order comprehend · submit blokira samo preko `canConfirm` belief-a · autonomous `waiter_gap` piše pre commerce proactive · `grep kernel-ordering-bridge src/` = 0

4. **Šta obrisati / spojiti:** ✅ `kernel-ordering-bridge.ts` + test. Sledeće: izvući `messageNeedsDrinkClarify` / substitution parse iz `order-message-backfill.ts` u `platform/transcript-order-line.ts` ili `cognition/conversation/`; `enforce-waiter-tell` koristi samo `template-utterance`, ne `appendOrderGapClarify`. `maybeBackfillOrderDraft` ostaje u `cognition/order` ili se spaja u `processOrderingTurn` — jedan cart backfill put, bez gap meta. Ne vraćati bridge shim.

5. **Kako testirati da je gotovo:**
   - `grep -rn "kernel-ordering-bridge\|applyPostLlmOrdering" src/` → 0
   - `grep -rn "canConfirm\|obligation\|gap.*submit" src/lib/ai/ordering` → 0
   - `pnpm vitest run src/__tests__/order-comprehend.test.ts` — nema Pilsner/Weizen patch u comprehend
   - `pnpm eval:denis` — `wp_gap_blocks_confirm_drink` + waiter-parity
   - `pnpm verify:denis` — `cognition/waiter/*` ne importuje `lib/ai/ordering/*`
   - iota: burger+pivo → gap clarify; „da“ sa rupom → nema submit

6. **Koliko nedelja realno:** ARCH-2 shim brisanje = **1 sesija** (DONE). Potpuno čišćenje backfill ↔ waiter duplikata + verify gate = **1–2 nedelje** unutar 034-A.4/034-A.5. Do MAKSIMUM playbook gapova (P1 merljivo na svim venue tipovima) = još **+2 nedelje** uz ADR-031 hardening eval.

---

## AGENT-06

**PR:** ADR-033 CLEANUP · AGENT-06 · perceive shim + runtime import matrix.

**Stanje (2026-06-07):** Obrisan `runtime/perceive/perceive-guest-chat-turn.ts` shim; `run-denis-turn` importuje samo `@/lib/denis/cognition/perceive`; compliance PASS; runtime `lib/ai/ordering` = 0 preko `cognition/order` facades.

---

## AGENT-07

**PR:** ADR-033 AGENT-07 · PR-034-A.5 (zatvaranje ADR-034-A Architecture Unification)

1. **Šta sam radio:** Zatvorio ADR-034-A — potvrdio acceptance (bridge 0 u runtime, eval/verify PASS), ažurirao active-tracker (034-A → COMPLETE, ADR-019 Phase D → ACTIVE), backlog C8/G4 → CODE.

2. **Šta je danas slabo:** ARCH-1/2/3 su zatvoreni u trackeru, ali **draft/ACT i dalje vuče `lib/ai/ordering/*`** (`draft-engine`, `order-flow`, `order-executor`) iz `run-denis-turn`, `resolve-pending-slot-act`, `execute-turn-order-submit` — cognition/order pokriva samo post-LLM comprehend, ne ceo order lifecycle. Perceive ima **tri ulaza**: `cognition/perceive`, runtime thin shim, `execute-chat-turn` re-export — compliance test dozvoljava shim, ali nije jedan mozak u praksi. `lib/ai/ordering` folder živi paralelno sa `cognition/order` bez import-matrix gate-a koji pada na novi PR. Phase D (WORLD) još nije počeo — kitchen ready / push nisu u istom TELL writeru kao chat.

3. **MAKSIMUM za Architecture Unification (034-A + ARCH-1/2/3):**
   - **Stubovi:** `cognition/order/apply-order-comprehend.ts` · `load-order-draft.ts` · `persist-order-draft.ts` · `finalize-order-submit.ts` (ceo draft→cart→submit) · `cognition/perceive/perceive-guest-chat-turn.ts` (jedini LLM perceive) · `cognition/perceive/index.ts` (public API)
   - **Fajlovi:** `run-denis-turn` importuje samo `cognition/order` + `cognition/perceive` + `cognition/waiter` — nula `lib/ai/ordering` u `src/lib/denis/runtime/**` · `execute-chat-turn.ts` → thin signal enqueue ili obrisan · `denis/architecture/compliance.ts` — hard fail ako runtime importuje `lib/ai/ordering`
   - **Pravila:** gap/confirm **samo** `cognition/waiter` · cart mutation **samo** `cognition/order` · perceive **samo** `cognition/perceive` · `lib/ai/ordering` ostaje samo za non-Denis legacy routes dok Phase F ne obriše i to · jedan `ApplyOrderComprehendResult` + jedan `PerceiveGuestTurnResult` kroz ceo turn

4. **Šta obrisati / spojiti:** Obrisati `src/lib/denis/runtime/perceive/perceive-guest-chat-turn.ts` shim (runtime importuje `cognition/perceive` direktno). Spojiti `apply-kernel-ordering.ts` u `cognition/order/persist-order-draft.ts`. Premestiti `initDraftFromStorage` / `finalizeOrderFlow` / `clearedDraftAfterSubmit` u `cognition/order` ili `denis/kernel/cart-projection` — runtime act fajlovi samo pozivaju cognition. `execute-chat-turn.ts` → `POST /api/denis/signal` ili delete posle Phase D. Ne patchovati importe jedan po jedan — jedan PR „runtime import matrix = 0 legacy ordering“ sa compliance testom koji pada na regresiju.

5. **Kako testirati da je gotovo:**
   - `grep -rn "kernel-ordering-bridge\|applyPostLlmOrdering" src/lib/denis/` → 0
   - `grep -rn "lib/ai/ordering" src/lib/denis/runtime/` → 0 (cilj MAKSIMUM-a; danas još nije)
   - `grep -rn "perceiveGuestChatTurn" src/lib/denis/runtime/` → 0 ili samo re-export iz `cognition/perceive`
   - `pnpm eval:denis` + `pnpm verify:denis` PASS (uključujući `denis-architecture-compliance`)
   - `order-comprehend.test.ts` + `waiter-obligation.test.ts` — order i waiter ne mešaju odgovornosti
   - iota 5 scenarija (gap, submit, substitution) na istom SHA kao `main`
   - Phase D pilot: kitchen ready → push body === transcript line (AGENT-08+)

6. **Koliko nedelja realno:** ADR-034-A tracker COMPLETE = **1 sesija** (DONE). Do MAKSIMUM-a (nula `lib/ai/ordering` u runtime, perceive shim obrisan, compliance hard gate) = još **2–3 nedelje** (1 PR po sesiji, bez mega-refaktora). Phase D WORLD (019-D.1–D.3) = **3–4 nedelje** posle toga. Ukupno do „jedan mozak + kitchen = chat“ merljivo na pilota = **~5–7 nedelja** od danas.

---

## AGENT-08

**PR:** ADR-033 AGENT-08 · PR-019-D.1 · Stub M5 (WORLD order status ingress)

1. **Šta sam radio:** Potvrdio i zatvorio M5 lanac `commerce.order_status` → outbox `commerce.denis.world` → `runDenisWorldSignal` → `resolveWorldOrderTell` → PROJECT + push, proširio `runWorldTellUnificationFixture` (de/sr/en word-match) i ispravio `MenuLocale` tip za engleski gost (`de` + `isEnglish`).

2. **Šta je danas slabo:** WORLD ingress je **fire-and-forget** (`scheduleDenisWorldSignal`) van order PATCH transakcije — outbox je eventual, ne atom sa status update-om. `handleCommerceDenisWorld` na Redis-u samo enqueue-uje u actor queue; direktan `runDenisWorldSignal` i actor put mogu divergirati pod load-om. TELL je unified u kodu, ali nema **live pilot gate-a** (kitchen ready → push → transcript na iota) — eval je unit/fixture, ne end-to-end outbox replay. `commerce.payment_settled`, waiter ack, venue.item_86 iz ADR-019 §6 su OPEN. Operator webhooks i dalje ne koriste isti TELL writer.

3. **MAKSIMUM za Phase D WORLD (M5 + F3):**
   - **Stubovi:** `outbox/enqueue-denis-world-signal.ts` (jedini enqueue) · `outbox/handlers/commerce-denis-world.ts` (jedan handler) · `runtime/run-denis-world-signal.ts` (FOLD→TELL→PROJECT→notify) · `loop/tell-world-order.ts` (jedan template izvor) · `loop/persist-world-tell.ts` (timeline: `world.ingested` → `tell.committed` → `narration.sent`) · `loop/persist-table-session-view.ts` · `loop/project-notify.ts`
   - **Fajlovi:** PATCH order status / create order → `enqueueDenisWorldSignal` u istom outbox batch-u kad je moguće · handler uvek završava u `runDenisWorldSignal` (actor = transport, ne druga logika) · `projectTableSessionView` headline/markState iz `tellResult` · push `body === tell.message`
   - **Pravila:** `resolveWorldOrderTell` jedini string za push, headline, transcript · `shouldNotifyStatusChange` forward-only (nema regress push) · `ai_concierge_enabled` gate u `loadWorldContext` · guest locale iz `ai_sessions.language`, ne venue default · nema direktnog guest UI update iz kitchen/dashboard

4. **Šta obrisati / spojiti:** Spojiti `scheduleDenisWorldSignal` pozive u order lifecycle u **jedan outbox builder** (`buildOutboxEvents` ili `persist-order-status-side-effects`) — ne odvojeni fire-and-forget posle commit-a. Kad actor (Phase E) stabilan: handler uvek `enqueueWorldSignal` → actor drain → `runDenisWorldSignal`; obrisati dupli direct path ili ga ostaviti samo kao Redis-down fallback dokumentovan u jednom mestu. Ne duplirati status template stringove u dashboard push / guest poll — sve kroz `tell-world-order`. Legacy guest order-status poll copy → delete posle Phase D pilot. Ne patchovati headline u React — samo PROJECT.

5. **Kako testirati da je gotovo:**
   - `pnpm eval:denis` — `world tell unifies headline and push copy (Phase D)` PASS
   - `runWorldTellUnificationFixture` — tell.committed = push body = headline = transcript (de, sr, en)
   - `src/__tests__/denis-world-tell.test.ts` — ready transition, skip regressions, locale iz session
   - `pnpm verify:denis` PASS
   - Outbox integration test (novi): enqueue `commerce.denis.world` → handler → mock admin → assert timeline events + `guest_scene.headline`
   - iota pilot: kitchen „Ready“ → guest push stigne → otvori chat → ista rečenica već u transcriptu; nema drugačijeg teksta u dock-u
   - ADR-019 §12 test #1 green na produkciji

6. **Koliko nedelja realno:** M5 ingress + tell unification eval = **1 sesija** (DONE za D.1 stub). Do MAKSIMUM-a (atom outbox, svi world signali §6, operator webhook parity, live pilot gate, AGENT-09 push word-match u pilot gate) = **2–3 nedelje** (D.2 + D.3). Sa Phase E actor hardening (jedan transport, SSE view) = **+2 nedelje** — ukupno **~4 nedelje** do „kitchen govori isto što i chat“ merljivo na iota bez poll workaround-a.

---

## AGENT-09

**Stanje (2026-06-07):** Phase D.2/D.3 OPEN — live iota kitchen-ready → push = transcript gate i atom outbox još nisu u pilot harness-u (eval fixture green).

---

## AGENT-10

*(prazno)*

---

## AGENT-11

**PR:** ADR-033 AGENT-11 · PR-019-E.1 · Stub M2 (Table Session Actor FIFO pilot)

1. **Šta sam radio:** Uveo `rollout.tableSessionActorEnabled` (pilot-only), `resolveTableSessionActorEnabled` u guest/world/commerce ingress, in-memory FIFO + `signalId` dedupe eval i 2-phone race fixture — `pnpm eval:denis` PASS.

2. **Šta je danas slabo:** Actor je **rollout-gated samo na `table_os_pilot`**, ali produkcija i dalje zavisi od Redis-a bez observability (queue depth, lock TTL, drain latency); eval je **in-memory sim**, ne live Redis race. `runDenisSignal` čeka do ~55s (`HTTP_WAIT_MS`) — AGENT-02 već vidi `signal_timeout` na iota. World/commerce i guest idu kroz isti actor, ali nema jedinstvenog SLA fallback-a kad Redis padne. View SSE (M8) nije deo ovog PR-a — gost i dalje poll-uje posle signala.

3. **MAKSIMUM za Phase E Actor (M2 + M3 + transport):**
   - **Stubovi:** `actor/table-session-actor.ts` (enqueue + lock + drain) · `actor/signal-dedupe.ts` (`signalId` 24h) · `actor/redis-keys.ts` · `actor/view-version.ts` (SSE bump posle PROJECT) · `config/rollout.ts` → `resolveTableSessionActorEnabled` · `config/pilot-wiring.ts` (pilot patch)
   - **Fajlovi:** `POST /api/denis/signal` → enqueue → drain → `executeDenisSignalCore` · `commerce-denis-world` + `run-commerce-experience` → isti queue po `table_session_id` · `GET /api/denis/view/stream` (AGENT-12) refresh posle turna
   - **Pravila:** jedan FIFO red po `table_session_id` · lock drži ceo drain · dupli `signalId` = no-op (cached result) · actor uključen samo kad `tableSessionActorEnabled && Redis` · bez Redis = inline legacy path (dokumentovano) · nijedan parallel full-loop inline kad je actor on

4. **Šta obrisati / spojiti:** Ne držati dva puta „actor enabled“ (`getAiRedis()` vs rollout) — samo `resolveTableSessionActorEnabled`. Spojiti world + guest + commerce enqueue u jedan `enqueueTableSessionSignal` API (kind discriminator već postoji). Kad actor stabilan: obrisati direktni `runDenisWorldSignal` u handler-u osim Redis-down fallback-a u **jednom** mestu. Ne patchovati timeout u tri rute — jedan actor SLA config + template-turn fast path (<15s). Eval sim ostaje za CI; live race ide u pilot harness (AGENT-02 predlog), ne u unit sim.

5. **Kako testirati da je gotovo:**
   - `pnpm eval:denis` — `table session actor FIFO + 2-phone race eval passes (Phase E / M2)` PASS
   - `src/__tests__/denis-table-session-actor.test.ts` — pilot rollout gate, dedupe, HTTP mapping
   - `grep -rn "isTableSessionActorEnabled()" src/` → samo infra check ili uklonjen; runtime koristi `resolveTableSessionActorEnabled(config, …)`
   - iota 2 telefona: paralelni `POST /api/denis/signal` na isti sto → nema lost cart update, nema dupli submit, nema `signal_timeout` na template turnu
   - Redis pilot: dva QR tokena / isti `table_session_id` → queue key `denis:actor:queue:{id}` FIFO red potvrđen u logu
   - P4 exit gate (ADR-035): actor on pilot + 2-phone race PASS + guest poll ≥30s samo fallback (AGENT-12)

6. **Koliko nedelja realno:** M2 stub (rollout + eval sim) = **1 sesija** (DONE). Do MAKSIMUM-a (live Redis race, SLA/timeout fix, world+commerce jedan transport, pilot 2-phone gate, SSE view AGENT-12) = **2–3 nedelje** (E.1–E.3). Sa Phase F transcript-only = **+2 nedelje** — ukupno **~3–4 nedelje** do „dva telefona, jedan sto“ merljivo na iota bez race-a.

---

## AGENT-12

**PR:** ADR-033 AGENT-12 · PR-019-E.2 · Stub F6/M8 (View SSE)

1. **Šta sam radio:** U `useDenisView` SSE je primarni transport (`/api/denis/view/stream`), poll samo fallback ≥30s kad SSE nije povezan, auto-reconnect posle Vercel stream limita; uklonjen `fastPoll` iz `guest-denis-layer`, `menu-view`, `order-status-tracker`.

2. **Šta je danas slabo:** F6 je wire-ovan u hook-u, ali **nema eval/pilot gate-a** za transport — `pnpm eval:denis` ne testira SSE reconnect niti poll interval. `publishViewVersionBump` zavisi od Redis-a; bez Redis-a stream pada na `guest_scene.version` poll svakih 1.5s server-side — guest i dalje ne zna da refresh-uje dok ne padne SSE ili ne istekne 30s fallback. `sceneRefreshBump` / `sceneRefreshKey` u React-u su i dalje paralelni triggeri pored SSE (ARCH-5 kršenje). Order tracker, approval-waiting, `guest-order-focus-sheet` i dalje imaju **svoj** 5s poll (`REALTIME_FALLBACK_POLL_MS`) — gost čita više izvora, ne samo `GET /api/denis/view`. Nema browser/E2E testa za dva telefona / version bump <1s.

3. **MAKSIMUM za View SSE (F6 + M8):**
   - **Stubovi:** `hooks/use-denis-view.ts` (jedini guest READ transport) · `api/denis/view/stream/route.ts` (SSE) · `api/denis/view/route.ts` (snapshot) · `actor/view-version.ts` (Redis bump) · `loop/persist-table-session-view.ts` (M8: bump na svaki turn complete)
   - **Fajlovi:** `GUEST_VIEW_FALLBACK_POLL_MS = 30_000` u `constants.ts` · guest komponente **samo** `useDenisView` — nema `setInterval` fetch scene/order posebno · SSE reconnect ≤1s, server `MAX_STREAM_MS` 55s dokumentovan
   - **Pravila:** version bump → jedan `fetchDenisView` · poll **samo** kad `!sseConnected` · nikad poll <30s na guest view putu · `grep setInterval.*fetchDenisView\|guest/scene` u `components/guest/` = 0 paralelnih read-ova · M8: svaki `persistTableSessionView` mora `publishViewVersionBump` (već u kodu, gate u compliance)

4. **Šta obrisati / spojiti:** Ukloniti `fastPoll` prop (DONE). Spojiti order-status / approval / focus-sheet poll u view refresh — kad `view.layers` / `view.chrome.situation.orders` nose kitchen state, **jedan** SSE kanal, ne 5s order poll + 30s view poll. Obrisati `sceneRefreshBump` hack kad SSE + M8 rade — bump iz turn-a je dovoljan. Ne držati `guest_scene` DB fallback u stream route kad Redis postoji — jedan izvor (`view-version.ts`). `execute-chat-turn` / lokalni transcript merge (F5) van scope F6 ali blokira „view-only“ — ne patchovati React refresh key-ove; obrisati dupli trigger.

5. **Kako testirati da je gotovo:**
   - `grep -rn "fastPoll\|POLL_WAITING_MS\|SSE_FALLBACK_POLL_MS" src/` → 0
   - `grep -rn "GUEST_VIEW_FALLBACK_POLL_MS" src/hooks/use-denis-view.ts` → koristi konstantu 30_000
   - `pnpm eval:denis` + `pnpm verify:denis` PASS (regresija spine)
   - Vitest ili Playwright: mock EventSource → version event → tačno jedan `fetchDenisView`; SSE `onerror` → reconnect; poll interval samo kad disconnected
   - iota pilot: Denis turn (chip ili chat) → dock/headline update **bez** ručnog refresh-a, <2s; dva telefona na istom stolu → oba vide isti `view.version` posle turn-a
   - Redis off staging: stream i dalje radi (degraded), guest ne poll-uje češće od 30s

6. **Koliko nedelja realno:** F6 wire (SSE primary + 30s fallback) = **1 sesija** (DONE). Do MAKSIMUM-a (ukloniti paralelne guest poll-ove, `sceneRefreshBump` cleanup, transport eval + iota 2-phone gate, compliance gate na poll interval) = **2–3 nedelje** (F3.1 + ARCH-5). M8 turn-complete bump je već u `persist-table-session-view` — potvrda na pilota = **+2–3 dana**. Ceo Phase E (E.2 + E.3 actor pilot) = **~3 nedelje** ukupno.

---

## AGENT-13

**PR:** ADR-033 AGENT-13 · PR-019-E.3 (zatvaranje ADR-019 Phase E — ACTOR)

1. **Šta sam radio:** Zatvorio Phase E — potvrdio actor FIFO + `signalId` dedupe + SSE view transport, popravio layer compliance (eval simulacija van `actor/`, uklonjen config import iz actor sloja), dodao `runActorFifoEvalSuite` u `eval:denis`, ažurirao tracker (Phase E → COMPLETE, Phase F → ACTIVE).

2. **Šta je danas slabo:** Actor je **CODE + eval green**, ali nema **live pilot gate-a** — iota može i dalje vraćati `signal_timeout` (~55s wait) na sporim turnovima (AGENT-02). Dva transporta za world/commerce: `handleCommerceDenisWorld` enqueue u actor, ali Redis-down / rollout-off ide direktno u `runDenisWorldSignal` / `executeDenisSignalCore` — divergencija pod load-om. `HTTP_WAIT_MS = 55_000` nije SLA po tipu signala (template gap vs LLM turn). In-memory eval (`simulate-actor-fifo-queue`) ne testira Redis lock re-entry, poison queue item, ni actor drain kad lock istekne. `tableSessionActorEnabled` samo na `table_os_pilot` — nema GA gate-a pre chain rollout-a. Phase F (transcript dual-write) i dalje može maskirati race na stolu iako actor eval prolazi.

3. **MAKSIMUM za Table Session Actor (Phase E + M2):**
   - **Stubovi:** `actor/table-session-actor.ts` (enqueue + drain + wait) · `actor/signal-dedupe.ts` · `actor/redis-keys.ts` · `actor/view-version.ts` · `actor/types.ts` · `config/rollout.ts` (`resolveTableSessionActorEnabled`) · `eval/simulate-actor-fifo-queue.ts` (in-memory mirror) · `eval/run-actor-fifo-fixture.ts`
   - **Fajlovi:** `run-denis-signal.ts` — jedini guest ingress; actor ili inline fallback **dokumentovan u jednom mestu** · world/commerce handleri uvek `enqueue*Signal` kad actor on · `executeDenisSignalCore` samo unutar drain-a, nikad paralelno sa queue-om za isti session
   - **Pravila:** jedan FIFO + jedan lock po `table_session_id` · `signalId` obavezan na guest signal (≥8 chars) · dedupe pre process · guest/world/experience isti queue redosled · actor sloj **ne importuje config** (rollout rešava runtime ingress) · eval ne importuje actor (simulacija u eval/) · bez Redis ili rollout off = inline path, ne polu-queue

4. **Šta obrisati / spojiti:** Spojiti direct vs actor put u **jedan** `runDenisSignal` + outbox handler pattern — actor je transport, ne druga poslovna logika; obrisati dupli `runDenisWorldSignal` bypass kad Redis postoji. Smanjiti / tier-ovati `HTTP_WAIT_MS` (template turn <15s, LLM turn budget posebno) — ne jedan 55s za sve. Ne vraćati `isTableSessionActorEnabled` u actor sloj. `sceneRefreshBump` / lokalni React refresh (AGENT-12) obrisati kad M8 bump + SSE rade — actor ne rešava view, ali race na stolu se vidi kroz view lag. Posle Phase F: obrisati dual transcript write — inače „FIFO OK u eval-u, dva transcripta na iota“.

5. **Kako testirati da je gotovo:**
   - `pnpm eval:denis` — `table session actor FIFO + 2-phone race eval passes (Phase E / M2)` PASS
   - `pnpm verify:denis` — nema `eval → actor` import; nema `actor → config` import
   - `src/__tests__/denis-table-session-actor.test.ts` — redis keys, dedupe, pilot rollout gate, HTTP 504 mapping
   - `runActorFifoEvalSuite` u pilot gate (ne samo unit test)
   - iota pilot: dva telefona isti sto — oba signala procesirana FIFO, jedan transcript red, nema `signal_timeout` na template turn-u (<15s)
   - Redis off staging: inline fallback radi, nema partial enqueue
   - `grep -rn "executeDenisSignalCore" src/` — samo actor drain + dokumentovan fallback u `run-denis-signal`

6. **Koliko nedelja realno:** Phase E tracker COMPLETE (E.1–E.3 eval + compliance) = **1 sesija** (DONE). Do MAKSIMUM-a (live 2-phone pilot gate, signal SLA po tipu, world/commerce jedan transport, pilot gate u `runPilotGate`, chain rollout checklist) = **2–3 nedelje**. Sa Phase F transcript TRUTH (019-F.1–F.3) = **+2 nedelje** — ukupno **~4 nedelje** do „dva telefona, jedan sto, jedan mozak“ merljivo na iota bez timeout-a i bez dual-write maskiranja.

---

## AGENT-14

**PR:** ADR-033 AGENT-14 · PR-019-F.1 · Stub T4 (Transcript TRUTH write)

1. **Šta sam radio:** Uklonio dual-write transcripta na guest putu — `persistMessages` default false, `run-denis-turn` uvek šalje false, bootstrap (`load-ai-session-messages`) i ordering perceive čitaju samo `denis_timeline` preko `foldTranscriptFromTimeline` / `timelineToStoredMessages`.

2. **Šta je danas slabo:** Write je ugašen, ali **read još nije jedan izvor svuda** — guest UI (`ai-concierge-chat.tsx`) i dalje merge-uje lokalni state + `GET /api/ai/session`; `perceive-guest-chat-turn` još čita `messages` kolonu pri `toAiSessionRow` i zadržava opt-in `persistMessages === true` granu; `session-lifecycle.isAiSessionMessageLimitReached` gleda prazan `messages[]` u bazi; operator/admin projekcije (`session-transcript`, `denis-metrics`) još čitaju `ai_sessions.messages`; nema compliance gate-a „guest path messages write = 0“; `verify:denis` pada na pre-existing actor import (Phase E), ne na T4.

3. **MAKSIMUM za Transcript TRUTH (ARCH-4 / Phase F T4):**
   - **Stubovi:** `loop/fold-transcript.ts` (`foldTranscriptFromTimeline` — jedini fold) · `platform/append-timeline-event.ts` (write: `perception.ingested`, `tell.committed`) · `runtime/persist-turn-timeline.ts` · `loop/replay-table-session.ts` (read bez `ai_sessions.messages`)
   - **Fajlovi:** `run-denis-turn` → perceive sa `persistMessages: false` (hard) · `load-ai-session-messages` → timeline only · `project-view.ts` → `view.transcript` iz fold-a · guest UI čita **samo** `view.transcript` (AGENT-15 F5) · `compliance.ts` — grep fail ako `perceive-guest-chat-turn` ili guest API piše `messages`
   - **Pravila:** transcript write = **samo** timeline append · transcript read = **samo** `foldTranscriptFromTimeline` · `ai_sessions.messages` insert/update na guest putu = 0 · message limit iz timeline count, ne iz DB kolone · replay sesije = timeline + orders, ne messages JSON

4. **Šta obrisati / spojiti:** Obrisati `persistMessages` opt-in i celu `messages` granu iz `perceive-guest-chat-turn` (ne patch flag). Spojiti guest bootstrap: `GET /api/ai/session` → delegira na `GET /api/denis/view` transcript ili se obriše posle F5. Ukloniti fallback na `ai_sessions.messages` iz `load-ai-session-messages` (DONE) i operator `session-transcript` (još OPEN). `session-lifecycle` limit check → `timelineMessageCount` ili fold helper, ne `row.messages.length`. Ne držati parallel lokalni message merge u React — jedan `view.transcript` stream (SSE posle Phase E). `execute-chat-turn.ts` re-export → delete posle signal GA.

5. **Kako testirati da je gotovo:**
   - `grep -rn "messages:" src/lib/denis/cognition/perceive/perceive-guest-chat-turn.ts` → samo tipovi, nema update/insert payload
   - `grep -rn "persistMessages.*true\|messages.*update" src/app/api/ src/lib/denis/runtime/run-denis-turn.ts` → 0 write na guest putu
   - `pnpm eval:denis` — `foldTranscriptFromTimeline Phase F` + `world tell` transcript word-match PASS
   - `src/__tests__/denis-fold-transcript.test.ts` — `perception.ingested` + `tell.committed` canonical
   - Novi compliance check: `GUEST_TRANSCRIPT_DUAL_WRITE` = error
   - iota pilot: 3 guest turna → refresh chat → istorija = timeline (nema drifta posle reload); kitchen ready TELL = ista linija u transcriptu bez duplikata iz `ai_sessions`
   - `replay-table-session` na istoj sesiji = identičan transcript kao live view

6. **Koliko nedelja realno:** T4 write stub = **1 sesija** (DONE). Do MAKSIMUM-a ARCH-4 (F5 guest UI, obrisati `persistMessages`, operator read migration, compliance gate, message limit iz timeline) = **1–2 nedelje** (AGENT-15 + AGENT-16). Sa Phase E SSE primary view = **+1 nedelja**. Ukupno Phase F COMPLETE merljivo na iota = **~2–3 nedelje** od T4 write do „jedan TRUTH stream“ bez dual-read u UI-ju.

---

## AGENT-15

**PR:** ADR-033 AGENT-15 · PR-019-F.2 · Stub F5 (Guest UI view.transcript only)

1. **Šta sam radio:** Prebacio guest desk (`ai-concierge-chat.tsx`) da čita isključivo `view.transcript` (prop `bootstrapTranscript` iz `useDenisView`), uklonio parallel `/api/ai/session` history fetch i lokalni merge user/assistant poruka posle Denis turna — čeka `onSceneRefresh` umesto duplog stanja.

2. **Šta je danas slabo:** Chat i dalje drži lokalni `messages` state sa `ephemeral` overlay-ima (recovery, PIN, allergy/mood sheet, demo) i `pendingTurnExtras` za recommendations/quickReplies koje nisu u timeline TRUTH — dva izvora prikaza. Prop se zove `bootstrapTranscript` i sync je effect na promenu niza, ne pravi „view-only“ render (nema derived-only messages). Greeting se i dalje ubacuje lokalno kad transcript prazan. `menu-view` i `guest-denis-layer` već prosleđuju transcript, ali nema pilot gate-a „otvori push → ista linija već u chatu bez flash-a“. F6 SSE nije primary — poll fallback i dalje može kasniti sync posle turna.

3. **MAKSIMUM za F5 Transcript render (P5):**
   - **Stubovi:** `view-transcript-bootstrap.ts` (jedini mapper `TranscriptEntry[]` → desk) · `useDenisView` (jedini guest read subscription) · `GET /api/denis/view` + SSE `/api/denis/view/stream` · `fold-transcript.ts` (jedini write/read TRUTH)
   - **Fajlovi:** `guest-denis-layer.tsx` / `menu-view.tsx` → `viewTranscript={view.transcript}` (required kad `sessionToken`) · `ai-concierge-chat.tsx` — `displayMessages = useMemo(() => mapTranscript(viewTranscript), [viewTranscript])` + izolovani `clientOverlay` samo za onboarding/recovery · recommendations/quickReplies u `TableSessionView` enrichments ili zadnji `tell.committed` payload, ne React ref
   - **Pravila:** nema `fetch('/api/ai/session')` u guest UI · nema `setMessages` append posle uspešnog Denis turna · dock headline = transcript poslednja Denis linija = push body · chat sheet se ne otvara sa stale `ai_sessions.messages` · `grep setMessages.*assistant` u turn success path = 0

4. **Šta obrisati / spojiti:** ✅ `/api/ai/session` read iz `ai-concierge-chat` bootstrap. Sledeće: preimenovati `bootstrapTranscript` → `viewTranscript` i učiniti obaveznim sa sesijom; obrisati `historyLoadedForRef` / `chatInitKeyRef` pattern (već uklonjen); spojiti allergy/mood onboarding u zaseban sheet ili `view.layers`, ne u chat message list; recommendations iz API response-a prebaciti u PROJECT/view blob umesto `pendingTurnExtrasRef`; kad AGENT-14 zatvori T4 write — obrisati ceo `ai_sessions.messages` read path i `load-ai-session-messages.ts` za guest. Ne patchovati dual-write — jedan prikaz iz `foldTranscriptFromTimeline`.

5. **Kako testirati da je gotovo:**
   - `grep -rn "/api/ai/session" src/components/guest/` → 0
   - `pnpm eval:denis` + `pnpm verify:denis` PASS
   - `denis-project-view.test.ts` — `view.transcript` konzistentan sa timeline
   - `denis-world-tell.test.ts` — push = headline = transcript line
   - Manual / iota pilot (ADR-019 §12 #1): kitchen Ready → push → otvori desk → ista rečenica u transcriptu, bez duplikata posle zatvaranja/ponovnog otvaranja chata
   - Posle guest turna: poruke se pojave tek kad `view.version` skoči (SSE), ne iz lokalnog append-a

6. **Koliko nedelja realno:** F5 stub (transcript-only read, bez session fetch) = **1 sesija** (DONE). Do MAKSIMUM-a (derived-only render, enrichments u view, onboarding van message merge, F6 SSE primary bez flash-a) = **1–2 nedelje**. Sa Phase F T4 write cleanup (AGENT-14) + pilot gate u eval = **~2 nedelje** do P5 exit „jedan tekst svuda“ merljivo na iota.

---

## AGENT-16

**PR:** ADR-033 AGENT-16 · PR-019-F.3 (zatvaranje ADR-019 Phase F TRUTH)

1. **Šta sam radio:** Zatvorio Phase F — tracker Phase F → COMPLETE, ADR-020 §Kad → ACTIVE; ARCH-4 SOLID u ADR-035 (T4, F5, F6); potvrdio `pnpm eval:denis` + `pnpm verify:denis` PASS.

2. **Šta je danas slabo:** Transcript **write** je timeline-only na guest hot path (`persistMessages` default false), ali **read** i dalje ima tri ulaza: `view.transcript` (canonical), `loadAiSessionHistory` → `timelineToStoredMessages` (API bootstrap), i lokalni `clientOnlyMessages` u `ai-concierge-chat.tsx` (recovery/PIN/onboarding). `ai_sessions` tabela još postoji — `ensure-shared-ai-session` piše `messages: []`, operator/dashboard i dalje čitaju `ai_sessions.messages` za legacy sesije. `fold-table-session-state` još učitava `ai_sessions` za language/prefs, ne čist TRUTH replay. Nema eval gate-a koji pada ako neko ponovo uključi dual-write (`persistMessages: true`). Dispute replay = timeline + orders je u kodu (`replay-table-session.ts`), ali nije u pilot gate-u.

3. **MAKSIMUM za Transcript TRUTH (ARCH-4 / Phase F):**
   - **Stubovi:** `loop/fold-transcript.ts` (jedini read: `foldTranscriptFromTimeline`, `timelineToStoredMessages`) · `loop/replay-table-session.ts` (dispute = timeline + order facts, bez `ai_sessions.messages`) · `loop/project-view.ts` (`transcript` slice) · `platform/append-timeline-event.ts` (jedini write: `tell.committed`, `perception.ingested`, `world.ingested`)
   - **Fajlovi:** guest UI **samo** `useDenisView` → `view.transcript` bootstrap · `load-ai-session-messages.ts` čita timeline (već) · `perceive-guest-chat-turn.ts` — `persistMessages` uklonjen ili hard-fail u production · `run-denis-turn` uvek `persistMessages: false` · operator transcript → `loadDenisTimeline` + fold, ne `ai_sessions.messages`
   - **Pravila:** `grep "messages:" src/lib/denis` + guest API → 0 write u `ai_sessions` · chat = dock = push = transcript (isti TELL output, već Phase D) · client-only linije (PIN, recovery) **ne** ulaze u `TableSessionState` — odvojen `view.clientHints` ili dismiss-only UI state · compliance test pada na `persistMessages: true` u guest path

4. **Šta obrisati / spojiti:** Obrisati `persistMessages` flag i ceo dual-write branch u `perceive-guest-chat-turn.ts` (ne samo default false). Spojiti `loadAiSessionHistory` i `GET /api/denis/view` u jedan read — guest chat ne fetch-uje session history posebno kad ima view. Operator `session-transcript.ts` / `list-sessions.ts` → timeline fold, deprecate `ai_sessions.messages` column read. `fold-table-session-state` language/prefs iz timeline meta ili dedicated session row bez messages JSON. Ne patchovati React merge — obrisati paralelne fetch path-ove u `ai-concierge-chat` kad `bootstrapTranscript` postoji. Legacy `execute-chat-turn` shim → signal-only ili delete.

5. **Kako testirati da je gotovo:**
   - `grep -rn "persistMessages\|messages:.*priorMessages" src/lib/denis/ src/lib/ai/` → 0 na guest write path
   - `grep -rn "ai_sessions.*messages" src/components/guest/ src/app/api/` → 0 read osim operator deprecate
   - `pnpm eval:denis` — transcript fold + world tell unification + waiter obligation (transcript gap parse)
   - `pnpm verify:denis` PASS (layer matrix, nema eval→actor import)
   - Novi fixture: `run-transcript-truth-fixture.ts` — turn → timeline events → `foldTranscriptFromTimeline` === `view.transcript`; replay bez `ai_sessions`
   - iota pilot: 3 turna chata → refresh stranice → isti transcript iz view; kitchen ready push → linija već u transcriptu pre otvaranja chata (ADR-019 §12 #1)

6. **Koliko nedelja realno:** Phase F tracker COMPLETE + ARCH-4 stubovi T4/F5 = **1 sesija** (DONE). Do MAKSIMUM-a (obrisati `persistMessages`, operator/dashboard na timeline, compliance hard gate, transcript-truth fixture u pilot gate) = **1–2 nedelje**. Deprecate/migrate `ai_sessions.messages` column (migration + RLS) = **+1 nedelja** opciono, ne blokira §Kad. Ukupno do „jedan izvor istine bez escape hatch-a“ = **~2–3 nedelje**; ADR-020 §Kad može paralelno od sledeće sesije.

---

## AGENT-17

**PR:** ADR-033 AGENT-17 · PR-031-H.1 · Stub C3 (Waiter-parity 80+ scenarija)

1. **Šta sam radio:** Proširio `WAITER_PARITY_SCENARIOS` sa 54 na 103 scenarija (gap, substitution, multi-turn, DE/EN/SR, waiting, rush) i podigao `WAITER_PARITY_MIN_SCENARIOS` na 80 — `runWaiterParitySuite` 100% pass, `pnpm eval:denis` PASS.

2. **Šta je danas slabo:** Waiter-parity testira samo **DECIDE + beliefs** bez LLM, ACT-a i live stola — zeleno u fixture-u ne garantuje iota QR. Scenariji su ručno pisani jedan-po-jedan; duplikuju se sa `iota-obligation-scenarios` (isti gap cart setup u dva runner-a). Waiting status je **fraza-osetljiv** (`gde je moje pivo` → template, `koliko još čekam` → comprehend) — nema matrice fraza u eval-u, samo šta slučajno prođe probe. Nema kategorijskog registry-ja (slot / gap / rush) — teško održavanje na 150+. `run-pilot-gate` uključuje waiter parity, ali nema posebnog gate-a „novi scenario mora proći probe pre merge-a“.

3. **MAKSIMUM za Waiter-parity eval (C3 / ADR-031 hardening):**
   - **Stubovi:** `eval/fixtures/waiter-parity/scenarios.ts` (registry po kategorijama) · `eval/fixtures/waiter-parity/helpers.ts` (`gapRecapSetup`, `waitingSetup`, `pendingBeer`) · `eval/fixtures/waiter-parity/matrix.ts` (DE/EN/SR slot + confirm + status fraze) · `eval/probe-waiter-parity.ts` (lokalni probe pre dodavanja) · `eval/waiter-parity-types.ts` (contract)
   - **Fajlovi:** `run-waiter-parity.ts` jedini runner · shared cart/transcript setup iz `timeline/helpers` — **jedan** `iotaBurgerPivoGap` helper za waiter-parity **i** timeline replay · `quality-contract-eval.ts` + `run-pilot-gate.ts` — `minScenarios: 80`, `minPassRate: 0.95` hard fail
   - **Pravila:** novi scenario = probe PASS pre merge-a · gap/substitution expectation samo iz `assessWaiterObligation` output-a, ne copy-paste reason stringova · waiting status matrica dokumentovana u helpers (šta je `commerce.status.open_order` vs `commerce.pressure.comprehend`) · 0 duplog scenarija između `wp_gap_*` i `tl_iota_gap_*` — timeline replay koristi iste `cartLines` + `lastGuestOrderMessage` iz waiter helpers

4. **Šta obrisati / spojiti:** Spojiti duplikat gap setup-a (`moze jedno pivo beef burger` + burger-only cart) u `helpers.ts` — waiter-parity i iota timeline importuju isti builder. Ne dodavati scenarije patch-po-patch bez kategorije — koristiti matrix generator za slot/confirm/status varijante (DE/EN/SR). Obrisati ili spojiti preklapajuće `wp_gap_blocks_confirm_drink` / `wp_gap_blocks_moze` ako matrix pokriva isti belief output. Probe skripta (`npx tsx eval/probe-waiter-parity.ts`) u repo umesto ad-hoc `-e` u agent sesiji. Ne držati odvojene min brojeve (40 u docs, 80 u kodu) — jedan `WAITER_PARITY_MIN_SCENARIOS` u scenarios.ts + pilot gate.

5. **Kako testirati da je gotovo:**
   - `pnpm eval:denis` — waiter parity test: `scenarioCount >= 80`, `passRate >= 0.95`, `ok: true`
   - `pnpm test:run src/__tests__/waiter-parity.test.ts` PASS
   - `runPilotGate().waiterParity` green u `denis-eval.test.ts`
   - Kategorije pokrivene: grep `// ---` sekcije u `scenarios.ts` — slot, gap, substitution, waiting, rush, multi-turn, DE/EN/SR (min 5 po jeziku)
   - iota pilot (AGENT-02 harness): bar 3 waiter-parity journey-a mapirana 1:1 na live QR (gap block, substitution, waiting status) — eval PASS ≠ COMPLETE bez toga
   - Regresija: novi PR ne sme smanjiti `passRate`; CI loguje failed `scenarioId` liste

6. **Koliko nedelja realno:** 80+ scenarija + 100% pass u eval-u = **1 sesija** (DONE). Do MAKSIMUM-a (shared helpers sa timeline, matrix generator, probe u repo, 150+ scenarija, live pilot mapiranje 1:1) = **1–2 nedelje**. Pouzdan „zeleno u eval = zeleno na stolu“ za waiter journeys = **+2 nedelje** uz AGENT-02 pilot harness — ukupno **~3 nedelje** do C3 COMPLETE merljivog na iota, ne samo na `decideTurnPlan` fixture-u.

---

## AGENT-18

**PR:** ADR-033 AGENT-18 · PR-031-H.2 · Stub T7 (iota timeline fixtures)

1. **Šta sam radio:** Proširio iota timeline obligation replay sa 7 na 13 anonymized scenarija u `fixtures/timeline/iota-obligation-scenarios.ts` i potvrdio `runTimelineObligationSuite` green u pilot gate-u.

2. **Šta je danas slabo:** Fixtures su ručno pisani TS helperi (`iotaOrderTimeline`), ne stvarni anonymized production JSON iz `denis_timeline` — eval ne dokazuje da live replay daje isti `TableSessionState`. Replay suite testira samo `assessWaiterObligation` + `decideTurnPlan` + `extractTimelineReplayTurns`, ne pun FIFO actor / FOLD lanac; `mind.obligation_snapshot` (ADR-035 T1) nije u timeline eventima. Validacija „order placement turn“ je krhka regex (`pivo|burger`). Waiter-parity (80+) i timeline fixtures žive u dva formata — dupli scenario DSL bez generatora.

3. **MAKSIMUM za iota timeline replay (T7):**
   - **Stubovi:** `eval/fixtures/timeline/*.json` (anonymized export po scenariju) · `eval/fixtures/timeline/helpers.ts` (row builder) · `eval/run-timeline-obligation-fixture.ts` (obligation + TDE assert) · `eval/simulate-actor-fifo-queue.ts` + `run-actor-fifo-fixture.ts` (pun turn replay) · `loop/fold-transcript.ts` + `fold-table-session-state.ts` (jedan fold iz timeline-a)
   - **Fajlovi:** posle svakog FOLD append `mind.obligation_snapshot` u timeline · replay loader: JSON → `DenisTimelineRow[]` → `buildStateFromScenario` = isti state kao live actor drain · scenario manifest `IOTA_TIMELINE_OBLIGATION_SCENARIOS` mapira id → JSON + `expect` contract
   - **Pravila:** svaki live iota bug → novi JSON fixture u istom PR-u · timeline = jedini transcript izvor (ARCH-4) · replay assert: `obligation`, `planReason`, `transcript`, opciono `view.headline` — ne regex na guest text · pilot harness koristi iste 5–13 koraka kao `tl_iota_*` id-evi

4. **Šta obrisati / spojiti:** Ne držati paralelne scenario definicije u waiter-parity i timeline — jedan DSL ili generator (parity journey → synthetic timeline). Spojiti `run-timeline-obligation-fixture` i `run-venue-sim` u jedan replay entry (`replay-table-session-from-timeline.ts`). Obrisati regex gate za „order placement turn“ — zameniti struktuiranim assert-om na `perception.ingested` + `flow.transitioned`. Kad actor replay stabilan: obligation-only fixture runner postaje thin wrapper oko punog sim-a, ne drugi mozak. Ne patchovati `iotaOrderTimeline` po scenariju — samo JSON + expect.

5. **Kako testirati da je gotovo:**
   - `pnpm eval:denis` — `iota timeline obligation replay` ≥10 scenarija (cilj 20+), svi PASS
   - `runPilotGate().timelineObligation.ok` + `runTimelineObligationSuite` bez DB/LLM
   - `simulate-actor-fifo-queue` / `run-actor-fifo-fixture` — isti `obligation`/`planReason` kao obligation-only put
   - `foldTranscriptFromTimeline` + replay state diff: fixture state === actor drain state (novi test)
   - iota pilot harness: `tl_iota_gap_drink_recap`, `tl_iota_gap_blocks_confirm_da`, `tl_iota_gap_cleared_pilsner` na čistoj sesiji
   - `grep mind.obligation_snapshot supabase/` ili timeline append posle FOLD — event prisutan u replay JSON-u

6. **Koliko nedelja realno:** 13 fixture scenarija + eval gate = **1 sesija** (DONE). Do MAKSIMUM-a (production JSON export, obligation_snapshot u timeline, pun actor replay diff, pilot harness mapiran na `tl_*`, 20+ scenarija) = **2–3 nedelje**. Sa spojenim waiter-parity ↔ timeline generatorom (bez duplog održavanja) = **+1 nedelja** — ukupno **~3–4 nedelje** do „regresija nemoguća“ (ADR-034 P9) merljivo na iota replay-u, ne samo na unit obligation assert-u.

---

## AGENT-19

**PR:** ADR-033 AGENT-19 · PR-F4.1 · Stub F4 (Guest UI view-only)

1. **Šta sam radio:** Uklonio React merge cart+scene+chat u guest komponentama — `manualCartSnapshot` van chata, `menu-view` na `GuestDenisLayer` sa `controlledView`, orders/banneri/headline samo iz `GET /api/denis/view`, cart sync isključivo preko `useDenisSense` signal write.

2. **Šta je danas slabo:** F4 stub je na menu, ali **nije jedan read put na svim guest površinama** — `order-status-tracker`, `guest-order-focus-sheet` i dalje imaju svoj poll; `sceneRefreshKey` / `sceneRefreshBump` u React-u su paralelni triggeri pored SSE (ARCH-5). `GuestDenisLayer` i dalje može interno zvati `useDenisView` kad nema `controlledView` (dupli fetch rizik). `OrderSummary` u view-u nema `delivered_at` — feedback na menu je privremeno isključen. `DenisSceneBanners` ostaje u `menu-view` odvojeno od layer-a u `GuestDenisLayer`. Nema eval/pilot gate-a „grep manualCartSnapshot u components/guest = 0“ niti assert da chat payload ne nosi cart snapshot.

3. **MAKSIMUM za F4 Guest UI view-only (P5 / ADR-035):**
   - **Stubovi:** `hooks/use-denis-view.ts` (jedini guest READ) · `api/denis/view` + `view/stream` · `loop/project-view.ts` + `view-to-scene.ts` (scene = derivat view-a, ne drugi mozak) · `guest-denis-layer.tsx` (jedini Denis UI sloj na svim guest rutama) · `hooks/use-denis-sense.ts` (jedini cart WRITE: `telemetry.manual_cart`)
   - **Fajlovi:** `components/guest/*` — **0** `buildManualCartSnapshot`, **0** `useGuestTableOrders`, **0** merge headline/scene/transcript u React-u · `menu-view`, `order-status-tracker`, `cart` → samo `GuestDenisLayer` + menu-specifični props (`menuChat`, `controlledView`) · banneri iz `view.layers` (`viewBannerLayers`), dock headline = `view.chrome.headline`
   - **Pravila:** guest UI = render + signal enqueue (`POST /api/denis/signal`, sense cart) — **nema** business odluka iz Zustand cart + parallel order fetch + scene headline fallback · chat turn payload bez `manualCartSnapshot` (server čita cart iz fold-a posle sense) · `grep manualCartSnapshot src/components/guest` = 0 · `grep useGuestTableOrders src/components/guest` = 0 · jedan `fetchDenisView` po sesiji (controlledView pattern obavezan na menu)

4. **Šta obrisati / spojiti:** ✅ `getManualCartSnapshot` iz `ai-concierge-chat`, `guest-denis-layer`, `menu-view`. ✅ `useGuestTableOrders` sa menu. Spojiti preostali Denis UI duplikat — `order-status-tracker` koristi isti `controlledView` + ukloniti lokalni scene refresh bump. Obrisati `sceneRefreshKey` / `sceneRefreshBump` hack kad SSE + M8 rade (AGENT-12). Proširiti `OrderSummary` sa `delivered_at` ili feedback prebaciti u `view.layers` — ne patch `deliveredAt={null}`. `DenisSceneBanners` uvesti u `GuestDenisLayer` ili render iz `view.layers` bez posebnog scene parse-a. Ne vraćati cart u chat request — jedan sense debounce put. Legacy `guest_scene` headline merge u dock-u — obrisati fallback na `scene.chrome.situation.headline` kad `view` postoji.

5. **Kako testirati da je gotovo:**
   - `grep -rn "manualCartSnapshot\|getManualCartSnapshot\|buildManualCartSnapshot" src/components/guest/` → 0
   - `grep -rn "useGuestTableOrders" src/components/guest/` → 0
   - `grep -rn "sceneRefreshBump\|sceneRefreshKey" src/components/guest/` → 0 (posle ARCH-5 cleanup)
   - `pnpm verify:denis` + `pnpm eval:denis` PASS
   - `denis-project-view.test.ts` — `view.layers`, `view.orders`, `view.cart` konzistentni sa fold-om
   - Vitest/Playwright: add to cart → `useDenisSense` fire → turn → headline/cart count iz view-a bez lokalnog merge-a
   - iota pilot: Denis chat turn — network tab nema `manualCartSnapshot` u body-ju; dock headline = `view.chrome.headline` posle chip-a; dva telefona vide isti `view.version` bez parallel `/orders` fetch na menu

6. **Koliko nedelja realno:** F4.1 stub (manualCart van React-a, menu → GuestDenisLayer, view-only orders/banners) = **1 sesija** (DONE). Do MAKSIMUM-a P5 exit (sve guest rute, bez sceneRefresh hack-a, feedback iz view-a, compliance grep u CI, pilot gate) = **2–3 nedelje** (F4.2–F4.3 + ARCH-5 sa AGENT-12). Sa F7 scene↔view konzistencija (jedan PROJECT piše layers) = **+1 nedelja** — ukupno **~3–4 nedelje** do „guest komponente ne merge-uju ništa“ merljivo na iota.

---

## AGENT-20

**PR:** ADR-033 AGENT-20 · PR-E2.1 · Stub C10 (Menu RAG embeddings + Redis)

1. **Šta sam radio:** Uveo semantic Menu RAG (OpenAI/Gateway embeddings + Redis keš po lokaciji), hybrid keyword→embedding retriever u `menu-rag.ts`, wire u `run-denis-turn`/`plan-evidence`, i lagani eval fixture `"nešto lagano"` → Lagana salata.

2. **Šta je danas slabo:** RAG je **sync u planEvidence** ali embedding load je **async pre turna** — nema jedinstvenog `retrieveMenuEvidenceAsync` API-ja; lokalni deterministički vektori su fallback kad OpenAI padne, ali **openai vs local space** mora ručno da se drži (`MenuRagEmbeddingSpace`). Keyword i embedding ranking su sekvencijalni (keyword pobeđuje ako ima hit), pa `"pivo"` nikad ne ide u semantic — OK, ali `"lagano"` bez keyword hita zavisi od semantic alias mapa u offline modu. Nema invalidacije RAG keša na product edit osim `invalidateMenuCache` (dodato u istom PR-u). Eval pokriva samo **1 semantic scenario** — nema „no unknown SKU“, cross-location, niti live pilot „preporuči nešto bez glutena → samo real product IDs u perceive“. `catalog_rag` capability gate postoji, ali nema observability (`menuRagHits`, token savings).

3. **MAKSIMUM za Menu RAG (C10 / MR-6 / E2):**
   - **Stubovi:** `cognition/context/retrievers/menu-rag.ts` (public retrieve + gate) · `cognition/context/menu-rag-embeddings.ts` (index build, Redis, rank) · `ai/embeddings/openai-embeddings.ts` (Gateway batch) · `cognition/context/menu-rag-types.ts` (contract) · `eval/run-menu-rag-fixture.ts` (semantic + no-hallucination)
   - **Fajlovi:** `run-denis-turn` → `ensureMenuRagEmbeddings` + `embedMenuQueryVector` pre `planEvidence` · `plan-evidence` → `catalog.rag` pointer, `omitFullMenu: true` kad snippet postoji · `invalidateMenuCache` briše i `ai:menu-rag-emb:{locationId}` · venue manifest `capabilities.catalog_rag >= 2` ili `elite.menuRagEnabled`
   - **Pravila:** RAG **nikad** menja cenu — samo product ID pointeri u perceive · ACL i dalje validira `proposeItems` · embeddings keš keyed by `catalogVersion` hash (id+name+section) · query i product vectors **isti space** · offline eval koristi lokalne vektore; produkcija OpenAI preko Gateway · `grep unknown productId` u eval = hard fail

4. **Šta obrisati / spojiti:** Ne držati keyword-only put kao paralelnu logiku — **jedan** `rankMenuRagProducts` (keyword → embedding fallback već tu). Spojiti semantic alias map (`MENU_RAG_SEMANTIC_EXPANSIONS`) u venue playbook ili manifest pairing hints kad E6 stigne — ne treći copy u tri fajla. Obrisati stub mention `src/lib/denis/elite/menu-rag.ts` iz ADR-022 (nikad implementiran) — canonical je `cognition/context/retrievers/menu-rag.ts`. Ne duplirati menu text u perceive kad `omitFullMenu` — jedan `TurnEvidencePack`. Kad cross-location RAG (enterprise): jedan `buildMenuRagEmbeddingIndex(orgId)` umesto per-location patch. Ne patchovati `catalog-search.ts` za semantic — ostaje keyword layer ispod RAG-a.

5. **Kako testirati da je gotovo:**
   - `pnpm test:run src/__tests__/menu-rag.test.ts` — gate, keyword, allergen, `"nešto lagano"` embedding
   - `pnpm eval:denis -t "menu RAG"` — `runMenuRagLightMealFixture` PASS
   - Proširiti eval: `"Nešto bez glutena"` → svi `productIds ∈ catalog`, nema unknown SKU u snippet-u; refusal fixture — Denis ne predlaže ID van RAG evidence
   - `pnpm verify:denis` PASS; `grep -rn "menu-rag-emb" src/lib/ai/menu-cache-invalidate.ts` → invalidacija postoji
   - iota pilot (elite tier): „preporuči nešto lagano“ → perceive prompt sadrži `[food-*]` samo iz menija; order submit sa predloženim ID prolazi ACL
   - Redis: drugi turn iste lokacije → log `Menu RAG embedding cache hit`; edit product name → miss + rebuild

6. **Koliko nedelja realno:** E2.1 stub (embeddings + Redis + 1 eval) = **1 sesija** (DONE). Do MAKSIMUM-a (no-unknown-SKU eval suite, live pilot gate, observability, cross-location enterprise, ukloniti offline alias hack u korist čistog Gateway-only) = **2–3 nedelje** unutar F4.5 + MR-6/E2. Sa playbook-driven semantic hints (E6) = **+1 nedelja** — ukupno **~3–4 nedelje** do „RAG smanjuje halucinacije merljivo na pilota“, ne samo u fixture-u.

---

## AGENT-21

**PR:** ADR-033 AGENT-21 · PR-MR9.1 · Stub C11/E6 (Playbook pack)

1. **Šta sam radio:** Uveo `playbookPackId` u venue manifest, platform registry (`skyline` / `generic-chain`), `loadTurnPlaybookBlock` (org pack + location overlay) i wiring u `run-denis-turn` + FSP (`plan-evidence` → `buildSituationPack`).

2. **Šta je danas slabo:** Pack je **hardcoded TS registry** (2 packa), nema platform admin assign niti DB-backed sadržaj po org-u. `playbookPackId` živi u manifestu, ali ADR-022/E3 još spominje `elite.playbookPackId` — dva koncepta bez jednog resolvera. Perceive i dalje može fallback-ovati na `getPlaybookPromptBlock` van TDE puta; eval proverava samo da blokovi različiti, ne live ton na iota. Location overlay (`ai_playbook` / `ai_examples`) i dalje zavisi od legacy `lib/ai/playbook/*` bez manifest capability gate-a.

3. **MAKSIMUM za Playbook pack (MR-9 / C11 / E6):**
   - **Stubovi:** `cognition/manifest/playbook-pack-registry.ts` (platform katalog) · `cognition/manifest/resolve-playbook-pack.ts` (jedini loader) · `cognition/manifest/load-venue-manifests.ts` · `merge-manifest-config` → `playbookPackId` · `plan-evidence` + `buildSituationPack` (FSP embed)
   - **Fajlovi:** org `organizations.venue_manifest.playbook_pack_id` → svi locationi u chain-u · location `ai_playbook` = overlay na pack, ne zamena · `run-denis-turn` uvek `loadTurnPlaybookBlock` · admin: assign pack + preview ton diff
   - **Pravila:** org manifest pack id **pobedi** location manifest · `playbook.examples` pointer samo na relational/transactional LLM turnovima · pack + overlay merge u jednom `formatPlaybookBlock` · nema tone patching u tri mesta (system prompt, FSP, leadership) — jedan `playbookBlock` iz loadera

4. **Šta obrisati / spojiti:** Spojiti `elite.playbookPackId` i manifest `playbookPackId` u **jedan** `resolvePlaybookPackId` (manifest > elite fallback, jednom dokumentovano). Obrisati direktni `getPlaybookPromptBlock` iz `run-denis-turn` (DONE) i iz `cognition/perceive` kad `opts.evidence.playbookBlock` postoji — perceive ne učitava playbook drugi put. Ne držati paralelne tone pack-ove u `concierge-defaults` / `experiments.playbookVariant` kad manifest pack aktivan. Registry iz TS → DB/platform JSON (jedan izvor), ne patch po venue u kodu.

5. **Kako testirati da je gotovo:**
   - `pnpm test:run src/__tests__/playbook-pack.test.ts` PASS
   - `pnpm eval:denis` — `playbook pack ton differs skyline vs generic-chain (MR-9 / C11)` PASS
   - `runPlaybookPackFixture` — Skyline block ≠ generic-chain; FSP sadrži pack marker; `playbook.examples` pointer
   - `mergeManifestConfig` — dva locationa, isti org manifest → isti `playbookPackId`
   - Location overlay: org `generic-chain` + location `ai_playbook` custom → merged block sadrži oba
   - iota pilot: Skyline org manifest `skyline` → Denis pozdrav spominje lounge/koktel; drugi demo org `generic-chain` → neutralan hotelski ton (live LLM ili shadow diff na playbook block)

6. **Koliko nedelja realno:** MR9.1 stub (manifest + loader + FSP wire + unit eval) = **1 sesija** (DONE). Do MAKSIMUM-a (platform admin assign, DB/registry packovi, chain eval suite, iota tone pilot gate, uklonjen legacy dual loader) = **3–4 nedelje** po ADR-023 MR-9 / F4. Sa E6 white-label (Marriott ≠ Skyline merljivo na 2+ org pilota) = **+1 nedelja** pilot harness — ukupno **~4 nedelje** do prodajnog enterprise playbook pack-a, ne samo fixture ton diff-a.

---

## AGENT-22

**PR:** ADR-033 AGENT-22 · PR-I1.1 · Stub I1 (Operator API read)

1. **Šta sam radio:** Proširio Operator API read-only sa session `metrics` + `beliefs` summary iz `denis_timeline` i `waiterGapRate` na location `denis/metrics` + `summary`, uz projection helpers i contract testove.

2. **Šta je danas slabo:** I1 je **DTO + projection stub**, ne kompletan integration spine — nema OpenAPI (`I3`), nema golden snapshot testova (ADR-029 §11.1), `denis-metrics` i `location-summary` dupliraju timeline query logiku. `waiterGapRate` čita `mind.beliefs_compiled` / `mind.turn_profile`, ali session summary i dalje vuče `turnCount` iz `ai_sessions.messages` (ne iz turn profile-a) — metrike mogu divergirati dok ARCH-4 nije završen. Operator transcript/summary još čita legacy `messages` kolonu pored timeline beliefs. Nema live Viktor sandbox smoke niti `denis.metrics.daily_ready` webhook parity sa istim KPI poljima. Audit log postoji, ali nema admin „Integrations → Activity“ pregleda.

3. **MAKSIMUM za Operator API read (I1 / ADR-029 Channel A):**
   - **Stubovi:** `lib/operator/auth.ts` · `audit-log.ts` · `types.ts` (sve DTO) · `projections/session-summary.ts` · `denis-metrics.ts` · `location-summary.ts` · `projections/timeline-kpi.ts` (shared gap/llm/escalation agregacija) · `projections/session-transcript.ts` (timeline fold only)
   - **Fajlovi:** `app/api/operator/v1/**` — thin routes samo auth → projection → JSON · `docs/openapi/denis-operator-v1.yaml` · `integrations/fixtures/operator/*.snapshot.json` · admin Integrations panel za API keys + audit tail
   - **Pravila:** read-only default (`operator:read`); write samo proposals (`operator:propose`) · svaki request → `operator_api_audit` · rate limit per org · nula PII default; transcript opt-in `?include=transcript` + audit flag · guest/denis hot path **ne importuje** `lib/operator/*` · breaking change = bump `X-Denis-Operator-Api-Version` · KPI iz timeline TRUTH, ne iz `ai_sessions.messages` kad ARCH-4 zatvoren

4. **Šta obrisati / spojiti:** Spojiti duplu timeline agregaciju iz `denis-metrics.ts` + `location-summary.ts` u jedan `projections/timeline-kpi.ts` (gap, llm, escalation, beliefs) — ne copy-paste `countSessionsWithWaiterGap` u treći fajl. Kad ARCH-4 gotov: obrisati read `ai_sessions.messages` iz operator projections — samo `foldTranscriptFromTimeline` + timeline events. Webhook `denis.metrics.daily_ready` (I2) mora koristiti **isti** projection builder kao HTTP GET, ne paralelnu SQL. Ne patchovati gap_rate u admin dashboard posebno — jedan `projectDenisLocationMetrics` izvor za Viktor + owner UI. Contract testovi u jednom `operator-api-contract.test.ts`, ne rasuti smoke po route fajlovima.

5. **Kako testirati da je gotovo:**
   - `pnpm test:run src/__tests__/operator-api*.test.ts` — contract + helper unit PASS
   - `grep -rn "lib/operator" src/lib/denis/runtime/ src/components/guest/` → 0 (guest isolation)
   - Projection snapshot: fixture timeline + orders → `projectDenisLocationMetrics` / `projectOperatorSessionSummary` → assert JSON snapshot (≥10 KPI scenarija, ADR-029 §11.1)
   - Sandbox org + `dns_op_live_*` key: GET `denis/metrics` → `waiterGapRate` + `llmInvocationRate`; GET `sessions/:id/summary` → `beliefs.summary["waiter.gap_count"]` bez guest PII
   - iota pilot: sesija sa gap-om → `waiterGapRate > 0` za period; posle gap clear → beliefs summary `waiter.can_confirm: true`
   - I2 gate: `denis.metrics.daily_ready` webhook payload polja = Operator API DTO (isti `waiterGapRate`)

6. **Koliko nedelja realno:** PR-I1.1 stub (metrics + gap_rate + beliefs + contract tests) = **1 sesija** (DONE). Do MAKSIMUM-a I1 (shared timeline KPI, snapshot fixtures, transcript read migration, admin audit UI) = **2–3 nedelje**. Sa I2 webhooks + I3 OpenAPI + Viktor sandbox (I-track COMPLETE) = **+3–4 nedelje** — ukupno **~4–5 nedelja** do pouzdanog Viktor read konnektora merljivog na live gap sesiji, ne samo na mock projection testu.

---

## AGENT-23

**PR:** ADR-033 AGENT-23 · PR-I2.1 · Stub I2 (`denis.session.updated` webhook)

1. **Šta sam radio:** Uveo outbox-only `denis.session.updated` webhook sa versioned payload-om (`apiVersion: 2026-05-29`), Zod contract + golden fixture, OpenAPI snippet i emission hook posle Denis signal turn / handoff / sense / order submit.

2. **Šta je danas slabo:** I2 je **stub**, ne kompletan operator egress — `denis.order.phase_changed` ne postoji; emission je scatter-ovan (`execute-denis-signal-core`, `persist-ai-session-after-order-submit`) bez jednog policy sloja; payload `metrics` je ad-hoc Record bez jedinstvenog envelope-a za sve `denis.*` evente; nema live Viktor receiver testa ni outbox replay fixture-a; `emitDenisSessionUpdated` radi inline DB projection umesto shared buildera; nema dedupe/throttle (svaki turn = webhook); admin nema „Integrations → Activity“ health view iz ADR-029.

3. **MAKSIMUM za I2 operator webhooks (session.updated + order.phase_changed):**
   - **Stubovi:** `webhooks/events.ts` · `webhooks/denis-operator-payload.ts` · `webhooks/emit-denis-session-events.ts` · `webhooks/enqueue-denis-operator-webhook.ts` · `outbox/handlers/integration-webhook.ts` · `integrations/webhooks/*.schema.ts` · `integrations/fixtures/webhooks/*.v1.json`
   - **Fajlovi:** emission samo posle FOLD/PROJECT milestone-a · jedan `scheduleOperatorWebhook({ kind, reason })` iz signal core · order lifecycle → `denis.order.phase_changed` iz istog outbox batch-a · OpenAPI `webhooks` za svaki `denis.*` event
   - **Pravila:** outbox-only (commit checklist §1) · bez guest PII · `apiVersion` bump na breaking change · throttle max 1 `session.updated`/session/5s osim `order_submitted`/`session.completed` · guest hot path importuje samo `webhooks/emit-*`, ne `operator/*`

4. **Šta obrisati / spojiti:** Spojiti emission hook-ove u `webhooks/schedule-denis-operator-event.ts`. Session snapshot u `integrations/build-webhook-payload.ts`, ne inline u emit fajlu. `denis.order.phase_changed` isti envelope pattern. Obrisati direct webhook van outbox handler-a. Jedan `validate-webhook-fixtures` runner umesto test po PR-u.

5. **Kako testirati da je gotovo:**
   - `pnpm test:run src/__tests__/denis-session-updated-webhook.test.ts` + `denis-operator-webhooks.test.ts` PASS
   - Golden fixture validira Zod; isti pattern za `denis.order.phase_changed.v1.json`
   - Outbox integration test: handler → mock deliver → `apiVersion` + HMAC
   - Viktor stub receiver: guest turn → webhook <30s, `metrics.turnCount` raste
   - `pnpm eval:denis` PASS (regresija spine)

6. **Koliko nedelja realno:** `denis.session.updated` stub = **1 sesija** (DONE). MAKSIMUM I2 (`phase_changed`, scheduler, throttle, live receiver) = **2–3 nedelje**. Ceo I-track (I2 + I3 sandbox contract CI) = **4–5 nedelja** po ADR-029 F5.

---

## AGENT-24

**PR:** ADR-033 AGENT-24 · ARCH-6 · Stub M9 (Continuous mind obligation merge)

1. **Šta sam radio:** Uveo `mergeTableSessionObligation()` kao jedini ulaz za fold / turn / watcher / world, povezao FOLD, `compileBeliefs`, `run-denis-turn` i timeline fixture, dodao `runContinuousMindSuite` (4 scenarija) u pilot gate.

2. **Šta je danas slabo:** Obligation se sada merge-uje na jednom mestu, ali **world path ne FOLD-uje** pre TELL-a — `runDenisWorldSignal` ne čita merged obligation, samo piše status template. `compileBeliefs` uvek re-merge-uje (dobro), ali `state.conversation.obligation` na FOLD-u može ostati stale do sledećeg turna ako ACT promeni cart bez re-fold-a. Watcher koristi folded state, ne eksplicitno `source: "watcher"` API — semantika izvora je u eval-u, ne u runtime contract-u. Nema `mind.obligation_snapshot` u timeline za replay diff. Full `eval:denis` i dalje pada na pre-existing waiter parity (`relational_perceive` vs `transactional_perceive`), ne na ARCH-6.

3. **MAKSIMUM za Continuous mind (ARCH-6 / ADR-020 §Kad / P4 M9):**
   - **Stubovi:** `cognition/waiter/merge-table-session-obligation.ts` (jedini merge) · `assess-waiter-obligation.ts` (deterministički contract) · `detect-waiter-obligation-tell.ts` (autonomous writer) · `enforce-waiter-tell.ts` (guest turn TELL) · `eval/run-continuous-mind-fixture.ts` · `eval/fixtures/continuous-mind/scenarios.ts`
   - **Fajlovi:** FOLD → `merge(..., source: "fold")` → `conversation.obligation` · guest turn → `merge(..., source: "turn")` + ACT gate `!canConfirm` · watcher cron → FOLD state → `planProactiveTurn` → `waiter_gap` pre commerce · world signal → FOLD + merge (isti state) → TELL ne sme maskirati gap · beliefs **nikad** ne čitaju stale obligation bez re-merge-a
   - **Pravila:** watcher + world + turn = **isti** `WaiterObligation` snapshot za isti cart + transcript + pendingSlot · world TELL (ready/delay) ne briše cart gap · autonomous `waiter_gap` prioritet iznad welcome/upsell · `ObligationSignalSource` dokumentovan u runtime (fold/turn/watcher/world), ne samo u eval-u · posle svakog FOLD append `mind.obligation_snapshot` u timeline

4. **Šta obrisati / spojiti:** Obrisati preostale direktne `assessWaiterObligation` pozive van `merge-table-session-obligation.ts` (ostaje samo no-state fallback u `run-denis-turn`). Spojiti `run-timeline-obligation-fixture` i `run-continuous-mind-fixture` u jedan replay runner sa `source` matricom — ne dva paralelna obligation assert-a. `runDenisWorldSignal` mora FOLD + merge pre PROJECT-a (kao watcher), ne samo `resolveWorldOrderTell`. Ne patchovati `compileBeliefs` da čita keš — uvek `mergeTableSessionObligation`. Kad actor replay stabilan: obligation-only path postaje thin wrapper oko punog FOLD sim-a.

5. **Kako testirati da je gotovo:**
   - `pnpm vitest run -t "continuous mind"` — 4/4 scenarija PASS (fold ≡ watcher ≡ turn ≡ world)
   - `pnpm eval:denis` — `runContinuousMindSuite` + `runTimelineObligationSuite` + `waiter-autonomous-tell` green u `runPilotGate`
   - `grep -rn "assessWaiterObligation" src/lib/denis/` → samo `merge-table-session-obligation.ts` + dokumentovan no-state fallback
   - `grep -rn "conversation.obligation ??" src/lib/denis/cognition/beliefs` → 0 (nema stale read)
   - iota pilot: gap u korpi → 60s cron piše `waiter_gap` bez guest turna; kitchen ready push → gap i dalje vidljiv u view layeru dok se ne popuni cart
   - Actor replay: isti `obligation` posle world.ingested + guest turn redom (FIFO)

6. **Koliko nedelja realno:** ARCH-6 stub (merge + continuous mind eval) = **1 sesija** (DONE). Do MAKSIMUM-a (world FOLD+merge, obligation_snapshot u timeline, jedan replay runner, world ne maskira gap, pilot gate na iota cron+ready) = **1–2 nedelje**. Sa waiter parity fix (`goal.guest_seated.social` routing) da full `eval:denis` bude green = **+3–5 dana** (van ARCH-6 scope). Ukupno do „živi Denis = jedan obligation state“ merljivo na stolu = **~2 nedelje**.

---

## AGENT-25

**PR:** ADR-033 AGENT-25 · ARCH-7 · Stub C12 (L3 InterpretationTask)

1. **Šta sam radio:** Uveo L3 `InterpretationTask` (`topGoal + beliefs → schema + evidenceBudget`), goal-directed `decideTurnPlan` pre regex fallback-a, wire u `plan-evidence` / `run-denis-turn`, i ARCH-7 eval fixture (`runInterpretationTaskSuite`, 4 scenarija).

2. **Šta je danas slabo:** L3 je **DECIDE + evidence stub**, ne pun structured perceive pipeline — LLM i dalje koristi generički `AiStructuredResponse`, `directiveBlock` je samo tekst u evidence pack-u, nema Zod schema po `InterpretationSchema` (transactional vs upsell vs slot). `buildInterpretationTask` mapira samo `topGoal`, ne secondary goals (`UPSELL_ONCE` ispod `COMPLETE_ROUND`). Regex fallback (`resolvePerceivePlan`) i dalje postoji kad `topGoal === null` i za menu-browse early exit (popravljen `\b` bug, ali i dalje message-regex). Nema live pilot gate-a „vague recommend + open cart → transactional perceive“; eval je fixture-only bez LLM shadow diff-a.

3. **MAKSIMUM za L3 InterpretationTask (C12 / ARCH-7):**
   - **Stubovi:** `cognition/tde/interpretation-task-types.ts` · `build-interpretation-task.ts` · `interpretation-schemas/*.schema.ts` (Zod po schema) · `cognition/perceive/run-interpretation-perceive.ts` (schema-driven structured output) · `plan-evidence.ts` (evidence budget iz task-a, ne message regex)
   - **Fajlovi:** `decideTurnPlan` → `buildInterpretationTask` → `TurnPlan` + task · `run-denis-turn` → `planEvidence({ interpretationTask })` → perceive sa `schema` + `directiveBlock` · ACT validira samo polja dozvoljena schema-om · TELL iz validated perceive, ne iz regex hint-a
   - **Pravila:** regex **hint** beliefs only — nikad plan kind veto kad postoji `topGoal` · `InterpretationSchema` jedini izvor `planKind` + RAG/playbook budget · `vague_recommend` / `ORDERING_GUEST_PATTERN` **obrisati** iz `resolvePerceivePlan` kad goal-directed aktivan · secondary goal stack (npr. upsell ispod complete round) u task builder-u, ne samo `topGoal[0]` · compliance: `grep vague_recommend\|planForBanter` u decide body = 0

4. **Šta obrisati / spojiti:** Obrisati donji regex blok u `resolvePerceivePlan` (`VAGUE_RECOMMEND`, `PURE_SOCIAL`, `isShortBanterReply`) — zameniti potpunim `buildInterpretationTask` + beliefs (`conversation.mode`, `commerce.pressure`). Spojiti `wantsCatalogRag(turnPlan, message)` regex u `interpretationTask.evidenceBudget` only — ne dva puta. `resolvePerceiveMode` samo iz task budget-a, ne dupli if u `run-denis-turn`. Ne patchovati MENU_BROWSE regex — prebaciti u belief `commerce.menu_inquiry` iz compileBeliefs. Kad L3 stabilan: `resolvePerceivePlan` postaje thin fallback samo za `topGoal === null` (legacy chat bez flow). Ne držati `isCasualSocialGuestMessage` / `looksLikeOrderLine` u routing-u — eval-only ili analytics.

5. **Kako testirati da je gotovo:**
   - `pnpm eval:denis` — `L3 interpretation task goal-directed eval passes (ARCH-7 / C12)` + waiter parity 100% (nema `goal.guest_seated.social` na order line)
   - `pnpm vitest run src/__tests__/interpretation-task.test.ts` — vague recommend + open cart → `goal.complete_round.transactional`, UPSELL_ONCE + food words → relational
   - `grep -rn "vague_recommend\|conversation.pure_social" src/lib/denis/cognition/tde/decide-turn-plan.ts` → 0 u goal-directed putu (samo legacy fallback)
   - Shadow diff: isti guest message, različit `topGoal` → različit `InterpretationSchema` u turn profile / timeline meta
   - iota pilot: collect + cart + „preporuči mi nešto“ → perceive transactional (cart add intent), ne relational banter; browse „Zdravo“ → relational social schema
   - Proširiti eval na 15+ scenarija (DE/EN/SR, upsell_food, pending slot) pre oznake C12 COMPLETE u ADR-035

6. **Koliko nedelja realno:** C12 stub (task builder + goal-directed DECIDE + 4 eval scenarija) = **1 sesija** (DONE). Do MAKSIMUM-a (Zod schema perceive, secondary goals, obrisati regex perceive routing, shadow diff, 15+ eval, iota pilot gate) = **3–4 nedelje** po ADR-035 C12 (4–8 nedelja track). Sa C7 evidence tier budget + C11 playbook u istom perceive putu = **+1 nedelja** integracije — ukupno **~4–5 nedelja** do ARCH-7 COMPLETE merljivo na pilota, ne samo na `decideTurnPlan` fixture-u.

---

## AGENT-26

**PR:** ADR-033 AGENT-26 · ADR-023 MR-8 (Manifest promote gate + timeline sim u CI)

1. **Šta sam radio:** Uveo manifest promote gate CI fixture (`runManifestPromoteGateFixture` + iota timeline sim replay), povezao `manifestPromoteGate` u `runPilotGate`, i proširio quality contract sa `timelineObligationPassRate` — `pnpm eval:denis` blokira promote kad timeline sim ili eval regresira.

2. **Šta je danas slabo:** Promote gate u CI testira **deterministički reflex sim** (`runManifestCompareSim`), ne pun TDE/obligation replay — admin promote i dalje zahteva live `sessionId` + DB timeline, eval ne dokazuje da je isti sim kao u admin panelu. `evaluateManifestPromoteGate` na svaki poziv ponovo pokreće `runQualityContractEval` (ceo eval suite) — sporo i duplo sa pilot gate-om. Nema production JSON timeline exporta za manifest vN vs vN+1 counterfactual — samo TS helperi iz iota obligation scenarija. `shadowParityMin` u quality contract-u nije enforced u `evaluateQualityContract`. CI već pokreće `eval:denis`, ali nema posebnog job-a „manifest promote only“ za brži feedback na manifest PR-ovima.

3. **MAKSIMUM za Manifest + sim (MR-8 / ADR-023 §9–§10):**
   - **Stubovi:** `eval/fixtures/manifest/promote-gate-scenarios.ts` · `eval/run-manifest-promote-gate-fixture.ts` · `eval/run-manifest-promote-gate.ts` (`evaluateManifestPromoteGate`, `evaluateSimRegression`) · `cognition/manifest/manifest-promote-gate.ts` (`manifestRequiresTimelineSim`) · `eval/run-venue-sim.ts` (`runManifestCompareSim`) · `eval/quality-contract-eval.ts` (timeline + eval pass min)
   - **Fajlovi:** admin `promoteVenueManifest` → gate check → `buildPromotedStoragePatch` · `components/admin/denis-manifest-promote-panel.tsx` (sim report preview) · CI `.github/workflows/ci.yml` → `pnpm eval:denis` · pilot gate uključuje `manifestPromoteGate.ok`
   - **Pravila:** policy/capability delta → **obavezan** timeline replay pre promote · sim regression = conflict turns ↑ ili recap T0 loss · quality contract fail → promote blocked · first promote (null current manifest) → sim skip · identity-only delta → sim skip · evalPassMin uključuje min(core, pilot SR, waiter parity, **timeline obligation**)

4. **Šta obrisati / spojiti:** Spojiti `runManifestPromoteGateFixture` sim input sa `run-timeline-obligation-fixture` / `run-venue-sim` — jedan timeline JSON loader, ne tri TS timeline builder-a. `evaluateManifestPromoteGate` ne sme ponovo pokretati ceo eval — prima `QualityContractEvalResult` iz pilot gate-a ili keširani snapshot. Obrisati dupli manifest promote assert van `eval:denis` (držati `manifest-promote-gate.test.ts` samo za unit regression helper). Kad pun TDE sim stabilan: `runManifestCompareSim` proširiti na `decideTurnPlan` replay, ne samo `planTurnWithReflex`. Ne patchovati admin panel sa novim violation stringovima — jedan `ManifestPromoteGateResult` contract.

5. **Kako testirati da je gotovo:**
   - `pnpm eval:denis` — `manifest promote gate + timeline sim passes (ADR-023 MR-8 / AGENT-26)` + `full pilot gate is green` PASS
   - `pnpm test:run src/__tests__/manifest-promote-gate.test.ts` — policy delta blocks without session, sim regression flags conflict
   - `runPilotGate().manifestPromoteGate.ok` && `qualityContract.violations` prazno
   - Admin: policy change bez session → blocked; sa iota session replay → sim report green → promote succeeds
   - CI: PR sa manifest policy diff ne merge-uje dok `eval:denis` ne PASS (timeline obligation + promote fixture)
   - iota pilot (enterprise): manifest v2 draft → sim replay na poslednjoj shadow sesiji → promote → rollback instant

6. **Koliko nedelja realno:** MR-8 CI stub (fixture + pilot gate + quality contract timeline rate) = **1 sesija** (DONE). Do MAKSIMUM-a (production timeline JSON sim, pun TDE replay, pilot gate bez duplog eval run-a, shadowParity enforced, admin sim = CI sim) = **2–3 nedelje**. Sa MR-9 org manifest pack + custom eval po venue = **+1–2 nedelje** — ukupno **~3–4 nedelje** do „enterprise promote bez regresije“ merljivo na live sesiji, ne samo reflex counterfactual u fixture-u.

---
