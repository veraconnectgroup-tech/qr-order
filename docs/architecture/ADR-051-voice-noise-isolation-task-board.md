# ADR-051 — Voice Noise Isolation Task Board (Tabla zadataka)

> **OBAVEZNO za svakog agenta:** pre bilo kakvog rada pročitaj ceo ovaj fajl.
> Ovo je jedini izvor istine o tome ko šta radi. Isti obrazac kao ADR-046.

## Kontekst (zašto ovaj ADR postoji)

Denis već ima: dugoročnu memoriju gosta (`learning/guest-memory/`), agentski
tool-use loop (`agentic/run-tool-loop.ts`, ACL), i eskalacioni tok kuhinja/šank
→ menadžer sa prioritetima (`stations/station-questions.ts`,
`notifications/dispatch-staff-notification.ts`, tip `denis_escalation`,
`priorityOverride: "urgent"`).

Ono što **nedostaje** je fizički/audio sloj za bučnu kuhinju/šank. Trenutno
stanje (`surfaces/voice/voice-audio-config.ts`):
- postoji band-pass filter (200Hz–8kHz) i prost RMS noise-gate
  (`VOICE_NOISE_GATE_THRESHOLD`)
- postoji browser-native `echoCancellation`, `noiseSuppression`,
  `autoGainControl` na `getUserMedia`
- **ne postoji**: wake word, prava Voice Activity Detection (VAD) biblioteka
  (Silero VAD ili sličan), agresivnije noise suppression za industrijsku buku
  (RNNoise ili ekvivalent), beamforming, push-to-talk režim, niti bilo kakva
  razlika u audio ponašanju po stanici (sala / kuhinja / friteze-roštilj).

Cilj ovog ADR-a: dodati te slojeve BEZ menjanja postojeće eskalacione logike
(ta je već dobra) — samo poboljšati koliko pouzdano Denis čuje osobu koja mu
se obraća u bučnom okruženju.

## Kako se ažurira status

Svaki zadatak ima polje `Status` i `Agent`. Dozvoljene vrednosti:

- `TODO` — niko ne radi
- `RADIM NA TOME` — agent je preuzeo (upiši ime/ID agenta i datum/vreme)
- `ZAVRŠENO I TESTIRANO` — kod uvezan, `pnpm test:run` / `type-check` / `lint`
  / `build` zeleni + napomena šta je urađeno
- `BLOKIRANO` — razlog u `Napomena`, agent uzima sledeći TODO

**Pravilo:** jedan agent = jedan zadatak istovremeno. Ne diraj zadatak koji je
`RADIM NA TOME` kod drugog agenta. Status menjaš u ISTOM koraku kad počneš
(pre koda) i kad završiš (posle koda), pa komituješ oboje zajedno.

---

## Sekcija A — Osnovni audio slojevi (nezavisni zadaci, mogu paralelno)

### A1 — Voice Activity Detection (VAD)
- Status: ZAVRŠENO I TESTIRANO
- Agent: Cursor Agent (Composer) — 2026-07-08 16:32
- Napomena: Dodat `voice-activity-detector.ts` (energy+ZCR state machine sa adaptivnim noise floor-om); `use-denis-voice.ts` sada pokreće STT tek posle VAD potvrde govora umesto prostog RMS gate-a.
- Fajlovi: novi `src/lib/denis/surfaces/voice/voice-activity-detector.ts`,
  izmena `src/hooks/use-denis-voice.ts`, test
  `src/__tests__/voice-activity-detector.test.ts`
- Zadatak: zameniti/nadograditi prost RMS `isSignalAboveNoiseGate` pravom VAD
  logikom (npr. Silero VAD preko ONNX runtime u browseru, ili ekvivalentna
  laka biblioteka koja radi u Tauri webview-u). Cilj: Denis ne pokušava STT
  dok VAD ne potvrdi da neko zaista govori. Ne diraj eskalacionu logiku u
  `stations/`.

### A2 — Agresivniji noise suppression za industrijsku buku
- Status: ZAVRŠENO I TESTIRANO
- Agent: Cursor Agent (Composer) — 2026-07-08 17:26
- Napomena: Dodat `industrial-noise-profile.ts` (Wiener + flatness spektralna supresija) i `openIndustrialVoiceAudioPipeline()` u voice-audio-config; postojeći sala default (`openVoiceAudioPipeline`) nije diran.
- Fajlovi: izmena `src/lib/denis/surfaces/voice/voice-audio-config.ts`, novi
  `src/lib/denis/surfaces/voice/industrial-noise-profile.ts`, test
- Zadatak: dodati drugi audio profil pored postojećeg band-pass/noise-gate —
  agresivniji suppression (RNNoise-like pristup ili dodatni spektralni
  filter) za okruženje sa aspiratorima/friteze/roštilj. Ne brisati postojeći
  `openVoiceAudioPipeline` — dodati varijantu, ne menjati default ponašanje
  za salu.

### A3 — Wake word ("Hej Denise")
- Status: ZAVRŠENO I TESTIRANO
- Agent: Cursor Agent (Composer) — 2026-07-08 17:45
- Napomena: Dodat `wake-word-detector.ts` (akustični template + transcript aliasi); `use-denis-voice` podržava `requireWakeWord` — VAD+STT se aktivira tek posle wake fraze, sala default ostaje nepromenjen.
- Fajlovi: novi `src/lib/denis/surfaces/voice/wake-word-detector.ts`, izmena
  `src/hooks/use-denis-voice.ts`, test
- Zadatak: Denis ne sme stalno da šalje audio na STT. Dodati lokalnu wake-word
  detekciju (mala keyword-spotting biblioteka ili on-device model) koja
  aktivira punu VAD+STT petlju tek posle wake reči. Zavisi od A1 (koristi isti
  audio graph) — koordiniši sa agentom na A1 pre nego što diraš isti hook.

### A4 — Push-to-talk režim po stanici
- Status: ZAVRŠENO I TESTIRANO
- Agent: Cursor Agent (Composer) — 2026-07-08 18:09
- Napomena: Dodat `VoiceInputMode` u station-voice-context; `use-denis-voice` podržava `inputMode: "push-to-talk"`; kuhinja/šank dobijaju dugme "Drži za odgovor" u denis-question-strip umesto auto-listen.
- Fajlovi: izmena `src/lib/denis/stations/station-voice-context.ts`, izmena
  `src/hooks/use-denis-voice.ts`, novi tip `VoiceInputMode` (`"wake-word"` |
  `"push-to-talk"`), UI dugme u komponenti koja renderuje kuhinjski/šank
  voice unos (proveri `src/components` pretragom
  `grep -rn "station-voice-context" src/components`)
- Zadatak: dodati eksplicitan režim gde konobar/kuhinja pritisne i drži dugme
  umesto wake-word aktivacije, kao rezervnu opciju za ekstremno bučno
  okruženje. Ne zavisi od A1/A2/A3 tehnički, ali finalni izbor režima
  (sala/kuhinja/industrijska buka → koji mod) ide u A5.

## Sekcija B — Zavisi od sekcije A (pokrenuti tek kad je A ZAVRŠENO I TESTIRANO)

### B1 — Tri audio režima po tipu stanice (sala / kuhinja / industrijska buka)
- Status: TODO (blokirano dok A1–A4 nisu ZAVRŠENO I TESTIRANO)
- Agent: —
- Fajlovi: izmena `src/lib/denis/surfaces/voice/voice-audio-config.ts`,
  `src/lib/denis/stations/station-voice-context.ts`, config tip po stanici
- Zadatak: povezati A1 (VAD) + A2 (noise profil) + A3 (wake word) + A4
  (push-to-talk) u tri konfigurabilna režima kako je opisano u razgovoru:
  Sala (wake word, blag noise-gate), Kuhinja (wake word + agresivan noise
  profil), Industrijska buka (push-to-talk kao primarni mod). Ovo je
  integracioni zadatak — mora ići poslednji.

---

## Dnevnik

| Datum | Agent | Zadatak | Opis |
|---|---|---|---|
| 2026-07-08 | Cursor Agent (Composer) | A1 | VAD modul (energy+ZCR) + integracija u use-denis-voice — STT starta tek posle potvrde govora |
| 2026-07-08 | Cursor Agent (Composer) | A2 | Industrial noise profil + openIndustrialVoiceAudioPipeline (spektralna supresija, sala default netaknut) |
| 2026-07-08 | Cursor Agent (Composer) | A3 | Wake word detektor (Hej Denise) + requireWakeWord opcija u use-denis-voice |
| 2026-07-08 | Cursor Agent (Composer) | A4 | Push-to-talk režim — VoiceInputMode + hold dugme na kuhinja/šank strip-u |

---

## Univerzalni prompt za agente (kopiraj ceo blok u Cursor)

Isti prompt šalješ svakom Cursor agentu/tabu. Task board (ovaj fajl) rešava
ko šta radi — ne moraš ručno da deliš zadatke.

```text
Radiš na projektu QR Order (Denis) po ADR-051 planu za voice noise isolation.
Prati protokol DOSLOVNO, redom:

1. PROČITAJ (obavezno, pre bilo čega):
   - docs/architecture/ADR-051-voice-noise-isolation-task-board.md (jedini izvor
     istine ko šta radi — kontekst, zadaci, status)

2. PREUZMI I ODMAH OBELEŽI ZADATAK:
   - Nađi PRVI zadatak sa statusom TODO, redosled: sekcija A → sekcija B.
   - Zadatke sa statusom "RADIM NA TOME" NE DIRAJ — na njima radi drugi agent.
   - Sekcija B se ne sme početi dok SVI zadaci sekcije A nisu
     "ZAVRŠENO I TESTIRANO".
   - PRE nego što počneš bilo kakav rad, izmeni ADR-051-voice-noise-isolation-task-board.md:
       Status: RADIM NA TOME
       Agent: <tvoje ime/ID> — <današnji datum i vreme>
     i SAČUVAJ fajl PRE nego što pišeš ijednu liniju koda. Tako drugi agenti
     koji čitaju isti task board znaju da je zadatak zauzet i ne rade duplo.
   - Jedan agent = jedan zadatak. Sledeći uzimaš tek kad ovaj zatvoriš.

3. URADI ZADATAK tačno po opisu iz table (fajlovi, cilj, zavisnosti su tamo
   navedeni). Ključna pravila:
   - Ne diraj postojeću eskalacionu logiku u src/lib/denis/stations/ i
     src/lib/denis/notifications/ — ona već radi (timeout → urgent →
     menadžer), ovaj ADR samo dodaje audio sloj ISPOD nje.
   - Ne menjaj default ponašanje postojećeg openVoiceAudioPipeline
     (src/lib/denis/surfaces/voice/voice-audio-config.ts) za salu — dodaj
     nove profile/module pored njega.
   - Nema novih funkcija van opisanog opsega zadatka, nema refaktorisanja
     nepovezanog koda.
   - Piši test za svaki novi modul.

4. VERIFIKUJ — sva 4 moraju biti zelena, bez izuzetka:
   - pnpm test:run
   - pnpm type-check
   - pnpm lint
   - pnpm build

5. ZATVORI ZADATAK na tabli (isti fajl):
   - Status: ZAVRŠENO I TESTIRANO
   - Napomena: 1-2 rečenice šta je urađeno
   - Dodaj red u tabelu "Dnevnik" na dnu
   - Komituj kod + ažuriranu tablu ZAJEDNO, poruka: "ADR-051 <ID zadatka>: <kratak opis>"

6. AKO ZAPNEŠ:
   - Status: BLOKIRANO + tačan razlog u Napomena
   - Uzmi sledeći TODO iz iste sekcije. Nikad ne ostavljaj zadatak na
     "RADIM NA TOME" ako ne radiš aktivno na njemu.

ZABRANJENO: dva zadatka odjednom, menjanje eskalacione logike u
stations/notifications, početak sekcije B pre nego što je sekcija A cela
završena, commit sa crvenim testovima/type-check/lint/build.
```

### Napomena za vlasnika (Jovica)

- Sekciju A možeš pustiti sa 3-4 Cursor taba paralelno — zadaci A1-A4 su
  nezavisni po fajlovima (osim A1/A3 koji dele `use-denis-voice.ts`, agenti
  će to videti u opisu zadatka i koordinisati kroz task board status).
- Sekcija B ide tek kad je cela sekcija A zelena — jedan agent, integracioni
  zadatak.
- Napredak pratiš otvaranjem ovog fajla — "Dnevnik" na dnu je hronologija.
