# ADR-046 — Stabilization Freeze (Zamrzavanje funkcija i čišćenje)

**Status:** Accepted · **Datum:** 2026-07-03
**Task board:** [ADR-046-task-board.md](ADR-046-task-board.md) · **Agent prompt:** [ADR-046-agent-prompt.md](ADR-046-agent-prompt.md)

## 1. Kontekst — izmereno stanje (2026-07-03)

Projekat je funkcionalan u jezgru (QR → meni → porudžbina → kuhinja → plaćanje), ali je
zatrpan nedovršenim i nepovezanim kodom. Ovo su **izmerene** činjenice, ne utisak:

| Metrika | Vrednost |
|---|---|
| Linije TS/TSX koda u `src/` | 358.136 (2.578 fajlova) |
| Fajlova samo u `src/lib/denis/` | 770 |
| TypeScript grešaka (`tsc --noEmit`) | **79** |
| Testova koji padaju | **43** (od 2.258) u **24 test-fajla** |
| Nekomitovanih fajlova u radnom direktorijumu | **78** |
| Pada i `denis-architecture-compliance.test.ts` | DA |

Ključni nalaz: sledeći moduli **nisu importovani nigde osim u sopstvenim testovima**
(mrtav kod — napisan, testiran u izolaciji, nigde priključen):

- `src/components/waiter/waiter-table-copilot-card.tsx`
- `src/lib/denis/intelligence/kitchen-demand-intelligence.ts`
- `src/lib/denis/cognition/recovery/recovery-playbook.ts`
- `src/components/dashboard/kitchen-morning-brief-banner.tsx`
- `src/lib/notifications/send-sms.ts`
- `src/lib/denis/venue/ops/run-event-gathering-detection.ts`

Posledica: bugovi u živom proizvodu (jezik, "to je sve" petlja, duplirani chatovi) ne
dobijaju pažnju jer se energija troši na nove module koji ne dodiruju korisnika.

## 2. Odluka

1. **FREEZE:** Nijedna nova funkcija se ne piše dok task board ([ADR-046-task-board.md](ADR-046-task-board.md)) nije prazan. Nema izuzetaka.
2. **Definicija "završeno":** zadatak je završen tek kada je (a) kod uvezan u ekran/rutu
   koju korisnik stvarno vidi ILI obrisan, (b) `pnpm test:run` zelen, (c) `pnpm type-check`
   zelen, (d) `pnpm lint` bez grešaka, (e) `pnpm build` prolazi, (f) status ažuriran na task boardu.
3. **Mrtav kod se briše, ne čuva.** Ako modul nije uvezan ni u jedan korisnički tok i
   nije na roadmapi za tekući mesec — briše se zajedno sa svojim testom. Git čuva istoriju;
   ništa se ne gubi.
4. **Koordinacija agenata:** svaki agent radi ISKLJUČIVO preko task boarda po protokolu
   iz [ADR-046-agent-prompt.md](ADR-046-agent-prompt.md). Jedan agent = jedan zadatak u
   jednom trenutku.
5. **Infrastruktura se NE menja.** Ostajemo na Vercel + Supabase. Nijedan izmereni bug
   nije infrastrukturni — svi su logički/integracioni. VPS se ne kupuje.

## 3. Šta tačno treba da se uradi

### 3.1 Čišćenje radnog direktorijuma (najviši prioritet)

78 nekomitovanih fajlova mora da se trijažira: uvezano + testirano → komituj;
siroče → obriši. Detaljni zadaci: task board, sekcija **A**.

### 3.2 TypeScript greške — svih 79 na nulu

Raspodela po fajlovima (stanje 2026-07-03):

| Fajl | Grešaka |
|---|---|
| `src/lib/denis/venue/copilot/detect-waiter-floor-gaps.ts` | 16 |
| `src/components/waiter/waiter-table-copilot-card.tsx` | 6 |
| `src/__tests__/waiter-copilot-next-level.test.ts` | 6 |
| `src/lib/denis/venue/ops/run-event-gathering-detection.ts` | 4 |
| `src/lib/denis/cognition/lifecycle/resolve-table-lifecycle-context.ts` | 4 |
| `src/lib/admin/format-kitchen-morning-brief.ts` | 4 |
| `src/app/api/kitchen/morning-brief/route.ts` | 4 |
| `src/__tests__/format-kitchen-morning-brief.test.ts` | 4 |
| `src/lib/denis/runtime/orchestrate-table-lifecycle.ts` | 3 |
| `src/__tests__/kitchen-demand-intelligence.test.ts` | 3 |
| `src/lib/denis/venue/copilot/build-waiter-smart-suggestions.ts` | 2 |
| `src/lib/denis/runtime/build-promo-intel-snapshot.ts` | 2 |
| `src/lib/denis/cognition/context/build-menu-engineering-browse-section.ts` | 2 |
| `src/lib/commerce/capabilities/reviews/record-review-request-sent.ts` | 2 |
| `src/__tests__/predictive-recovery-phase4.test.ts` | 2 |
| `src/__tests__/denis-phase5-pilot.test.ts` | 2 |
| ostali (po 1): `load-order-allergy-warnings`, `load-waiter-shift-briefing`, `derive-waiter-floor-vision`, `build-waiter-table-card`, `process-guest-status-inquiry`, `allergy-audit-log`, `load-review-request-stats`, `plan-evidence`, `build-promo-situation-section`, `denis-owner-roi-panel`, `recovery-playbook.test`, `denis-phase2-integrations.test`, admin ROI page | 13 |

Napomena: većina grešaka je u fajlovima koji su ujedno kandidati za brisanje (3.1) —
brisanjem siročića većina grešaka nestaje besplatno.

### 3.3 Testovi — 24 fajla na zeleno

Kompletan spisak padajućih test-fajlova (43 testa):

```
conversation-graph.test.ts          denis-proactive-bar-intelligence.test.ts
denis-architecture-compliance.test.ts  denis-proactive-kitchen-awareness.test.ts
denis-browsing-defer.test.ts        dynamic-vkg.test.ts
denis-conversation-mastery.test.ts  format-kitchen-morning-brief.test.ts
denis-drink-sommelier.test.ts       kitchen-demand-intelligence.test.ts
denis-full-guest-cycle.test.ts      language-intelligence.test.ts
denis-kitchen-mind-link.test.ts     platform-admin.test.ts
denis-offer-beliefs.test.ts         pos-speed-p1-idempotency.test.ts
denis-phase2-integrations.test.ts   predictive-recovery-phase4.test.ts
denis-phase5-pilot.test.ts          preorder-flow.test.ts
promo-intelligence.test.ts          recovery-playbook.test.ts
reorder-intelligence.test.ts        waiter-autonomous-tell.test.ts
```

**Pravilo odluke za svaki pali test:** prvo utvrdi da li test testira ŽELJENO ponašanje
ili STARO ponašanje. Primer: `denis-full-guest-cycle.test.ts` očekuje da se status
odgovara lokalno na klijentu — to je STARO ponašanje; novo (ispravno po ovom ADR-u) je
da status ide na server (`resolve-guest-status-intel.ts` tok). U tom slučaju se menja
TEST, ne kod. Ako test testira željeno ponašanje — menja se KOD.

### 3.4 Živi bugovi iz produkcije (qr-order-iota.vercel.app)

Prijavljeni od vlasnika tokom ručnog testiranja — moraju se reprodukovati i rešiti:

1. **Jezik:** Denis pošalje "Good day! Would you like something to drink…" usred srpske
   konverzacije. Sumnja: proaktivne/scene poruke koriste `menuLocale` ili engleski
   fallback iz `ai.chat.greeting` umesto detektovanog `chatLanguage`.
2. **"to je sve" petlja:** posle završetka porudžbine Denis ponavlja recap umesto da
   zahvali i zatvori rundu; "ne to je sve" ume da se protumači kao izmena porudžbine
   ("Ne mogu sam da promenim #3 — konobar stiže"). Delimično popravljeno u
   `decide-turn-plan.ts` + `perceive-table-guest-command.ts` — mora se verifikovati na produkciji.
3. **Duplirani/fantomski chatovi:** korisnik prijavljuje da se "odjednom pojavljuju neki
   chatovi". Uzrok nepoznat — treba istražiti session/thread kreiranje i realtime pretplate.
4. **PIN poruka u sred toka:** "Vaš PIN stola je 8021" iskače usred potvrde porudžbine,
   prekida konverzaciju. Treba da se prikaže u pravom trenutku (pre prve porudžbine ili u UI, ne kao chat poruka usred toka).
5. **Pogrešan artikal:** na "jedno veliko pivo" Denis odgovorio "1× Pinot Grigio"
   (vino umesto piva). Matching artikala mora da se verifikuje na produkcijskim podacima.

### 3.5 Zlatan tok — jedina mera uspeha

Posle svega gore, ovaj tok mora da radi 20/20 puta na produkciji, na srpskom:

1. Gost skenira QR → dobije pozdrav **na srpskom**
2. "jedno veliko pivo" → Denis prepozna pivo (ne vino), pita da li je to sve
3. "to je sve" → potvrda, porudžbina ide na šank, **bez petlje**
4. "gde je moje pivo?" → pametan odgovor iz statusnog toka (bar load + LLM narracija), bez robotskog templejta
5. Plaćanje prolazi → sesija se čisto zatvara

Svaki od 5 koraka je zaseban zadatak za verifikaciju na task boardu (sekcija **D**).

## 4. Redosled radova (prioritet)

1. **A — Trijaža i čišćenje** (briše većinu TS grešaka i deo testova)
2. **B — Type-check + preostali testovi na zeleno**
3. **C — Živi bugovi iz produkcije**
4. **D — Verifikacija zlatnog toka na produkciji**

Zadaci unutar sekcije mogu paralelno (različiti agenti), ali sekcija B ne počinje
ozbiljno dok A nije gotova — jer A menja skup fajlova koji uopšte postoje.

## 5. Posledice

- Kratkoročno: nema novih funkcija ~1-2 nedelje.
- Dugoročno: zeleni suite znači da regresije iskaču ODMAH, a ne "odjednom u produkciji".
- Obrisani moduli (morning brief, demand intelligence, recovery playbook…) mogu se
  vratiti iz git istorije kad dođu na red — ali tada po pravilu "uvezano ili ne postoji".
