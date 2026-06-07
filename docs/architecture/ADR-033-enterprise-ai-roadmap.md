# ADR-033: Denis Enterprise AI — Multi-Year Roadmap

| Field | Value |
|-------|--------|
| **Status** | **Accepted** |
| **Date** | 2026-05-29 |
| **Horizon** | **2+ godine** — jedan ADR po **nedeljama**, ne jedan feature po satima |
| **Execution model** | **§2 ispod** — ovo je glavno pravilo |
| **Active ADR** | [ADR-033-active-tracker.md](./ADR-033-active-tracker.md) |
| **Agent prompts** | [ADR-033-session-prompts.md](./ADR-033-session-prompts.md) |
| **Operator** | [ADR-033-operator.md](./ADR-033-operator.md) |

---

## 0. One sentence

**Enterprise Denis = jedan ADR nedeljama, pa sledeći ADR — ne sve odjednom.**

---

## 1. Kako NE radimo (zauvek)

| ❌ Pogrešno | ✅ Kako radimo |
|------------|----------------|
| „Pametan Denis za 2 sata“ | **ADR-032 = 2–3 nedelje** |
| 5 ADR-a u jednom PR-u | **1 ACTIVE ADR**, mali PR-ovi unutar njega |
| F0+F2+F4 u jednoj sesiji | **Jedna sesija = jedan PR unutar ACTIVE ADR-a** |
| CODE na main = gotovo | **COMPLETE = eval + verification + DEPLOY** |
| Veći model = pamet | **Stanje + obligation + eval petlja** |

Viktor nije nastao za vikend. Denis enterprise neće ni.

---

## 2. Execution model — **jedan ADR = nedeljama**

Ovo je **jedini** način na koji gradimo pametnog Denisa.

```
┌─────────────────────────────────────────────────────────────┐
│  ACTIVE ADR (2–10 nedelja)                                  │
│    PR-1 → PR-2 → PR-3 → … → verification → DEPLOY         │
│    eval:denis uvek zelen                                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ COMPLETE
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  SLEDEĆI ADR u redu (ADR-033-active-tracker.md)             │
└─────────────────────────────────────────────────────────────┘
```

### Pravila

1. **Tačno jedan ACTIVE ADR** — vidi [active tracker](./ADR-033-active-tracker.md)
2. **Unutar ADR-a:** više PR-ova (A1, A2… ili koraci iz session-prompts), ali **isti ADR**
3. **Ne počinje ADR N+1** dok ADR N nije **COMPLETE**
4. **Svaka sesija agenta:** jedan PR, session report, ne commit osim ako operator kaže
5. **Svaki live iota bug:** fixture + eval u okviru **ACTIVE** ADR-a (ili hotfix PR istog ADR-a)

### Šta znači „nedeljama“

| ADR obim | Realno vreme tima |
|----------|-------------------|
| Mali (ADR-032 obligation) | **2–3 nedelje** |
| Faza loop-a (ADR-019 D/E/F) | **3–4 nedelje po fazi** |
| Enterprise brain (ADR-023 MR-9 + RAG) | **4–6 nedelja po track-u** |
| Integracija (ADR-029 + ADR-028) | **2–3 meseca** |

**F0–F9** iz [phased plan](./DENIS-PHASED-IMPLEMENTATION-PLAN.md) su **pod-koraci unutar ADR-a**, ne zamenjuju ADR redosled.

---

## 3. ADR redosled (ceo program)

Kompletna tabela sa statusom: **[ADR-033-active-tracker.md](./ADR-033-active-tracker.md)**.

Skraćeno:

| Faza života | ADR-i | Kumulativno |
|-------------|-------|-------------|
| **Pametan konobar** | ADR-032 → ADR-019 D/E/F | ~3 meseca |
| **Predviđa i piše sam** | ADR-020 Kad + ADR-031 hardening | +2 meseca |
| **Enterprise mozak** | ADR-023 MR-9, RAG, manifest | +3 meseca |
| **Operator platform** | ADR-029, ADR-028 Viktor | +4 meseca |
| **Full journey** | ADR-013/014 signals | +3 meseca |

**Minimum do enterprise:** ~12–18 meseci. **2+ godine** do Viktor + chain + global.

---

## 4. North star (ne menjati)

```
Denis = Viktor za sto.
  · Vidi celo stanje (FOLD + beliefs + obligation)
  · Sam piše (autonomous writer + proactive)
  · Nikad ne ćuti (waiter obligation)
  · Jedna istina (timeline + ACL)
```

---

## 5. Arhitektura — 6 ravni (konstanta kroz sve ADR-e)

```
ENTERPRISE  → manifest, quality contract, operator API
TEMPORAL    → actor, watcher, world signals
COGNITION   → beliefs, TDE, obligation, [LLM?]
POLICY      → flow, goals, VKG, ops
TRUTH       → timeline, orders, fiscal, memory
FACE        → signal + view + SSE
```

Loop: `SIGNAL → FOLD → DECIDE → ACT → TELL → PROJECT`

Detalji: [ADR-019](./ADR-019-denis-unified-brain.md) · [ADR-023](./ADR-023-denis-maximum-runtime.md).

---

## 6. Quality gate (svaki ADR, pre COMPLETE)

| Gate | Obavezno |
|------|----------|
| ADR verification checklist (ako postoji) | Da |
| `pnpm eval:denis` | PASS |
| `pnpm verify:denis` | PASS |
| Backlog redovi za taj ADR | CODE / DEPLOY |
| iota QR (ako guest-visible) | 5 scenarija |
| Active tracker | sledeći ADR = ACTIVE |

---

## 7. Dokumenti po ulozi

| Ko | Čita |
|----|------|
| **Jovica** | [ADR-033-operator.md](./ADR-033-operator.md) |
| **Implement agent** | [ADR-033-active-tracker.md](./ADR-033-active-tracker.md) + ACTIVE ADR doc + [session-prompts](./ADR-033-session-prompts.md) |
| **Review agent** | ACTIVE ADR verification checklist |
| **Status** | [DENIS-FULL-IMPLEMENTATION-BACKLOG.md](./DENIS-FULL-IMPLEMENTATION-BACKLOG.md) |

---

## 8. Šta je već urađeno (ne ponavljaj)

| ADR / track | Status |
|-------------|--------|
| ADR-030, ADR-031 C0–C5 | **COMPLETE** (CODE) |
| ADR-019 A, B, C | **COMPLETE** (CODE) |
| ADR-023 MR-0–MR-8 | **COMPLETE** (CODE) |
| ADR-032 | **ACTIVE** — obligation + autonomous tell (čeka deploy) |
| ADR-019 D, E, F | QUEUED |
| ADR-028, ADR-029 | QUEUED |

---

*End of ADR-033*
