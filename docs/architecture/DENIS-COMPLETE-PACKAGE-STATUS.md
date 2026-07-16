# Denis — analiza stanja: šta je dodato, šta nedostaje, plan do "kompletnog paketa"

Datum: 2026-07-16 · Autor: Claude (na zahtev osnivača) · Svaka tvrdnja ispod je proverena direktno u kodu, ne iz sećanja.

---

## DEO 1 — ŠTA JE DODATO (isporučeno, testirano, commitovano)

42 lokalna commit-a ispred GitHub-a. Grupisano po oblasti:

### 1.1 Mozak — razumevanje gosta (regex purge, kompletno)
Celokupno razumevanje gostovog jezika prebačeno sa regex šablona na pravo LLM razumevanje, u 8 commit-ova (`521aaae4` … `e484cbea`): segmentacija porudžbine, veličine/kategorije, modifikatori, zamene, otkazivanje stavki. Regex preživeo samo kao dokumentovan fallback za T0 refleks i ispad LLM-a. **Ovo je završena inicijativa — ništa ne visi.**

### 1.2 Agentic Tool-Use Loop (ADR-049) — Denis proverava umesto da nagađa
- Kompletna infrastruktura P0–P3: tool-calling u OpenAI klijentu, read-only alati (kuhinja/zalihe/račun), side-effecting alati kroz ACL sa dry-run, eval scenariji (30/30 zeleno).
- **Uključen u shadow mode na 100% razgovora** (`b776859b`) — svaki pravi gostov razgovor sada loguje šta bi loop uradio (`agentic.shadow_trace`), gost ništa ne primećuje. Podaci se skupljaju od 15.07.

### 1.3 Station voice — Denis kao kolega u kuhinji i za šankom (ADR-053)
- **ADR-053 napisan** (`d532b267`): potpuna mapa — 10 nepovezanih delova (N1–N10), 8 nedostajućih sposobnosti (M1–M8), ciljna arhitektura, faze P0–P6.
- **P1 — hands-free uho** (`d55e82fc`): tablet lokalno sluša "hej Denise" (industrial noise profil → VAD → wake-word), ništa ne napušta uređaj pre wake-worda, vidljiva oznaka "Denis sluša". Ugašeno po defaultu (`handsFreeWakeWordEnabled: false`).
- **M1 — glasovni 86** (`643d615c`): "skini lososa" stvarno skida artikal, uz deterministički propose→confirm gate (Redis, single-shot, fail-closed) — LLM fizički ne može da preskoči glasovnu potvrdu. Prepoznaje padeže i izgovor bez dijakritike; dvosmislenost ("šnicla") vraća pitanje, nikad tiho pogađanje.
- **M4 — glasovni zadaci** (`a31f4da1`): "podseti Marka da donese led" pravi pravu misiju + push notifikaciju za ciljnu ulogu.
- **M5 — proaktivno SLA upozorenje** (`36a92921`): Denis ume da pita kuhinju PRE nego što rok pukne ("bliži se rok, koliko još treba?"), sa zaštitom da rano pitanje ne pojede pravo. Ugašeno po defaultu.
- Ranije u sesiji: dvosmerni WebRTC "Pozovi Denisa" razgovor sa alatima (venue status, relay, obaveštenja, obećanja), streaming TTS, tone shading (urgency/chaos/respect), obećanja + dnevnik aktivnosti.

### 1.4 Unified Operational Context (ADR-048) — jedna slika umesto dve
- **Uključen na 10% pilot** (`36a92921`): "kuhinja pretrpana + ovaj gost nestrpljiv" prvi put stiže do pravog gosta kao jedna povezana poruka. 11 testova, oprezan start.

### 1.5 Policy Engine — emocionalna/relaciona inteligencija
- Deterministički ladder + tracker (shadow), mission na handoff (MVP-4), rule-proposal state machine (trajno pravilo vs jednokratni izuzetak, `pending_confirmation` → admin potvrda), povezan i na voice i na chat (`0a51935b`, `839bd742`, `09cb2259`).

### 1.6 Integration Builder (ADR-052) — Denis gradi sopstvene integracije
- Faze 0–5 izgrađene: OpenAPI/Postman parseri, capability mapper (deterministički, "supported" bez citata = programska greška), adapter generator, contract test generator, SandboxRunner (mock-only), repair loop (max 3 runde), human review workflow sa admin UI, SecretsManager (pgcrypto, fail-closed).

### 1.7 Celokupna revizija projekta ("nije povezano / nije završeno")
- 8 pravih popravki: A/B config se stvarno primenjuje, POS connect odbija neizgrađene providere, denis_missions UI, feedback_inbox čitalac, ROI nav link, loyalty_rewards u level-up čestitci, `recordLiveAbSessionMetrics` povezan (A/B eksperimenti sad mogu da se ZAKLJUČE, ne samo pokrenu).
- ~5.200 linija mrtvog koda obrisano (napušteni refaktori, 10 osirotelih admin panela, duplikati) — svaki korak verifikovan punom svitom.

### 1.8 Bezbednost i higijena
- P0 popravke: webhook signature bypass zatvoren, capability awareness stigla do gostovog chata, template-injection bug u SandboxRunner-u.
- Test svita: **409 fajlova / 2.709 testova, zeleno.** tsc: 0 grešaka. Arhitektonski compliance: zeleno.

---

## DEO 2 — ŠTA JOŠ TREBA (iskrena lista, po kategoriji)

### 2.A BLOKIRANO NA TEBI (niko drugi ne može)

| # | Šta | Zašto je kritično |
|---|-----|-------------------|
| A1 | **GitHub push (403)** | **42 commit-a postoje SAMO na ovom laptopu.** Jedan pokvaren disk = sve ovo nestaje. Ovo je najveći pojedinačni rizik u celom projektu, veći od bilo koje nedostajuće funkcije. |
| A2 | **Migracije na živu bazu** | Migracije `00169` (integration_approval_requests) i `00170` (integration_credentials) postoje u repo-u ali po pravilu sesije NISU primenjene na živu bazu bez tvoje potvrde. Integration Builder review UI i SecretsManager ne rade na produkciji dok se ne primene. Treba proveriti tačno koje su migracije žive. |
| A3 | **P0 test na pravom uređaju** | `/admin/denis-realtime-voice-test` na tabletu u kuhinji — sat vremena tvog slušanja. Go/no-go za celu Realtime migraciju (najveći preostali station-voice skok). |

### 2.B IZGRAĐENO ALI UGAŠENO (čeka odluku o rollout-u, ne kod)

| # | Flag/mehanizam | Stanje | Sledeći korak |
|---|----------------|--------|---------------|
| B1 | Agentic Tool Loop | shadow, 100% loguje | Par dana podataka → pregled transkripta → 5% live canary |
| B2 | Unified Operational Context | **10% live** | Pratiti par dana → 25% → 100% |
| B3 | Guest Conduct ladder | shadow | Pregled `conduct.policy_decision` eventa → warn_1 live |
| B4 | Hands-free uho (`handsFreeWakeWordEnabled`) | off | Posle A3 → uključiti za jednu lokaciju |
| B5 | SLA pre-warn (`slaPreWarnEnabled`) | off | Uključiti za jednu lokaciju, čuti kako zvuči |
| B6 | Kuhinja→bar eskalacija (`escalateToBarEnabled`) | off | Odluka + flip |
| B7 | `stationAwareTell`, `floorGraphEnabled` | off | Odluka + flip |

### 2.C NEDOSTAJE POTPUNO — kod koji treba napisati

**Station voice (ostatak ADR-053):**
| # | Šta | Težina |
|---|-----|--------|
| C1 | **M3 — "spremno za sto 12" glasom** → označi ready + pozovi runnera. Treba resolver izgovorenih brojeva stolova ("dvanaest" → 12), analogno product resolveru | Srednje |
| C2 | **M2 — "roštilj kasni 10 min"** → ops beleška + gosti sa tim stavkama dobiju realno vreme | Srednje |
| C3 | **M8 — "šta je ostalo otvoreno?"** → read_open_items alat (misije + obećanja + 86 lista) — čisto read-only, najlakši | Malo |
| C4 | **M6 — čitanje novih bonova naglas** (opt-in po lokaciji) | Srednje |
| C5 | **N8+N9 — rollout config + srpski eval fixtures za station voice** — uslov za P3 | Srednje |
| C6 | **P3 — Realtime migracija question strip-a** (posle A3): pitanja ulaze u isti kanal, stari TTS ostaje T3 fallback | Veliko |
| C7 | M7 — pun dvosmerni cross-station prenos Denisovim glasom (relay postoji, treba zatvoriti krug) | Srednje |

**Guest-facing mozak:**
| # | Šta | Težina |
|---|-----|--------|
| C8 | Prvi PRAVI A/B eksperiment od početka do kraja (sad kad metrika radi) — dokaz da flywheel radi | Malo (operativno) |
| C9 | Policy Engine: assessGuestConduct LLM korak u shadow poređenju sa regex baseline-om (MVP korak 3 iz dizajna) | Srednje |
| C10 | Agentic loop metering odluka (`agenticToolLoopCreditsPerRound`) — eksplicitno, pre live canary-ja | Malo |

**Platforma / biznis:**
| # | Šta | Težina |
|---|-----|--------|
| C11 | **Integration Builder: prvi pravi adapter end-to-end** — upload UI za dokumentaciju (`integration_documents` nema upload endpoint), pa ceo tok sa pravim OpenAPI fajlom. Sve faze postoje, ali NIJEDAN pravi adapter nikad nije prošao kroz njih — nedokazano | Srednje-veliko |
| C12 | SecretsManager admin UI (unos sandbox/prod kredencijala) | Srednje |
| C13 | POS: `ready2order`/`custom` u CONNECTOR_CATALOG (vidljivost), i odluka koji je sledeći pravi adapter posle Deliverect-a | Malo / poslovna odluka |
| C14 | Denis ROI stranica — provera da li pokazuje pun ROI narativ sad kad se svi podaci skupljaju | Malo |

**Dugoročno (svesno odloženo, ne za sad):**
- Cross-visit identitet gosta (privacy odluka), `denis_relationship_signals` resurekcija, multi-venue learning na punoj snazi, browser-automation konektori, eksterni vault.

---

## DEO 3 — PREDLOG: REDOSLED DO "KOMPLETNOG PAKETA"

Logika redosleda: prvo ukloni egzistencijalni rizik, pa dokaži ono što je izgrađeno na pravim podacima, pa dograditi ono što nedostaje — jer "kompletan paket" ne znači "sve napisano" nego "sve RADI za prave goste i pravo osoblje".

### Korak 0 — OVE NEDELJE, tvoje akcije (bez ovoga sve ostalo visi)
1. **A1: GitHub push.** 15 minuta rešavanja permisije briše najveći rizik projekta.
2. **A2: uskladiti migracije** — zajedno proći koje su primenjene, primeniti zaostale uz tvoju potvrdu.
3. **A3: P0 test na tabletu** — sat vremena, otključava ceo Realtime pravac.

### Korak 1 — Kuhinja/šank kompletan (2-3 dana kodiranja, moje)
4. C3 (M8 rundown — najlakši), pa C1 (M3 ready/runner + brojevi stolova), pa C2 (M2 kašnjenja).
5. C5 (eval fixtures + rollout config) — kapija za sve dalje.
6. B4+B5 flip za jednu pilot lokaciju čim A3 prođe.
→ **Rezultat: Denis u kuhinji ume da čuje, uradi, upozori, prenese i podnese izveštaj — pun kolega.**

### Korak 2 — Gostov mozak na punoj snazi (paralelno sa Korakom 1, delom kalendarsko)
7. B1: pregled shadow transkripta agentic loop-a (zajedno) → 5% live canary → 25% → 100%.
8. B2: Unified Context 10% → 100% ako pilot izgleda dobro.
9. B3: Guest Conduct warn_1 live posle pregleda shadow odluka.
10. C8: prvi pravi A/B eksperiment (npr. dessert timing) — od kreiranja do zaključka.
→ **Rezultat: Denis proverava umesto da nagađa, povezuje slike, postavlja granice — za prave goste.**

### Korak 3 — Realtime migracija (posle A3, ~nedelja)
11. C6: question strip na Realtime kanal, uz C5 eval kapiju, canary po lokaciji.
→ **Rezultat: jedan prirodan glasovni kanal svuda, prekidanje u pola rečenice, kraj walkie-talkie ere.**

### Korak 4 — Platforma dokazana (posle Koraka 1-2)
12. C11: prvi pravi adapter kroz Integration Builder (upload UI + pravi OpenAPI + tvoj review + merge).
13. C12: SecretsManager UI. C13: POS katalog iskrenost + odluka o sledećem provideru.
→ **Rezultat: "Denis se sam povezuje sa novim sistemima" prestaje da bude demo i postaje dokazana sposobnost.**

### Definicija "kompletnog paketa" (merljivo, ne osećaj)
- [ ] Sav kod na GitHub-u, migracije usklađene sa živom bazom
- [ ] Agentic loop live ≥25% bez incidenta 2 nedelje
- [ ] Unified Context 100%
- [ ] Guest Conduct warn_1 live
- [ ] Svih 8 M-sposobnosti iz ADR-053 živo na bar jednoj lokaciji
- [ ] Question strip na Realtime (stari put kao fallback)
- [ ] 1 pravi A/B eksperiment zaključen
- [ ] 1 pravi adapter generisan kroz Integration Builder i odobren
- [ ] Nula flagova u stanju "izgrađeno ali niko nije odlučio"

Kad se ovih 9 kućica čekira — Denis nije "skoro gotov proizvod sa mračnim delovima" nego kompletan paket: gost, kuhinja, šank, konobar, menadžer i vlasnik, svi pričaju sa istim kolegom koji sve proverava i ništa ne izmišlja.
