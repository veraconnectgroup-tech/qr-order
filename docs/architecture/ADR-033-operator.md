# ADR-033 — Operator mode (Jovica)

> **Ti ne gradiš Denisa.** Ti držiš **redosled ADR-a** i merge-uješ.  
> **Jedan ADR = nedeljama.** Agent radi **jedan PR po sesiji** unutar **ACTIVE** ADR-a.  
> **Tracker:** [ADR-033-active-tracker.md](./ADR-033-active-tracker.md)

---

## Kako radimo (jedna rečenica)

```
Jedan ADR nedeljama → COMPLETE → sledeći ADR. Ne sve odjednom.
```

---

## Šta TI radiš

| Ti | Agent |
|----|-------|
| Merge PR | Čita ACTIVE ADR |
| QR test na iota | Jedan PR unutar tog ADR-a |
| Kažeš „commituj“ | `eval:denis` |
| Ažuriraš tracker kad ADR završi* | Session report |

\*Ili agent predloži, ti potvrdiš.

---

## Prompt za novi agent chat (uvek isti)

```
ADR-033 ACTIVE ADR mode. Pročitaj ADR-033-active-tracker.md.
Radi SAMO trenutni ACTIVE ADR. Jedan PR po sesiji. eval:denis PASS.
Session report. Ne commit-uj.
```

## Prompt sa stubom (ADR-035)

```
ADR-035 pillar [STUB_ID]. Pročitaj ADR-035-pillar-strengthening-plan.md + ADR-033-active-tracker.md.
Radi sledeći PR iz tabele ACTIVE ADR-a. Jedan PR. eval:denis PASS. Ne commit-uj.
```

**Batch:** [ADR-033-agent-batch-prompts.md](./ADR-033-agent-batch-prompts.md) — **AGENT-00 do AGENT-26**, copy-paste.

**Start:** AGENT-00 (commit) → AGENT-01 (deploy) → redom.

---

## Kad ADR završi (ti ili agent ažurira tracker)

1. `eval:denis` zelen
2. iota QR OK (ako guest vidi)
3. U [ADR-033-active-tracker.md](./ADR-033-active-tracker.md): trenutni → **COMPLETE**, sledeći → **ACTIVE**

---

## Realnost

| Šta | Koliko |
|-----|--------|
| Jedan ADR | **2–10 nedelja** |
| Ceo pametan Denis enterprise | **2+ godine** |
| Jedna agent sesija | **1 PR**, ne ceo ADR |

---

*End*
