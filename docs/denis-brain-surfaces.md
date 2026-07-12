# Denis Brain Surfaces — ko šta zna

**Svrha ovog fajla:** kad dodaješ nešto što Denis treba UVEK da zna (novi blok konteksta, novu svest o mogućnostima, itd.), proveri ovu tabelu PRE nego što kažeš da je gotovo — da li stvarno stiže do svake površine koja treba da ga ima, ili samo do one na kojoj si trenutno radio.

**Pravilo održavanja:** ažuriraj SAMO kad se stvarno promeni ko šta čita (nov poziv `assembleDenisBrainContext`, nov blok u `build-system-prompt.ts`, itd.) — ne posle svakog zadatka. Ako ikad posumnjaš da je zastareo, PROVERI u kodu (grep za pozivaoce funkcije), ne veruj ovom fajlu naslepo — ovo je mapa za brzu orijentaciju, ne izvor istine. Izvor istine je uvek živi kod.

**Poslednja stvarna provera:** 2026-07-12, direktnim grep-om kroz `src/` (ne iz sećanja).

---

## Dva odvojena "mozga" — namerno, ne greškom

1. **`assembleDenisBrainContext(locationId)`** (`src/lib/denis/cognition/context/assemble-denis-brain-context.ts`) — persona + restoransko znanje + integrations awareness + **POS capability awareness**. Jedna funkcija, jedan poziv po površini.
2. **`buildSystemPrompt(...)`** (`src/lib/ai/build-system-prompt.ts`) — bogatiji, gost-specifičan persona sistem (`buildPersonaIdentityBlock`/`buildPersonalityBlock` — ton/humor/kultura/raspoloženje gosta), plus restoransko znanje pozvano DIREKTNO (ne kroz #1). Namerno odvojeno jer gost treba adaptivniju personu nego osoblje.

Ovo dupliranje je OK i dokumentovano u samom `assemble-denis-brain-context.ts` — problem nastaje samo kad nešto NOVO (kao integrations/capability awareness) uđe u #1 a zaboravi se da li i #2 treba da ga ima.

---

## Tabela površina (stvarno stanje, 2026-07-12)

| Površina | Fajl | Persona/znanje | Integrations awareness | POS capability awareness |
|---|---|---|---|---|
| Owner-voice Realtime poziv | `api/denis/owner-voice/realtime-token/route.ts` | `assembleDenisBrainContext` | DA | DA |
| Station-voice opšti poziv ("Pozovi Denisa") | `api/denis/station-voice/general-token/route.ts` | `assembleDenisBrainContext` | DA | DA |
| Denis Menu Agent chat (admin) | `api/admin/denis-menu-agent/chat/route.ts` | `assembleDenisBrainContext` | DA | DA |
| Station-voice LLM fallback (T2, po pitanju) | `station-voice-turn-llm.ts` | `assembleDenisBrainContext` | DA | DA |
| Agentic tool-use loop — **SAMO shadow put** | `run-denis-turn.ts` (`agenticPolicy.mode === "shadow"` grana) | `assembleDenisBrainContext` | DA | DA (ali nikad ne stiže do gosta — shadow, ne pravi odgovor) |
| Gostov chat/glas — pravi, živi odgovor | `perceive-guest-chat-turn.ts` → `buildSystemPrompt` | `buildPersonaIdentityBlock`/`buildPersonalityBlock` + `loadRestaurantKnowledgeBlock` direktno | NE (i dalje — integrations awareness nije deo ovog popravljanog kruga, samo capability) | DA — **P0 propust popravljen** (`capabilityAwarenessBlock` polje na `BuildSystemPromptInput`, ulazi u situation pack isto kao `restaurantKnowledgeBlock`) |
| Station-voice Realtime, po konkretnom pitanju | `api/denis/station-voice/realtime-token/route.ts` | `resolveDenisVoiceInstructions` (ton-senčena persona) + `loadRestaurantKnowledgeBlock` direktno | NE | NE (nije još proglašeno propustom — Denis ovde zove OSOBLJE, ne obrnuto; manje kritično, ali vredi preispitati kad P0 bude gotov) |

---

## Kad dodaješ nešto novo što Denis treba da zna

Prođi kroz OVU listu pre nego što kažeš gotovo:

- [ ] Da li ovo treba da zna kad priča sa **vlasnicom/menadžerom** (owner-voice)?
- [ ] Da li ovo treba da zna kad priča sa **kuhinjom/šankom** (station-voice, oba puta — opšti i po-pitanju)?
- [ ] Da li ovo treba da zna kad **admin uređuje meni** (menu agent)?
- [ ] Da li ovo treba da zna **gost** direktno u chatu/glasu?

Ako je odgovor DA za gosta, ide u `build-system-prompt.ts` (najverovatnije u `buildPromptSituationPack`, isti obrazac kao `formatGuestPrefsSituation`), NE samo u `assembleDenisBrainContext` — ta funkcija gosta uopšte ne dodiruje.
