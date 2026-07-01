# ADR-043 — Operator mode (Jovica)

> **Ti ne gradiš co-workera.** Ti držiš **redosled sesija** i merge-uješ.
> **Jedna sesija = jedan PR.** Faza 1: **S1 → S2 → S3 → S4 → S5 → S6 → S7** (S0 gotov). Faza 2: **S8–S14, tek posle S7 "go"**.
> **Status tabela:** u [ADR-043-session-prompts.md](./ADR-043-session-prompts.md) — agent je ažurira posle svake sesije.

---

## Kako radimo (jedna rečenica)

```
Faza 1: S1 temelj (station statusi) → površine (S2) → Denis mozak (S3) → menadžer (S4/S5/S6) → pilot (S7).
Faza 2: tek posle S7 "go" — S8 tempo · S9 86 · S10 desert · S11 stalni gost · S12 recovery · S13 obrt · S14 brifing.
```

---

## Šta TI radiš

| Ti | Agent |
|----|-------|
| Merge PR | Čita ADR-043 + session prompt |
| `supabase db push` (S1 migracija — pročitaj ADR-001-safe-rollout pre!) | Jedan PR = jedna sesija |
| QR test na iota posle S3 i S7 | Verifikacija (test/type-check/lint/build) |
| Kažeš „commituj" | Session report + ažurira status tabelu |

---

## Prompt za novi agent chat (uvek isti — promeni samo S broj)

```
ADR-043 sesija S1. Pročitaj docs/architecture/ADR-043-session-prompts.md
(obavezna literatura + tvoja sesija + pravila) i docs/architecture/ADR-043-denis-coworker-completion.md.
Proveri status tabelu — radi SAMO svoju sesiju, jedan PR.
Integracioni check sa dokazima. Session report. Ažuriraj status tabelu. Ne commit-uj.
```

Za S3 dodaj: `eval:denis PASS obavezno.`
Za S7 dodaj: `Verifikaciona sesija — kod menjaš samo za trivijalne bugfixove.`
Za S8, S10, S11, S12 dodaj: `eval:denis PASS obavezno.` (diraju Denis proactive/turn tokove)

---

## Kad sesija završi

1. Session report pregledan — svaki integracioni check ima dokaz
2. `pnpm test:run` nula novih failova vs baseline (26 na main-u, 2026-07-01)
3. Merge → za S1: `db push` po safe-rollout proceduri
4. Status tabela u session-prompts fajlu: ⬜ → ✅
5. Sledeća sesija

---

## Redosled i zavisnosti

**Faza 1:**

| Sesija | Šta daje | Sme paralelno sa |
|--------|----------|------------------|
| S1 | station statusi (temelj) | S5 (timeline bez station dela) |
| S2 | KDS/bar/waiter na stanicama | S4 |
| S3 | Denis istina po stanici | S4, S5 |
| S4 | Operations Center | S3, S5 |
| S5 | Order Timeline | skoro sve |
| S6 | Shift recap | — (posle S1+S3 najbolje) |
| S7 | Pilot verifikacija — **gate za Fazu 2** | ništa — poslednja u fazi |

**Faza 2 (posle S7 "go") — preporučen redosled po vrednosti za pare:**

| Sesija | Vlasnikov problem | Napomena |
|--------|-------------------|----------|
| S9 | 86 loop — Denis prodaje ono čega nema | **prva** — svaki promašaj košta poverenje gosta |
| S8 | Sto koji ćuti — prazne čaše, niko ne prilazi | druga runda pića = direktan promet |
| S10 | Desert/kafa u pravom trenutku | koristi S1 `served_at` |
| S13 | Obrt stola posle plaćanja | vredi najviše kad je gužva |
| S12 | Service recovery | koristi S4 + S5 |
| S11 | Stalni gost | nezavisna, može bilo kad |
| S14 | Brifing + nedeljni izveštaj | poslednja — sabira sve prethodne |

**Ako žuriš:** S1 → S2 → S3 je minimum za "Denis zna gde je piće a gde hrana". S9 + S8 su najbrže pare u Fazi 2.

---

## Realnost

| Šta | Koliko |
|-----|--------|
| S1 (temelj) | 1 sesija, najveći rizik — migracija + trigger |
| S2–S6 | po 1 sesija |
| Faza 1 (S1–S7) | ~7 sesija / 2–4 nedelje |
| Faza 2 (S8–S14) | ~7 sesija / 3–5 nedelja |
| Ceo ADR-043 | ~14 sesija / 2–3 meseca |

---

## Šta dolazi posle ADR-043

```
ADR-043: Denis zna smenu, stanice, gosta i prihod.
ADR-044: Denis čuva novac, račune i vlasnika (loss prevention) — kreće posle S7 "go".
ADR-045: Denis pamti pravu stvar na pravom nivou (memory model) — poslednji.
```

Operator promptovi za njih su u [ADR-044-session-prompts.md](./ADR-044-session-prompts.md) i [ADR-045-session-prompts.md](./ADR-045-session-prompts.md) (na vrhu fajla).

---

*End*
