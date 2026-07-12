# Denis Brain Surfaces — ko šta zna

**Svrha ovog fajla:** kad dodaješ nešto što Denis treba UVEK da zna (novi blok konteksta, novu svest o mogućnostima, itd.), proveri ovu tabelu PRE nego što kažeš da je gotovo — da li stvarno stiže do svake površine koja treba da ga ima, ili samo do one na kojoj si trenutno radio.

**Pravilo održavanja:** ažuriraj SAMO kad se stvarno promeni ko šta čita (nov poziv `assembleDenisBrainContext`, nov blok u `build-system-prompt.ts`, itd.) — ne posle svakog zadatka. Ako ikad posumnjaš da je zastareo, PROVERI u kodu (grep za pozivaoce funkcije), ne veruj ovom fajlu naslepo — ovo je mapa za brzu orijentaciju, ne izvor istine. Izvor istine je uvek živi kod.

**Poslednja stvarna provera:** 2026-07-12 (drugi put istog dana), direktnim grep-om kroz `src/` (ne iz sećanja).

---

## Dva odvojena "mozga" — namerno, ne greškom

1. **`assembleDenisBrainContext(locationId)`** (`src/lib/denis/cognition/context/assemble-denis-brain-context.ts`) — persona + restoransko znanje + integrations awareness + **PUNA POS capability slika** (`loadFullCapabilityAwarenessBlock` — svih 11 ključeva iz pos-capability-matrix.ts, sa statusom i izvornom napomenom, ne samo gost-bezbedni podskup).
2. **`buildSystemPrompt(...)`** (`src/lib/ai/build-system-prompt.ts`) — bogatiji, gost-specifičan persona sistem (`buildPersonaIdentityBlock`/`buildPersonalityBlock` — ton/humor/kultura/raspoloženje gosta), plus restoransko znanje pozvano DIREKTNO (ne kroz #1). Namerno odvojeno jer gost treba adaptivniju personu nego osoblje.

Ovo dupliranje je OK i dokumentovano u samom `assemble-denis-brain-context.ts` — problem nastaje samo kad nešto NOVO (kao integrations/capability awareness) uđe u #1 a zaboravi se da li i #2 treba da ga ima.

**Bitna asimetrija, namerna:** gost dobija `loadCapabilityAwarenessBlock` (6-key gost-bezbedni podskup: samo confirmed/not_supported/not_confirmed, pos_dependent namerno izostavljen — prevrtljivo za flat gost-obećanje). Osoblje (owner/station/menu-agent) dobija `loadFullCapabilityAwarenessBlock` (svih 11 ključeva, uključujući pos_dependent, sa izvornom napomenom) — vlasnik/menadžer sme da nosi "zavisi od POS-a" nijansu, gost ne sme dobiti obećanje na osnovu nje.

---

## Tabela površina (stvarno stanje, 2026-07-12)

| Površina | Fajl | Persona/znanje | Integrations awareness (šta je POVEZANO) | POS capability awareness (šta ta veza tačno MOŽE) |
|---|---|---|---|---|
| Owner-voice Realtime poziv | `api/denis/owner-voice/realtime-token/route.ts` | `assembleDenisBrainContext` | DA | DA — **PUNA slika** (svih 11 ključeva) |
| Station-voice opšti poziv ("Pozovi Denisa") | `api/denis/station-voice/general-token/route.ts` | `assembleDenisBrainContext` | DA | DA — **PUNA slika** |
| Denis Menu Agent chat (admin) | `api/admin/denis-menu-agent/chat/route.ts` | `assembleDenisBrainContext` | DA | DA — **PUNA slika** |
| Station-voice LLM fallback (T2, po pitanju) | `station-voice-turn-llm.ts` | `assembleDenisBrainContext` | DA | DA — **PUNA slika** |
| Agentic tool-use loop — **shadow svuda OSIM jedne pilot lokacije** | `run-denis-turn.ts` (`agenticPolicy.mode === "shadow"` ili `"live"` samo za `SKYLINE_PILOT_LOCATION_ID`) | `assembleDenisBrainContext` | DA | DA — **PUNA slika**, ali van pilot lokacije nikad ne stiže do gosta (shadow, ne pravi odgovor) |
| Gostov chat/glas — pravi, živi odgovor | `perceive-guest-chat-turn.ts` → `buildSystemPrompt` | `buildPersonaIdentityBlock`/`buildPersonalityBlock` + `loadRestaurantKnowledgeBlock` direktno | **DA — popravljeno** (`integrationsAwarenessBlock` polje, isti obrazac kao `capabilityAwarenessBlock`) | DA — gost-bezbedni 6-key podskup (namerno uži od osoblja, videti gore) |
| Station-voice Realtime, po konkretnom pitanju | `api/denis/station-voice/realtime-token/route.ts` | `resolveDenisVoiceInstructions` (ton-senčena persona) + `loadRestaurantKnowledgeBlock` direktno | NE | NE (nije još proglašeno propustom — Denis ovde zove OSOBLJE, ne obrnuto; manje kritično) |

---

## Popravljeno 2026-07-12 (treći put istog dana): order.cancel / order.modify.request

Ranije: Denis nije imao promptnu svest o postojanju otkazivanja/izmene porudžbine — samo deterministički reflex sloj (`reflex-plan.ts`) je mogao da je pokrene, nikad LLM razumevanje.

Sad:
- **Svest (gost):** `build-system-prompt.ts`'s `platformContractBlock()` ima novu stalnu liniju ("CANCEL/CHANGE: ...") — gost-facing Denis sad zna da otkazivanje/izmena postoji i pod kojim uslovom (pre nego kuhinja prihvati), bez obzira da li agentic tool loop radi uživo za tu lokaciju.
- **Mogućnost da rukuje (svuda gde agentic tool loop uopšte radi):** dva nova side-effecting tool-a u `side-effecting-tool-catalog.ts` — `cancel_order` (`executeDenisGuestOrderCancel`) i `request_order_modification` (`executeDenisOrderModifyRequest`) — ISTI ACL executor-i koje i reflex sloj koristi, isto `dryRun`/shadow gate-ovanje kao svaki drugi side-effecting tool (ADR-049 §4.3). Reflex sloj ostaje netaknut, i dalje prva, brza linija za formulacije koje već hvata.

Van dosega ove popravke (namerno): agentic tool loop je i dalje shadow-only svuda osim pilot lokacije (vidi tabelu iznad) — ova popravka daje Denisu SVEST svuda i MOGUĆNOST tamo gde je tool loop uživo, ne menja rollout status samog tool loop-a.

---

## Kad dodaješ nešto novo što Denis treba da zna

Prođi kroz OVU listu pre nego što kažeš gotovo:

- [ ] Da li ovo treba da zna kad priča sa **vlasnicom/menadžerom** (owner-voice)?
- [ ] Da li ovo treba da zna kad priča sa **kuhinjom/šankom** (station-voice, oba puta — opšti i po-pitanju)?
- [ ] Da li ovo treba da zna kad **admin uređuje meni** (menu agent)?
- [ ] Da li ovo treba da zna **gost** direktno u chatu/glasu?

Ako je odgovor DA za gosta, ide u `build-system-prompt.ts` (najverovatnije u `buildPromptSituationPack`, isti obrazac kao `formatGuestPrefsSituation`), NE samo u `assembleDenisBrainContext` — ta funkcija gosta uopšte ne dodiruje.
