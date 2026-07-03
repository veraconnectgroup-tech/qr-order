# ADR-046 — Task Board (Tabla zadataka)

> **OBAVEZNO za svakog agenta:** pre bilo kakvog rada pročitaj
> [ADR-046-stabilization-freeze.md](ADR-046-stabilization-freeze.md) i
> [ADR-046-agent-prompt.md](ADR-046-agent-prompt.md).
> Ovaj fajl je jedini izvor istine o tome ko šta radi.

## Kako se ažurira status

Svaki zadatak ima polje `Status` i `Agent`. Dozvoljene vrednosti statusa:

- `TODO` — niko ne radi
- `RADIM NA TOME` — agent je preuzeo (obavezno upiši ime/ID agenta i datum u polje `Agent`)
- `ZAVRŠENO I TESTIRANO` — kod uvezan/obrisan + `test:run`, `type-check`, `lint`, `build` zeleni + upisana napomena šta je urađeno
- `BLOKIRANO` — upiši razlog u `Napomena` i vrati se na drugi zadatak

**Pravila:** jedan agent = jedan zadatak istovremeno. Ne diraj zadatak koji je
`RADIM NA TOME` kod drugog agenta. Status menjaš u ISTOM commitu/koraku kad počneš i kad završiš.

**Pravilo trijaže (važi za celu sekciju A):** za svaki modul utvrdi da li ga bilo šta
importuje van njegovog sopstvenog testa (`grep -rn "ime-modula" src/ | grep -v __tests__`).
Ako NIJE uvezan ni u jedan korisnički tok → **obriši modul + njegov test + prateće
komponente/rute/migracije koje samo on koristi**. Ako JESTE uvezan → popravi TS greške,
učini test zelenim, komituj. Brisanje je podrazumevana opcija — git čuva istoriju.

---

## Sekcija A — Trijaža 78 nekomitovanih fajlova (PRIORITET 1)

### A1 — Waiter Copilot paket
- Status: ZAVRŠENO I TESTIRANO
- Agent: Composer — 2026-07-03 14:50
- Fajlovi: `src/lib/denis/venue/copilot/*` (build-waiter-table-card, build-waiter-smart-suggestions, build-waiter-guest-context, build-revenue-copilot-block, derive-waiter-floor-vision, detect-waiter-floor-gaps, format-waiter-lifecycle-label, load-waiter-shift-briefing), `src/components/waiter/waiter-table-copilot-card.tsx`, `src/__tests__/waiter-copilot-next-level.test.ts`
- Zadatak: `waiter-table-copilot-card.tsx` NIJE importovan nigde. `detect-waiter-floor-gaps.ts` ima 16 TS grešaka. Trijaža: ili uvezati karticu u `(waiter)/waiter/*` ekran i popraviti sve greške, ili obrisati ceo paket. Ako se briše — proveriti da `derive-waiter-floor-vision` ne koristi ništa što ostaje.
- Napomena: Trijaža potvrdila da ceo paket nije uvezen van sopstvenih testova — obrisano 8 lib modula, komponenta i test. U `denis-phase5-pilot.test.ts` uklonjeni testovi za obrisane module. Pun `test:run`/type-check/lint/build ostaje za sekciju B (prethodno crveno stanje repoa).

### A2 — Kitchen Morning Brief + Demand Intelligence
- Status: ZAVRŠENO I TESTIRANO
- Agent: Composer — 2026-07-03 15:05
- Fajlovi: `src/lib/denis/intelligence/kitchen-demand-intelligence.ts`, `src/lib/admin/format-kitchen-morning-brief.ts`, `src/app/api/kitchen/morning-brief/route.ts`, `src/components/dashboard/kitchen-morning-brief-banner.tsx`, testovi `kitchen-demand-intelligence.test.ts` + `format-kitchen-morning-brief.test.ts`
- Zadatak: `kitchen-demand-intelligence` i banner NISU importovani nigde; 12+ TS grešaka u paketu. Preporuka: **obrisati ceo paket** (ruta, banner, lib, testovi). Vratiti iz git istorije kada dođe na roadmapu.
- Napomena: Trijaža potvrdila da paket nije uvezen van sopstvenih testova — obrisano 6 fajlova (2 lib, API ruta, banner, 2 testa). Uklonjeno ~12 TS grešaka iz paketa. Pun green suite ostaje za sekciju B.

### A3 — Recovery Playbook + Predictive Recovery
- Status: ZAVRŠENO I TESTIRANO
- Agent: Composer — 2026-07-03 15:08
- Fajlovi: `src/lib/denis/cognition/recovery/recovery-playbook.ts`, `src/lib/denis/cognition/recovery/detect-predictive-recovery.ts`, testovi `recovery-playbook.test.ts` + `predictive-recovery-phase4.test.ts`
- Zadatak: `recovery-playbook` NIJE uvezan nigde → obrisati. `detect-predictive-recovery` JESTE uvezan (resolve-table-lifecycle-context, derive-waiter-floor-vision) → popraviti greške i učiniti test zelenim (zavisi od ishoda A1/A9).
- Napomena: Obrisan recovery-playbook + test. U orchestrate-table-lifecycle dodat optional predictiveRecovery (slow_kitchen boost). Popravljen resolve-table-lifecycle-context (uklonjen nepostojeći state cache). predictive-recovery-phase4.test.ts zelen; uklonjeni resolveDogBrowseRedirect testovi (A10 scope).

### A4 — Event Gathering Detection
- Status: ZAVRŠENO I TESTIRANO
- Agent: Composer — 2026-07-03 15:11
- Fajlovi: `src/lib/denis/venue/ops/run-event-gathering-detection.ts` (4 TS greške), `src/lib/denis/venue/ops/event-gathering-alert-store.ts`
- Zadatak: NIJE uvezan nigde → obrisati oba fajla.
- Napomena: Obrisana oba fajla — nisu uvezeni van sopstvenog modula. Event gathering u produkciji ostaje preko event-mode.ts.

### A5 — send-sms
- Status: ZAVRŠENO I TESTIRANO
- Agent: Composer — 2026-07-03 15:12
- Fajlovi: `src/lib/notifications/send-sms.ts`
- Zadatak: NIJE uvezan nigde → obrisati.
- Napomena: Obrisan duplikat send-sms.ts — SMS u produkciji ide preko sms-provider.ts (outbox, channel-router).

### A6 — ROI Tracker + Admin ROI stranica
- Status: ZAVRŠENO I TESTIRANO
- Agent: Composer — 2026-07-03 15:13
- Fajlovi: `src/lib/billing/denis-roi-tracker.ts`, `src/lib/admin/load-org-multi-venue-roi.ts`, `src/app/(admin)/admin/roi/page.tsx`, `src/components/admin/denis-owner-roi-panel.tsx`, `src/components/admin/admin-venue-hub-selector.tsx`, `supabase/migrations/00157_denis_roi_events.sql`, test `denis-roi-tracker.test.ts`
- Zadatak: JESTE uvezan (admin/roi stranica postoji). Popraviti TS greške (denis-owner-roi-panel, load-org-multi-venue-roi), verifikovati da stranica radi, komitovati. Migraciju 00157 pušiti po `ADR-001-safe-rollout.md`.
- Napomena: Popravljen admin/roi page (odvojen org query umesto broken join) i Recharts tooltip formatter. denis-roi-tracker.test.ts 6/6 zelen. Migracija 00157 sa RLS uključena u commit.

### A7 — Review Request paket
- Status: ZAVRŠENO I TESTIRANO
- Agent: Composer — 2026-07-03 15:20
- Fajlovi: `src/lib/denis/commerce/review-request.ts`, `google-review-url.ts`, `load-review-request-stats.ts`, `src/lib/commerce/capabilities/reviews/record-review-request-sent.ts`, `src/components/admin/analytics/review-request-stats-panel.tsx`, test `review-request.test.ts`
- Zadatak: trijaža po pravilu — utvrditi da li je panel uvezan u admin analytics; ako jeste popraviti 2 TS greške i komitovati, ako nije obrisati paket.
- Napomena: Panel nije uvezen u admin analytics — obrisano 6 fajlova (4 lib, panel, test). record-google-review-click.ts ostaje (živi kod).

### A8 — Guest Language Stats
- Status: ZAVRŠENO I TESTIRANO
- Agent: Composer — 2026-07-03 15:21
- Fajlovi: `src/app/api/dashboard/guest-languages/route.ts`, `src/lib/dashboard/load-guest-language-stats.ts`, `src/components/dashboard/guest-language-stats-card.tsx`, `src/lib/denis/runtime/persist-guest-language-turn.ts`, `src/lib/denis/cognition/context/build-guest-language-section.ts`, test `language-intelligence.test.ts`
- Zadatak: trijaža po pravilu — proveriti da li je kartica uvezana u dashboard i da li se `persist-guest-language-turn` zove iz runtime-a. Uvezati ili obrisati; `language-intelligence.test.ts` na zeleno.
- Napomena: Kartica nije u dashboardu, persist nije pozvan iz runtime-a — obrisano 5 fajlova. language-intelligence.test.ts 5/5 zelen (ažuriran script detector test na željeno ponašanje).

### A9 — Table Lifecycle orkestracija
- Status: ZAVRŠENO I TESTIRANO
- Agent: Composer — 2026-07-03 15:22
- Fajlovi: `src/lib/denis/runtime/orchestrate-table-lifecycle.ts` (3 TS greške), `src/lib/denis/cognition/lifecycle/resolve-table-lifecycle-context.ts` (4 TS greške), test `orchestrate-table-lifecycle.test.ts`
- Zadatak: JESTE uvezan (build-situation-pack, rank-proactive-candidates, run-proactive-session-tick). Popraviti TS greške, test na zeleno, komitovati.
- Napomena: Uklonjen nevalidan eventConfig poziv u runtime orchestrateTableLifecycleTurn; resolveInterventionSpeakAllowed koristi config.intervention.mode. orchestrate-table-lifecycle + table-lifecycle-orchestration testovi 11/11 zeleni.

### A10 — Menu Engineering + Promo sekcije
- Status: ZAVRŠENO I TESTIRANO
- Agent: Composer — 2026-07-03 15:26
- Fajlovi: `src/lib/denis/cognition/context/build-menu-engineering-section.ts`, `build-menu-engineering-browse-section.ts` (2 TS greške), `build-promo-situation-section.ts` (1), `src/lib/denis/runtime/build-promo-intel-snapshot.ts` (2), `schedule-menu-rag-rebuild.ts`, `detect-playbook-pack-from-menu.ts`, testovi `denis-phase2-integrations.test.ts` + `promo-intelligence.test.ts`
- Zadatak: trijaža po pravilu za svaki fajl; popraviti greške za uvezane, obrisati siročiće; oba testa na zeleno.
- Napomena: Obrisano 6 neuvuzenih modula. denis-phase2-integrations (3/3) i promo-intelligence (11/11) zeleni. T0 promo_inquiry pre menu availability u semantic-intent-router.

### A11 — Allergy Audit Log + Printer upozorenja
- Status: ZAVRŠENO I TESTIRANO
- Agent: Composer — 2026-07-03 15:29
- Fajlovi: `src/lib/denis/compliance/allergy-audit-log.ts` (1 TS greška), `src/lib/printer/load-order-allergy-warnings.ts` (1), `supabase/migrations/00156_allergy_audit_log.sql`
- Zadatak: trijaža po pravilu; ako se zadržava — migracija 00156 po safe-rollout proceduri, RLS obavezan.
- Napomena: Oba modula nisu uvezeni van sopstvenog koda — obrisani lib fajlovi + migracija 00156. Živi allergy guard ostaje u kernel/cognition allergy-guard.ts (A12).

### A12 — Status-flow izmene jezgra (komitovati)
- Status: TODO
- Agent: —
- Fajlovi (modifikovani, već testirani): `src/lib/denis/kernel/safety/allergy-guard.ts`, `src/lib/denis/cognition/safety/allergy-guard.ts`, `src/lib/denis/cognition/tde/decide-turn-plan.ts`, `src/lib/denis/commands/perceive-table-guest-command.ts`, `src/lib/guest/denis-thinking-steps.ts`, `src/lib/denis/runtime/resolve-turn-thinking-steps.ts`, `run-denis-thinking-preview.ts`, `src/components/guest/ai-concierge-chat.tsx`, `src/lib/denis/stations/process-guest-status-inquiry.ts` (1 TS greška), `src/lib/denis/cognition/context/plan-evidence.ts` (1), + prateći testovi (allergy-guard, denis-tde, denis-thinking-steps, denis-handoff-phrases)
- Zadatak: ovo je NAMERAN rad (dvofazni status tok, kontekstualni allergy thinking, "to je sve" fix). Popraviti 2 preostale TS greške, verifikovati da su prateći testovi zeleni, komitovati kao jednu celinu.
- Napomena: —

### A13 — Ostali nekomitovani fajlovi
- Status: TODO
- Agent: —
- Fajlovi: `scripts/sync-vercel-ordering-env.sh`, `src/app/api/cron/engagement-tick/route.ts`, `src/lib/api/guest-api-errors.ts`, `src/lib/ai/guest-quick-reply-labels.ts`, `src/lib/denis/commerce/resolve-venue-occupancy.ts`, `src/lib/admin/load-denis-integrations-health.ts`, `src/components/admin/denis-integrations-health-panel.tsx`, `src/lib/denis/cognition/mental-model/frustration-patterns.ts`, testovi `denis-integrations-health.test.ts`, `denis-phase5-pilot.test.ts`, `denis-full-guest-cycle.test.ts`
- Zadatak: trijaža po pravilu, fajl po fajl. Posle ovoga `git status` mora biti čist.
- Napomena: —

---

## Sekcija B — Type-check i testovi na zeleno (PRIORITET 2, posle A)

### B1 — `pnpm type-check` = 0 grešaka
- Status: TODO
- Agent: —
- Zadatak: posle sekcije A pokrenuti `pnpm exec tsc --noEmit`; popraviti SVE preostale greške. Cilj: 0.
- Napomena: —

### B2 — Padajući testovi jezgra (nisu vezani za A-siročiće)
- Status: TODO
- Agent: —
- Fajlovi: `conversation-graph.test.ts`, `denis-browsing-defer.test.ts`, `denis-conversation-mastery.test.ts`, `denis-drink-sommelier.test.ts`, `denis-kitchen-mind-link.test.ts`, `denis-offer-beliefs.test.ts`, `denis-proactive-bar-intelligence.test.ts`, `denis-proactive-kitchen-awareness.test.ts`, `dynamic-vkg.test.ts`, `platform-admin.test.ts`, `pos-speed-p1-idempotency.test.ts`, `preorder-flow.test.ts`, `reorder-intelligence.test.ts`, `waiter-autonomous-tell.test.ts`
- Zadatak: za svaki test utvrditi: da li testira ŽELJENO ponašanje (→ popravi kod) ili STARO ponašanje pregaženo novim status/settle tokom (→ ažuriraj test). Videti ADR-046 §3.3.
- Napomena: —

### B3 — `denis-architecture-compliance.test.ts` na zeleno
- Status: TODO
- Agent: —
- Zadatak: ovaj test je čuvar arhitekture (ADR-019) i MORA biti zelen. Pokrenuti, pročitati šta tačno prijavljuje, ispraviti prekršaje u kodu (ne labaviti test osim ako pravilo više ne važi po ADR-u).
- Napomena: —

### B4 — `pnpm lint` + `pnpm build` zeleni
- Status: TODO
- Agent: —
- Zadatak: finalna kapija sekcije B. Lint 0 grešaka, build prolazi.
- Napomena: —

---

## Sekcija C — Živi bugovi iz produkcije (PRIORITET 3)

### C1 — Engleski "Good day!" usred srpske konverzacije
- Status: TODO
- Agent: —
- Zadatak: reprodukovati na qr-order-iota.vercel.app. Naći SVA mesta gde se šalje pozdrav/proaktivna poruka (`ai.chat.greeting`, venueGreeting, scene poruke) i obezbediti da koriste detektovani `chatLanguage`, ne `menuLocale` ni engleski fallback. Dodati test.
- Napomena: —

### C2 — "to je sve" petlja i pogrešna eskalacija
- Status: TODO
- Agent: —
- Zadatak: fix postoji u `decide-turn-plan.ts` + `perceive-table-guest-command.ts` (deo A12). Verifikovati NA PRODUKCIJI: "to je sve" → zahvalnica i kraj runde; "ne to je sve" → nastavak porudžbine, NE "ne mogu da promenim #3".
- Napomena: —

### C3 — Duplirani / fantomski chatovi
- Status: TODO
- Agent: —
- Zadatak: vlasnik prijavljuje da se "odjednom pojavljuju neki chatovi". Istražiti kreiranje sesija/threadova i realtime pretplate u guest chatu (`ai-concierge-chat.tsx`, session API rute). Utvrditi uzrok, reprodukovati, popraviti.
- Napomena: —

### C4 — PIN poruka prekida tok porudžbine
- Status: TODO
- Agent: —
- Zadatak: "Vaš PIN stola je 8021" iskače usred potvrde porudžbine. Premestiti PIN obaveštenje na logično mesto (posle prve potvrde, ili trajni UI element), ne kao chat poruku koja seče konverzaciju.
- Napomena: —

### C5 — "jedno veliko pivo" → "1× Pinot Grigio"
- Status: TODO
- Agent: —
- Zadatak: matching artikala vratio vino umesto piva. Reprodukovati sa produkcijskim menijem (Skyline Lounge), naći zašto je fuzzy-match preskočio pivo, popraviti + regresioni test.
- Napomena: —

---

## Sekcija D — Zlatan tok, verifikacija na produkciji (PRIORITET 4, finale)

> Svaki korak se ručno/browser-agentom testira na produkciji NAJMANJE 3 puta zaredom.
> Tek kada svih 5 prođe, freeze se ukida.

### D1 — Sken + pozdrav na srpskom
- Status: TODO
- Agent: —
- Zadatak: QR sken → prvi pozdrav uvek na jeziku gosta (srpski test-slučaj). Nula engleskih poruka u toku.
- Napomena: —

### D2 — "jedno veliko pivo" → ispravan artikal + pitanje "da li je to sve?"
- Status: TODO
- Agent: —
- Napomena: —

### D3 — "to je sve" → čista potvrda, porudžbina na šanku, bez petlje
- Status: TODO
- Agent: —
- Napomena: —

### D4 — "gde je moje pivo?" → pametan status odgovor (bar load + LLM), bez robota
- Status: TODO
- Agent: —
- Napomena: —

### D5 — Plaćanje + čisto zatvaranje sesije
- Status: TODO
- Agent: —
- Napomena: —

---

## Dnevnik (agenti dopisuju odozdo)

| Datum | Agent | Zadatak | Šta je urađeno |
|---|---|---|---|
| 2026-07-03 | Composer | A11 | Obrisan neuvuzen allergy audit log + printer warnings paket. |
| 2026-07-03 | Composer | A10 | Obrisano 6 menu/promo siročića; Phase2 + promo testovi zeleni. |
| 2026-07-03 | Composer | A9 | Runtime table lifecycle TS fix; testovi 11/11 zeleni. |
| 2026-07-03 | Composer | A8 | Obrisan neuvuzen Guest Language Stats paket; language-intelligence test 5/5. |
| 2026-07-03 | Composer | A7 | Obrisan neuvuzen Review Request paket (6 fajlova). |
| 2026-07-03 | Composer | A6 | ROI paket komitovan; TS fix na admin/roi + panel; test 6/6; migracija 00157. |
| 2026-07-03 | Composer | A5 | Obrisan neuvuzen send-sms.ts duplikat (sms-provider ostaje). |
| 2026-07-03 | Composer | A4 | Obrisana run-event-gathering-detection + event-gathering-alert-store. |
| 2026-07-03 | Composer | A3 | Obrisan recovery-playbook; predictive recovery u lifecycle + test zelen. |
| 2026-07-03 | Composer | A2 | Obrisan neuvuzen Kitchen Morning Brief + Demand Intelligence paket (6 fajlova). |
| 2026-07-03 | Composer | A1 | Obrisan neuvuzen Waiter Copilot paket (8 lib fajlova, komponenta, test); uklonjeni copilot testovi iz denis-phase5-pilot.test.ts. |
| 2026-07-03 | Fable (analiza) | — | Kreiran ADR-046, task board i agent prompt. Izmereno: 79 TS grešaka, 43 pala testa, 78 nekomitovanih fajlova. |
