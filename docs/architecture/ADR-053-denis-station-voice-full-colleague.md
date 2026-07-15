# ADR-053: Denis kao pravi kolega u kuhinji i za šankom — voice-first stanica

| Polje | Vrednost |
|-------|----------|
| **Status** | **Proposed** — čeka odobrenje osnivača pre P0 |
| **Datum** | 2026-07-15 |
| **Produbljuje** | ADR-048 (Operational Knowledge), ADR-049 (Agentic Tool-Use Loop), ADR-050 (Persona), ADR-051 (Voice Noise Isolation) |
| **Reusuje** | `src/lib/denis/agentic/` (tool katalozi), `src/lib/denis/acl/` (propose→validate→execute), `src/lib/denis/surfaces/voice/` (VAD, wake-word, noise isolation), `src/lib/denis/config/rollout.ts` (shadow/canary), `pnpm eval:denis` harness |
| **Ne menja** | Gostov voice ordering (`use-denis-voice.ts`) — odvojena površina, nula preklapanja fajlova (potvrđeno ranije) |

## 0. Jedna rečenica

Denis danas ume da *pita* kuhinju i šank i da vodi opšti razgovor na dugme — ovaj ADR ga pretvara u punog kolegu na stanici: hands-free ("Denise!"), sa rukama u brašnu, koji čuje "86 losos" i *uradi* to, najavljuje kašnjenja, prenosi poruke između kuhinje i šanka, i pamti šta je obećao — sve kroz isti ACL sigurnosni obrazac koji već štiti porudžbine.

## 1. Provereno trenutno stanje (šta RADI danas)

Svaka stavka ispod je potvrđena direktnim čitanjem koda, ne iz sećanja:

1. **Station questions engine** (`src/lib/denis/stations/station-questions.ts`) — SLA okidači (hrana 12 min, piće 4 min), cooldown, max 3 otvorena pitanja po stanici, expiry 90s. Živ, uključen (`stationQuestions.enabled: true`).
2. **Question strip** (`denis-question-strip.tsx`) — Denis *naglas izgovara* pitanje na stanici (urgency-svesne rečenice iz `denis-station-voice-script.ts`), otvara prozor za slušanje, klasifikuje odgovor (keyword fast-path → LLM fallback), tekst odgovora stiže nazad konobaru/gostu. Montiran na sve tri table: `kitchen-board`, `kds-board`, `bar-drink-queue`.
3. **"Pozovi Denisa" dugme** (`denis-call-button.tsx`) — pravi dvosmerni WebRTC Realtime razgovor (gpt-realtime-mini, glas "echo"), sa alatima: `get_venue_status`, `notify_station`, `notify_manager`, `remember_commitment`, `complete_commitment`. Dobija pun `assembleDenisBrainContext` + dospela obećanja + skorašnju aktivnost u sistemski prompt. Montiran na sve tri table.
4. **Obećanja i dnevnik aktivnosti** (`denis-commitments.ts`, `denis-activity-log.ts`) — Denis pamti "podseti me sutra da naručim brašno" i sam ga pomene u sledećem razgovoru.
5. **86 lista** (`eighty-six-panel.tsx`) — tap-interfejs za skidanje/vraćanje artikala, piše u `product_availability`, na svim tablama.
6. **Station relay** (`station-relay-messages.ts`) — kuhinja↔šank poruke, izgovorene naglas na ciljnoj stanici (u question strip-u).
7. **Guest-status intel** (`resolve-guest-status-intel.ts`, `process-guest-status-inquiry.ts`) — gost pita "gde mi je hrana", Denis proveri stanje i po potrebi pita kuhinju naglas.
8. **Streaming TTS + tone shading** — Denis na stanici govori sa urgency/chaos/respect nijansama (`resolveDenisVoiceInstructions`), progressive playback (MediaSource).
9. **Noise isolation pipeline (ADR-051)** — `industrial-noise-profile.ts`, `voice-activity-detector.ts`, wake-word — izgrađeno, testirano, **ali živi samo u gostovom `use-denis-voice.ts`**.
10. **Realtime per-question put** (`realtime-token/route.ts` + `station-voice-realtime-tool-catalog.ts` sa `resolve_station_question` alatom) — izgrađen, ali jedini caller je QA harness `/admin/denis-realtime-voice-test`. Čeka verifikaciju na pravom uređaju.

## 2. Izgrađeno a NEPOVEZANO (iskrena lista rupa)

| # | Šta | Gde | Zašto je rupa |
|---|-----|-----|---------------|
| N1 | **Question strip i dalje koristi stari walkie-talkie put** (TTS → prozor za slušanje → keyword/LLM), ne Realtime WebRTC | `denis-question-strip.tsx` koristi `useDenisStationVoice`, nikad `realtime-token` | Nema prekidanja u pola rečenice (barge-in), kruta smena govori-pa-slušaj, četiri sloja interpretacije umesto jednog |
| N2 | **Realtime per-question katalog** (`resolve_station_question`) ima nula produkcionih pozivalaca | Samo `/admin/denis-realtime-voice-test` | Faza 2 plana stala na koraku 1 — čeka verifikaciju na pravom tabletu |
| N3 | **Noise isolation + wake-word se NE primenjuju na stanicama** | `industrial-noise-profile.ts` (ime kaže sve — industrijska buka!) uvezen samo u gostov hook | Kuhinja je NAJBUČNIJE mesto u objektu, a jedino tamo pipeline ne radi |
| N4 | **Nema hands-free na stanicama** — "Pozovi Denisa" traži klik | `denis-call-button.tsx` | Kuvar sa rukama u brašnu / šanker sa dve čaše u rukama ne može da klikne |
| N5 | **`escalateToBarEnabled: false`** — kuhinja→šank eskalacija pitanja izgrađena, ugašena | `concierge-defaults.ts:161` | Svesno ugašeno, čeka odluku o uključivanju |
| N6 | **`stationAwareTell: false`** | `concierge-defaults.ts:163` | Isto — izgrađeno, ugašeno |
| N7 | **Obećanja rade samo u opštem razgovoru** — question-strip put ih ne pamti niti pominje | `general-token/route.ts` jedini gradi commitments blok | Denis "zaboravi" obećanje ako ga je dao kroz odgovor na pitanje |
| N8 | **Nema rollout config za station-voice Realtime** (plan 2.5: `stationQuestions.rollout {mode, canaryPercent}`) | `concierge-config.schema.ts` | Bez toga nema bezbednog per-lokacija prelaska sa starog na novi put |
| N9 | **Nema station-voice eval fixtures** (plan 2.6: srpski scenariji — izgovoreni brojevi, "gotovo", "problem", sto/bon reference) | `src/lib/denis/eval/` nema station scenarije | Eval gate je uslov da ijedna lokacija izađe iz shadow-a |
| N10 | **Station relay je jednosmeran i ručan** — kuhinja mora da otkuca/izgovori poruku kroz pitanje; Denis ne prenosi sam | `station-relay-messages.ts` | "Reci šanku da kasnimo 10 minuta" ne postoji kao voice komanda |

## 3. Šta NEDOSTAJE POTPUNO (da bude "konobar koji može sve")

Ovo ne postoji ni u kom obliku — ni izgrađeno-pa-ugašeno:

| # | Sposobnost | Primer iz smene |
|---|-----------|------------------|
| M1 | **Voice → 86** | Kuvar vikne: "Denise, skini lososa, nema ga više" → Denis potvrdi ("Skidam lososa sa menija — potvrdi?") → na "da" upiše u `product_availability`, gosti odmah prestaju da ga vide |
| M2 | **Voice → najava kašnjenja** | "Denise, roštilj kasni 10 minuta" → Denis upiše ops belešku, konobari je vide, gostima sa roštilj-stavkama Denis proaktivno kaže realno vreme umesto da lažno teši |
| M3 | **Voice → spremno / poziv runnera** | "Spremno za sto 12" → Denis označi stavke ready i pozove konobara/runnera notifikacijom |
| M4 | **Voice → misija** | "Denise, podseti Marka da donese led" → `denis_missions` red (sistem misija već postoji, samo nema voice ulaz) |
| M5 | **Proaktivni Denis na pasu** | Denis sam najavi: "Pažnja, sto 8 čeka predjelo 11 minuta — SLA je 12" — PRE nego što pukne SLA, ne posle |
| M6 | **Glasno čitanje novih bonova** (opciono, po lokaciji) | Novi bon stigne → Denis pročita naglas ("Novi bon, sto 5: dva ćevapa, jedna karađorđeva") — ruke ostaju slobodne |
| M7 | **Dvosmerni cross-station prenos** | Kuhinja kaže Denisu → Denis prenese šanku svojim glasom, i obrnuto — bez tableta-posrednika |
| M8 | **Kraj smene naglas** | "Denise, šta je ostalo otvoreno?" → Denis pročita otvorene misije, neispunjena obećanja, 86 listu za sutra |

## 4. Odluka — ciljna arhitektura

**Jedan trajni Realtime voice kanal po stanici** (kuhinja, šank), hands-free, sa punim tool katalogom — umesto današnja dva odvojena, polovična puta (walkie-talkie question strip + click-to-talk opšte dugme).

```
Mikrofon stanice (stalno otvoren, lokalno)
  → ADR-051 pipeline: industrial noise profile → VAD → wake-word "Denise"
  → tek NA wake-word: WebRTC Realtime sesija (postojeći general-token obrazac)
  → Denis čuje, odgovara glasom, poziva alate
  → SVI alati sa side-effect-om idu kroz ACL izvršioce (ADR-049 pravilo, nepromenjeno)
  → sesija se gasi posle N sekundi tišine (štedi troškove — gpt-realtime-mini)
```

Ključne posledice:
- **Question strip se GASI kao poseban govorni mehanizam** — pitanja postaju samo još jedan razlog da Denis progovori kroz isti kanal (`resolve_station_question` alat već postoji za ovo, N2). Vizuelni strip ostaje kao fallback/potvrda na ekranu.
- **Stari TTS put ostaje trajno kao T3 fallback** (token mint padne, WebRTC padne, rollout kaže legacy) — isto pravilo kao ADR-049 legacy fallback.
- **Wake-word je jedini okidač za slanje zvuka bilo kome** — mikrofon se obrađuje isključivo lokalno (VAD/wake-word u browseru) dok wake-word ne padne. Ništa se ne šalje nigde pre toga. Ovo je privacy granica, ne optimizacija.

## 5. Prošireni tool katalog za stanice

Svaki novi alat mapira se na POSTOJEĆU funkciju — nula novih biznis-logika, samo voice ulaz (isti princip kao ADR-049 §3):

| Alat | Side effect | Postojeća implementacija | Potvrda glasom pre izvršenja? |
|------|-------------|--------------------------|-------------------------------|
| `resolve_station_question` | Da (odgovor gostu) | `answerStationQuestion` — već postoji (N2) | Ne (odgovor je sama potvrda) |
| `eighty_six_product` | Da | `patchProductAvailability` (isti backend kao panel) | **DA — Denis ponovi artikal i čeka "da"** |
| `restore_product` | Da | isto | DA |
| `announce_delay` | Da | venue ops beleška (postojeći ops mehanizam) | DA |
| `mark_ready_call_runner` | Da | order status + `dispatchStaffNotification` | Ne (nisko-rizično, reverzibilno) |
| `create_mission` | Da | `createMission` — već postoji | DA |
| `relay_to_station` | Da | `station-relay-messages` — već postoji (N10) | Ne (Denis ponovi poruku dok je prenosi) |
| `get_venue_status` | Ne | već postoji u general katalogu | — |
| `remember_commitment` / `complete_commitment` | Da | već postoje | Ne |
| `read_open_items` (M8) | Ne | misije + obećanja + 86 lista, sve postojeći čitaoci | — |

**Tvrdo pravilo potvrde:** svaki alat označen "DA" izgovara nazad šta je razumeo i čeka eksplicitno potvrdno ("da", "važi", "tako je") pre poziva izvršioca. U bučnoj kuhinji pogrešno čuti "skini lososa" kao "skini osmicu" ne sme da prođe tiho. LLM nikad ne odlučuje da preskoči potvrdu — to je deterministički gate u izvršiocu (isti princip kao Policy Engine: LLM percipira, kod odlučuje).

## 6. Bezbednosni model (nepregovorljivo)

1. Side-effecting alati idu kroz ACL izvršioce, nepromenjene — voice je samo novi pozivalac, nikad zaobilazak (ADR-049 §4.1).
2. Idempotency ključ na svakom side-effecting pozivu (postojeća konvencija).
3. Potvrda glasom za destruktivne/gost-vidljive akcije (§5 tabela) — deterministički enforsovana.
4. Mikrofon: lokalna obrada do wake-worda, ništa se ne šalje pre njega (§4). Vizuelni indikator na ekranu stanice kad je Realtime sesija aktivna.
5. Neuspeh alata je prvoklasan rezultat koji Denis mora naglas da prizna ("Nisam uspeo da skinem lososa, probaj ručno") — nikad lažni uspeh.
6. Trošak: `gpt-realtime-mini`, sesija se gasi na tišinu, `meteredByCredits: false` ostaje (odluka iz Faze 1.3) — interni staff voice ne troši gostove kredite, ali se loguje u activity log za nedeljni pregled troška.
7. Sve što Denis uradi glasom upisuje se u `denis-activity-log` — isti dnevnik koji već hrani sledeći razgovor ("jutros sam skinuo lososa u 9:40").

## 7. Faze implementacije

| Faza | Isporuka | Zavisi od | Obim |
|------|----------|-----------|------|
| **P0** | Osnivač verifikuje postojeći Realtime put na pravom tabletu u kuhinji (`/admin/denis-realtime-voice-test`) — go/no-go za sve dalje | ništa (spremno danas) | Osnivačev sat vremena, nula koda |
| **P1** | Noise isolation + VAD + wake-word na stanicama: novi `use-denis-station-ear.ts` hook koji reusuje ADR-051 pipeline iz gostovog hooka; wake-word otvara postojeću general-token sesiju (N3+N4) | P0 | Srednji |
| **P2** | Prošireni tool katalog (§5): `eighty_six_product`, `announce_delay`, `mark_ready_call_runner`, `create_mission`, `relay_to_station`, `read_open_items` — svaki sa ACL izvršiocem i potvrdom | P1 | Srednji–veliki |
| **P3** | Question strip migracija na Realtime kanal (N1+N2): pitanja ulaze u isti kanal kao proaktivni Denis govor; stari TTS put postaje T3 fallback; rollout config (N8) | P1 | Srednji |
| **P4** | Eval gate (N9): `run-station-voice-eval.ts` + srpski fixtures (izgovoreni brojevi, "gotovo", "nema više", "kasni", sto/bon reference, bučna transkripcija) — uslov za izlazak iz shadow-a | P2, P3 | Srednji |
| **P5** | Proaktivni Denis na pasu (M5, M6): SLA pre-warning naglas, opciono čitanje bonova; `escalateToBarEnabled` odluka (N5) | P3, P4 | Srednji |
| **P6** | Canary rollout po lokaciji (5%→25%→100% pitanja kroz novi kanal), osnivač sluša prave snimke/transkripte na svakom koraku | P4 | Tempiran realnim korišćenjem |

Bez fiksnog datuma za P5/P6 — tempirani realnim ponašanjem u pravoj kuhinji, isto kao ADR-049 P4/P5.

## 8. Kriterijumi uspeha

| Metrika | Cilj |
|---------|------|
| Side-effecting voice akcija mimo ACL-a | 0 — arhitektonski nemoguće |
| Destruktivna akcija bez glasovne potvrde | 0 — deterministički gate |
| Zvuk poslat van uređaja pre wake-worda | 0 — lokalna obrada |
| Eval: tačnost srpskih station scenarija | ≥ postojeći keyword fast-path baseline (`classify-station-voice-reply` testovi) |
| Lažni uspeh na palom alatu | 0 |
| Vreme kuvara od izgovorene komande do izvršene akcije | < 5s (86, delay, ready) |
| Novi alat = samo registry unos + ACL izvršilac | obavezno (nikad izmena kanala/loop-a) |

## 9. Otvorena pitanja za osnivača

1. **Wake-word reč**: "Denise" (vokativ) — ili nešto kraće/otpornije na buku? Treba testirati na pravom mestu (P0/P1).
2. **Čitanje bonova naglas (M6)**: podrazumevano uključeno ili opt-in po lokaciji? U maloj kuhinji zlato, u velikoj možda buka.
3. **Stalno otvoren mikrofon**: pravno/kadrovski OK u ciljnim zemljama (DE/RS)? Lokalna obrada do wake-worda je tehnička zaštita, ali osoblje mora biti obavešteno — predlog: vidljiva oznaka na stanici + stavka u onboarding-u osoblja.
4. **`escalateToBarEnabled`**: uključiti u sklopu P5 ili ranije?
5. **Ko sme "86"**: bilo ko ko priča na stanici, ili tražiti da Denis pita ime/potvrdu šefa kuhinje za skidanje artikala? (Danas panel ne pita ništa — voice ne bi bio stroži od panela, ali vredi odlučiti svesno.)

## 10. Šta ovaj ADR svesno NE pokriva

- Gostov voice ordering — netaknut, odvojena površina.
- Owner voice (`owner-voice-tool-catalog`) — već radi, van obima.
- Kamere/vizuelno praćenje kuhinje — potpuno druga tema, drugi rizici.
- Identitet osoblja na stanici (ko tačno priča) — ovaj kod nema shift/clock-in koncept (poznato ograničenje iz Policy Engine dizajna); stanica je identitet, ne osoba. Per-person razlikovanje glasom je buduća tema, ne uslov.
