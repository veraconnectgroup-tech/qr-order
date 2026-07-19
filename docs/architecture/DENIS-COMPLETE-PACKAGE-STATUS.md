# Denis — analiza stanja: šta je dodato, šta nedostaje, plan do "kompletnog paketa"

Datum: 2026-07-17 (ažurirano) · Autor: Claude (na zahtev osnivača) · Svaka tvrdnja ispod je proverena direktno u kodu, ne iz sećanja.

**Ako čitaš ovo kao nov agent bez pristupa prethodnom razgovoru:** ovo je živi dokument. Pre nego što bilo šta predložiš kao "sledeći korak", proveri `git log --oneline -30` da vidiš da li se nešto od ovoga u međuvremenu promenilo — ovaj fajl se ažurira posle svake veće runde rada, ali može zaostati par commit-a. Ne kreni ništa iznova a da prvo ne proveriš da li već postoji.

---

## DEO 0 — ŠTA SE PROMENILO OD PRETHODNE VERZIJE OVOG DOKUMENTA (16.07 → 17.07)

Prethodna verzija (16.07) je imala "42 lokalna commit-a ispred GitHub-a" kao najveći rizik i 4 stanice-glasovne sposobnosti (M2/M3/M6/M8) na listi "nedostaje potpuno". Sve to je od tada urađeno i zatvoreno:

1. **A1 (GitHub push) — REŠENO.** Root cause je bio pogrešan aktivan `gh` nalog (`veraitglobal-sketch` umesto `veraconnectgroup-tech`), ne prava permisija. `gh auth switch` + push je prošao. Sve je na GitHub-u osim jednog svežeg commit-a (vidi Deo 2.A).
2. **A2 (migracije) — REŠENO.** Svih 6 zaostalih migracija (`00166`–`00171`: denis_missions, restaurant_knowledge_rule_lifecycle, integration_builder, integration_approval_requests, integration_credentials, waiter_calls_reason) primenjeno na živu bazu, uz tvoju eksplicitnu potvrdu.
3. **C1/C2/C3/C4 (ADR-053 M3/M2/M8/M6) — SVE ZAVRŠENO.** Svih 8 M-sposobnosti iz ADR-053 (M1–M8) sad postoji u kodu, testirano, commitovano. Detalji u Deo 1.3.
4. **Novo: guest→konobar handoff nosi pravi razlog gosta.** Ranije je "pozovi konobara" stizalo do osoblja kao prazan signal — sad free-text detekcija (T0) i sve postojeće handoff putanje prenose gostove reči.
5. **Novo: `needsStaffHelp` — LLM-driven univerzalna eskalacija.** Osnivačev direktan zahtev: *Denis mora da uradi sve što ume konobar da uradi, a gde ne može sam, mora da nađe način.* T0 regex hvata samo usko "pozovi konobara". Ovo zatvara ostatak: kad gost zatraži nešto što Denis nema direktan alat da uradi (dodatne stavke, popust, izgubljena stvar, promena stola...), LLM postavlja `needsStaffHelp` polje (opis, ne odluku), a `runtime` sloj (ne `cognition` — poštuje layer boundary) izvršava pravi handoff sa tim razlogom. Ojačano sa 7 srpskih few-shot primera u promptu.
6. **Stvaran bag pronađen i popravljen: M4 glasovni `create_mission` je bio tiho slomljen u produkciji.** `denis_missions` tabela nije postojala na živoj bazi do jučerašnje primene migracija — svaki poziv "napravi zadatak" glasom je vraćao `insert_failed` bez ijednog vidljivog znaka osoblju. Sad radi (tabela + RLS provereni, insert kolone se poklapaju).
7. **Stvaran bag pronađen i popravljen: pogrešna uputstva za deljenje računa.** Provereno u kodu: samouslužno deljenje računa VEĆ POSTOJI ("Podeli račun" dugme na ekranu računa gosta, Stripe-backed) — ali prompt je Denisu govorio suprotno, da to ne može sam i da mora da zove osoblje. Ispravljeno: Denis sad upućuje gosta na postojeće dugme.
8. **Stvaran bag pronađen i popravljen: nedostajali srpski/hrvatski/turski prevodi za ceo split-bill ekran.** Postojali su samo nemački/engleski — srpski gost je video engleski tekst. Dodato svih 20 ključeva za sr/hr/tr.

Test svita posle svega ovoga: **415 fajlova / 2.754 testa, zeleno.** tsc: 0 grešaka. `verify:denis`: 2/2 zeleno.

---

## DEO 0.5 — Supabase ispad (17.07) + "probudi sve" runda

**Incident:** Supabase organizacija je pala u "Services restricted" (402 na sve) zbog **Realtime Connection Count Exceeded** — 3.761 istovremenih konekcija naspram limita od 200 (1.881%!), egres 107% (sporedni faktor). Pravi uzrok: `/api/orders/[orderId]/stream` je otvarao pravi Supabase Realtime kanal iz serverless funkcije bez `maxDuration` — platforma je često ubijala funkciju pre nego što je stigla da zatvori kanal, ostavljajući "obešene" konekcije. Ta ruta se učitava kod SVAKOG gosta odmah posle porudžbine, ceo obrok, sa auto-reconnect-om. **Popravljeno**: zamenjen pravim polling-om (isti obrazac kao `denis/view/stream`), nula Realtime kanala se otvara sa servera. Sporedno: slike proizvoda su se slale kao sirovi originali mimo Next.js optimizacije — popravljeno na 2 mesta.

**Ovo NE vraća pristup koji je već blokiran** — samo sprečava ponavljanje. Pristup se vraća isključivo kroz Supabase Billing (nadogradnja plana ili čekanje reset perioda 25.07).

**Dok se to čeka, "probudi sve što imamo" runda** (osnivačev direktan zahtev — sve što je izgrađeno a "spava" treba probuditi do kraja, i ubuduće nikad ostavljati stvari u tom stanju): sve DB-nezavisne stavke iz stare liste "2.C nedostaje potpuno" su završene:
- Split-bill prevodi kompletni za SVIH 8 podržanih jezika (sr/hr/tr + ar/es/fr/it/ru) — uz usput uočenu i ispravljenu grešku u ruskom prevodu.
- POS katalog (`CONNECTOR_CATALOG`) sad ispravno prikazuje `ready2order`/`custom` svuda.
- Station-voice (M1-M8) dobio jedan zajednički admission-gate (`config.ops.stationQuestions.rollout`) za postepeno puštanje po lokaciji, umesto zauvek-po-flagu.
- Agentic Tool Loop dobio eksplicitnu (ne tihu) odluku o naplati dodatnih rundi (`creditsPerExtraRound`, default 0 = bez premije, svesna odluka ne propust).
- **SecretsManager admin UI** izgrađen (`/admin/integration-credentials`) — pgcrypto backend je postojao od migracije, sad ima i formu za unos.
- **Integration Builder cevovod POVEZAN prvi put ikad** (`/admin/integration-builder`): nalepi OpenAPI/Postman dokument → parsira → LLM-assisted capability discovery → deterministički mapper → čekiraj šta generisati → nacrt TypeScript adaptera. Dokazano pravim smoke testom (ne mock) — realan OpenAPI spec je proizveo ispravan radni adapter kroz ceo lanac. DB perzistencija (integration_documents/capabilities/adapter_versions) SVESNO odložena dok Supabase ne proradi — ne može se testirati protiv žive baze sada.
- Ispitano i zaključeno (ne kod): specifična obrada za "popust"/"promena stola" u `needsStaffHelp` nije potrebna — generička eskalacija je već ispravno ponašanje za oba, za razliku od split-bill slučaja gde je stvarno postojala ignorisana sposobnost.

Sve što ostaje (B1-B8, C8 dole) je **blokirano isključivo na Supabase pristupu** — ne na nedostajućem kodu.

---

## DEO 1 — ŠTA JE DODATO (isporučeno, testirano, commitovano)

### 1.1 Mozak — razumevanje gosta (regex purge, kompletno)
Celokupno razumevanje gostovog jezika prebačeno sa regex šablona na pravo LLM razumevanje: segmentacija porudžbine, veličine/kategorije, modifikatori, zamene, otkazivanje stavki. Regex preživeo samo kao dokumentovan fallback za T0 refleks i ispad LLM-a. **Završena inicijativa.**

### 1.2 Agentic Tool-Use Loop (ADR-049) — Denis proverava umesto da nagađa
- Kompletna infrastruktura P0–P3: tool-calling u OpenAI klijentu, read-only alati (kuhinja/zalihe/račun), side-effecting alati kroz ACL sa dry-run, eval scenariji (30/30 zeleno).
- **Uključen u shadow mode na 100% razgovora** — svaki pravi gostov razgovor loguje šta bi loop uradio (`agentic.shadow_trace`), gost ništa ne primećuje.

### 1.3 Station voice — Denis kao kolega u kuhinji i za šankom (ADR-053) — SVIH 8 M-sposobnosti ZAVRŠENO
- **P1 — hands-free uho**: tablet lokalno sluša "hej Denise", vidljiva oznaka "Denis sluša". Ugašeno po defaultu.
- **M1 — glasovni 86**: "skini lososa" skida artikal, propose→confirm gate (Redis, fail-closed).
- **M2 — "roštilj kasni 10 min" glasom**: ops beleška preko `venue-delay-note.ts` (Redis, TTL skalira sa dužinom kašnjenja), gosti sa tim stavkama dobijaju realan rok.
- **M3 — "spremno za sto dvanaest" glasom**: `resolve-spoken-table.ts` parsira izgovorene brojeve (uključujući srpsku zamku "sto" = i "sto" i "100" — rešeno tretiranjem "sto" kao filler reči), označava ready, zove runnera.
- **M4 — glasovni zadaci**: "podseti Marka da donese led" pravi pravu misiju + push notifikaciju.
- **M5 — proaktivno SLA upozorenje**: Denis pita kuhinju PRE roka. Ugašeno po defaultu.
- **M6 — čitanje novih bonova naglas** (opt-in po lokaciji): `new-order-announcement.ts`, realtime detekcija, najniži prioritet u red za govor.
- **M8 — "šta je ostalo otvoreno?" (kraj smene)**: `read_open_items` alat — misije + obećanja + 86 lista, read-only.
- Dvosmerni WebRTC "Pozovi Denisa" razgovor sa alatima, streaming TTS, tone shading (urgency/chaos/respect), obećanja + dnevnik aktivnosti.

### 1.4 Unified Operational Context (ADR-048) — jedna slika umesto dve
- **10% pilot, live**: "kuhinja pretrpana + ovaj gost nestrpljiv" stiže do gosta kao jedna povezana poruka.

### 1.5 Policy Engine — emocionalna/relaciona inteligencija
- Deterministički ladder + tracker (shadow), mission na handoff tier (stvarno piše `denis_missions` red kad `shadowOnly=false` — danas i dalje shadow po defaultu), rule-proposal state machine (trajno pravilo vs jednokratni izuzetak).
- LLM assessment (`assess-guest-conduct.ts`) postoji i radi — regex (`abuse-protection.ts`) je samo outage fallback kad LLM poziv ne uspe, nikad kombinovan sa njim.

### 1.6 Integration Builder (ADR-052) — Denis gradi sopstvene integracije
- Faze 0–5 izgrađene: OpenAPI/Postman parseri, capability mapper, adapter generator, contract test generator, SandboxRunner (mock-only), repair loop (max 3 runde), human review workflow, SecretsManager (pgcrypto, fail-closed).
- DB šema (`integration_builder`, `integration_approval_requests`, `integration_credentials`) sad primenjena na živu bazu (bila je samo u repo-u do 17.07).
- **Cevovod POVEZAN prvi put** (`/admin/integration-builder`, 17.07): parse → capability discovery → mapper → generator, sve u jednom stvarnom toku, dokazano smoke testom (pravi OpenAPI spec → ispravan generisan adapter). DB perzistencija koraka (dokument/capabilities/adapter_versions redovi) namerno odložena dok Supabase ne proradi.
- **SecretsManager admin UI** (`/admin/integration-credentials`, 17.07): forma za unos + lista metapodataka, backend nepromenjen.

### 1.7 Univerzalni guest→osoblje handoff — "Denis mora da nađe način"
- Reason-threading kroz SVE handoff putanje (T0 free-text, chip tap, frustration recovery, proaktivni nudge).
- `needsStaffHelp`: LLM-driven eskalacija za sve što Denis nema direktan alat da uradi sam — detalji u Deo 0, tačka 5.

### 1.8 Celokupna revizija projekta ("nije povezano / nije završeno")
- Pravi bagovi popravljeni: A/B config se stvarno primenjuje, POS connect odbija neizgrađene providere, denis_missions UI, feedback_inbox čitalac, ROI nav link, loyalty_rewards u level-up čestitci, `recordLiveAbSessionMetrics` povezan.
- ~5.200 linija mrtvog koda obrisano — svaki korak verifikovan punom svitom.
- **Nova runda (17.07)**: M4 create_mission produkcijski bag (tabela nije postojala), pogrešna split-bill uputstva u promptu, nedostajući sr/hr/tr prevodi za split ekran.

### 1.9 Bezbednost i higijena
- Webhook signature bypass zatvoren, capability awareness stigla do gostovog chata, template-injection bug u SandboxRunner-u popravljen.

---

## DEO 2 — ŠTA JOŠ TREBA (iskrena lista, po kategoriji)

### 2.A BLOKIRANO NA TEBI (niko drugi ne može)

| # | Šta | Status |
|---|-----|--------|
| A1 | ~~GitHub push~~ | **REŠENO** — commit-i se redovno pushuju uz tvoju potvrdu svaki put. |
| A2 | ~~Migracije na živu bazu~~ | **REŠENO** — svih 6 primenjeno 17.07. |
| A3 | **P0 test na pravom uređaju** | I DALJE ČEKA. `/admin/denis-realtime-voice-test` na tabletu u kuhinji — sat vremena tvog slušanja. Go/no-go za Realtime migraciju (jedini preostali veliki station-voice skok). |
| A4 | **Supabase organizacija suspendovana (17.07)** | NOVO, NAJHITNIJE. "Services restricted" — Realtime Connection Count 1.881% preko limita + egres 107%. Root cause POPRAVLJEN u kodu (Deo 0.5), ali sam pristup se vraća SAMO kroz Supabase Billing (nadogradnja plana ili čekanje reset perioda 25.07 — Dashboard → Organization → Settings → Billing → "Resolve billing issues"). Dok ovo traje, SVE B/C stavke dole koje pominju bazu su blokirane. |

### 2.B IZGRAĐENO ALI UGAŠENO (čeka odluku o rollout-u, ne kod)

| # | Flag/mehanizam | Stanje | Sledeći korak |
|---|----------------|--------|---------------|
| B1 | Agentic Tool Loop | shadow, 100% loguje | Pregled transkripta → 5% live canary |
| B2 | Unified Operational Context | **10% live** | Pratiti → 25% → 100% |
| B3 | Guest Conduct ladder | shadow (LLM assessment aktivan) | Pregled `conduct.policy_decision` eventa → warn_1 live |
| B4 | Hands-free uho (`handsFreeWakeWordEnabled`) | off | Posle A3 → uključiti za jednu lokaciju |
| B5 | SLA pre-warn (`slaPreWarnEnabled`) | off | Uključiti za jednu lokaciju |
| B6 | Kuhinja→bar eskalacija (`escalateToBarEnabled`) | off | Odluka + flip |
| B7 | `stationAwareTell`, `floorGraphEnabled` | off | Odluka + flip |
| B8 | M6 čitanje bonova (`readBonsAloudEnabled`) | off | Odluka + flip po lokaciji |

### 2.C NEDOSTAJE POTPUNO — kod koji treba napisati

Sve DB-nezavisne stavke iz ove liste (bivši C1-C5, C10-C13, C15-C16) su završene 17.07 (Deo 0.5). Ostaje samo ono što stvarno zahteva A3 (uređaj) ili A4 (Supabase):

**Station voice:**
| # | Šta | Težina | Blokirano na |
|---|-----|--------|---------------|
| C6 | **Realtime migracija question strip-a**: pitanja ulaze u isti kanal, stari TTS ostaje T3 fallback | Veliko | A3 |
| ~~C7~~ | ~~Pun dvosmerni cross-station prenos Denisovim glasom~~ | **ZAVRŠENO (19.07)** — `6ded65ab`/`a86a0203` su zatvorili krug: simetričan round-trip kuhinja↔šank (create → izgovori-na-cilju → uhvati-odgovor push-to-talk-svesno → izgovori-nazad sa ispravnim imenom stanice → potvrda → expiry-najava). Ostaje samo: nema live e2e testa celog kruga sa pravim realtime-om — verifikacija na uređaju kad A3 prođe. |

**Guest-facing mozak:**
| # | Šta | Težina | Blokirano na |
|---|-----|--------|---------------|
| C8 | Prvi PRAVI A/B eksperiment od početka do kraja — dokaz da flywheel radi | Malo (operativno) | A4 |

**Platforma / biznis:**
| # | Šta | Težina | Blokirano na |
|---|-----|--------|---------------|
| C11b | Integration Builder: perzistencija (integration_documents/capabilities/adapter_versions redovi) + prvi pravi adapter kroz PRAVI vendor doc do kraja (upload UI+cevovod gotovi 17.07, ostaje samo DB deo + probni vendor) | Malo-srednje | A4 |
| C14 | Denis ROI stranica — provera da li pokazuje pun ROI narativ sad kad se svi podaci skupljaju | Malo | A4 (treba prave podatke da se proceni) |

**Dugoročno (svesno odloženo, ne za sad):**
- Cross-visit identitet gosta (privacy odluka), `denis_relationship_signals` resurekcija, multi-venue learning na punoj snazi, browser-automation konektori, eksterni vault, split-bill prevodi za jezike van trenutnih 8 (nisu ni tražena podrška za njih).

---

## DEO 3 — PREDLOG: REDOSLED DO "KOMPLETNOG PAKETA"

### Korak 0 — tvoje akcije
1. **A4: reši Supabase naplatu** — nadogradi plan ili sačekaj reset 25.07. Bez ovoga NIŠTA od B1-B8/C8/C11b ne može da se pomeri, bez obzira koliko koda postoji.
2. **A3: P0 test na tabletu** — sat vremena, otključava ceo Realtime pravac (C6).

### Korak 1 — Kuhinja/šank kompletan
Svih 8 M-sposobnosti gotovo, admission-gate (C5) gotov, C7 (cross-station prenos) gotov 19.07. Ostaje: B4/B5/B8 flip za pilot lokaciju čim A3 i A4 prođu.
→ **Rezultat: Denis u kuhinji ume da čuje, uradi, upozori, prenese i podnese izveštaj — pun kolega. Kod strane, samo rollout odluke ostaju.**

### Korak 2 — Gostov mozak na punoj snazi
1. B1: pregled shadow transkripta agentic loop-a → 5% live canary → 25% → 100%.
2. B2: Unified Context 10% → 100% ako pilot izgleda dobro.
3. B3: Guest Conduct warn_1 live posle pregleda shadow odluka.
4. C8: prvi pravi A/B eksperiment — od kreiranja do zaključka.
→ **Rezultat: Denis proverava umesto da nagađa, povezuje slike, postavlja granice — za prave goste.**

### Korak 3 — Realtime migracija (posle A3, ~nedelja)
5. C6: question strip na Realtime kanal, uz C5 eval kapiju, canary po lokaciji.
→ **Rezultat: jedan prirodan glasovni kanal svuda, prekidanje u pola rečenice, kraj walkie-talkie ere.**

### Korak 4 — Platforma dokazana
6. C11: prvi pravi adapter kroz Integration Builder (upload UI + pravi OpenAPI + tvoj review + merge).
7. C12: SecretsManager UI. C13: POS katalog iskrenost + odluka o sledećem provideru.
→ **Rezultat: "Denis se sam povezuje sa novim sistemima" prestaje da bude demo i postaje dokazana sposobnost.**

### Definicija "kompletnog paketa" (merljivo, ne osećaj)
- [x] Sav kod na GitHub-u, migracije usklađene sa živom bazom *(jedan commit čeka push)*
- [ ] Agentic loop live ≥25% bez incidenta 2 nedelje
- [ ] Unified Context 100%
- [ ] Guest Conduct warn_1 live
- [x] Svih 8 M-sposobnosti iz ADR-053 živo u kodu *(rollout na lokacijama i dalje čeka A3 + odluke iz 2.B)*
- [ ] Question strip na Realtime (stari put kao fallback)
- [ ] 1 pravi A/B eksperiment zaključen
- [ ] 1 pravi adapter generisan kroz Integration Builder i odobren
- [ ] Nula flagova u stanju "izgrađeno ali niko nije odlučio"

Kad se ovih 9 kućica čekira — Denis nije "skoro gotov proizvod sa mračnim delovima" nego kompletan paket: gost, kuhinja, šank, konobar, menadžer i vlasnik, svi pričaju sa istim kolegom koji sve proverava i ništa ne izmišlja.
