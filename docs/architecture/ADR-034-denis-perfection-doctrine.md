# ADR-034: Denis Perfection Doctrine

| Field | Value |
|-------|--------|
| **Status** | **Accepted** — overrides „ne diraj arhitekturu“ kada eval ili pilot kažu drugačije |
| **Date** | 2026-05-29 |
| **Supersedes** | Ništa — **menja način izvršavanja** ADR-019/023/033, ne njihovu viziju |
| **Active tracker** | [ADR-033-active-tracker.md](./ADR-033-active-tracker.md) |
| **North star** | Denis = **savršen konobar** — merljivo, ne subjektivno |

---

## 0. One sentence

**Perfection beats preservation** — if the architecture blocks perfect waiter behavior, we **change the architecture**, not lower the bar.

---

## 1. Šta znači „savršen“ (merljivo)

Denis je savršen kad gost **nikad** ne oseti random chatbot. Samo ovo:

| # | Kriterijum | Test |
|---|------------|------|
| P1 | **Nikad ne ćuti** kad nešto fali u porudžbini | obligation eval + iota replay |
| P2 | **Nikad ne laže** o porudžbini / kuhinji | ACL + order honesty eval |
| P3 | **Sam piše** kad stanje skrene (gap, spremno, kasni) | autonomous tell + WORLD |
| P4 | **Razume celo stanje** pre odgovora | FSP + beliefs + cart + orders u svakom turnu |
| P5 | **Jedna istina** — chat = view = push = kuhinja | transcript TRUTH, Phase F |
| P6 | **Reflex prvo, LLM kad mora** | `llm_invocation_rate` ≤ 35% elite |
| P7 | **Dva telefona, jedan sto** — bez race | Actor FIFO |
| P8 | **Povratni gost pamti** (uz saglasnost) | memory u FSP |
| P9 | **Regresija nemoguća** | eval:denis + iota fixtures u CI |
| P10 | **Viktor čita, ne blokira** | guest path bez operator importa |

**Savršenstvo nije „lepši tekst“. Savršenstvo je ispravno ponašanje pod pritiskom.**

---

## 2. Pravilo iznad svih ADR-a

```
IF pilot ili eval FAIL na P1–P10
  AND uzrok je strukturalan (dual path, legacy, patch)
THEN menjamo arhitekturu u ACTIVE ADR sesiji
  NOT dodajemo treći patch na patch
```

**Zabranjeno:** „Još jedan if u kernel-ordering-bridge“ da obligation radi — obligation mora živeti u **MIND**, ne u legacy AI sloju.

**Dozvoljeno:** brisanje fajlova, spajanje puteva, nova ADR faza, migration — ako eval posle toga zeleni.

---

## 3. Arhitektonski dug — **MORA se ukloniti** (ne opcija)

Ovo je razlog zašto danas **nije** savršen — i zašto **moramo menjati** postojeću arhitekturu.

| ID | Problem danas | Ciljno stanje | ADR / faza |
|----|---------------|---------------|------------|
| **ARCH-1** | **Dva mozga:** `runDenisTurn` + `lib/ai/ordering/*` bridge | Jedan cognition → ACT put | ADR-034-A |
| **ARCH-2** | Obligation/gap logika i u `kernel-ordering-bridge` i u `cognition/waiter` | Samo `cognition/waiter` + beliefs | ADR-032 COMPLETE → 034-A |
| **ARCH-3** | Perceive kroz legacy `perceive-guest-chat-turn` + shim | `cognition/perceive` jedini ulaz | ADR-034-A |
| **ARCH-4** | ~~Transcript dual-write~~ | **Timeline only** ✅ | ADR-019-F COMPLETE |
| **ARCH-5** | ~~Guest poll + React merge~~ | **View/SSE only** ✅ | ADR-019-E COMPLETE |
| **ARCH-6** | Turn-based osećaj (čeka poruku) | Continuous mind (watcher + world) | ADR-020 + 032 autonomous |
| **ARCH-7** | Regex/routing hints ponekad lažu plan | L3 goal-directed `InterpretationTask` | Table OS §5 L3 |

**Redosled:** ARCH-1/2/3 = **ADR-034-A** (nedeljama, posle ADR-032). ARCH-4/5 = ADR-019 E/F. ARCH-6/7 = kasnije faze.

---

## 4. ADR-034-A — Architecture Unification (novi ACTIVE posle 032)

**Trajanje:** 4–6 nedelja · **Cilj:** jedan mozak, nula legacy ordering u guest hot path.

### Acceptance (sve mora PASS)

```bash
# Nema legacy ordering u guest cognition putu
grep -rn "kernel-ordering-bridge\|applyPostLlmOrdering" src/lib/denis/runtime/ src/components/guest/
# → samo cognition/ ili act/ wrapper, ne lib/ai/ordering direktno u turn

# Jedan perceive entry
grep -rn "perceiveGuestChatTurn\|executeChatTurn" src/lib/denis/runtime/
# → jedan canonical perceive module

pnpm eval:denis && pnpm verify:denis
# iota 5 scenarija
```

### Koraci (jedan PR po sesiji)

| Korak | Deliverable |
|-------|-------------|
| 034-A.1 | `cognition/order/` — `applyOrderComprehend()` iz bridge logike — **CODE** |
| 034-A.2 | `run-denis-turn` koristi samo cognition order — bridge deleted — **CODE** |
| 034-A.3 | Obligation u DECIDE/TELL — bridge nema gap logiku — **CODE** |
| 034-A.4 | Obriši mrtve shim-ove; ažuriraj import matrix — **CODE** |
| 034-A.5 | Eval + iota → označi 034-A COMPLETE — **CODE** (2026-06-07) |

---

## 5. Kada smemo menjati prihvaćeni ADR

| Situacija | Akcija |
|-----------|--------|
| Eval FAIL, patch bi bio 4. sloj | **ADR-034-A** refactor |
| Dva orchestratora u praksi | Ukinuti jedan — ADR-019 pobeđuje |
| LLM rate > 50% na pilotu | Jači template + beliefs, ne jači model |
| Novi ADR kontradiktira P1–P10 | **ADR-034 wins** — ažuriraj stariji ADR napomenom |
| „Sci-fi“ AGI chat | **Odbij** — van scope ADR-023 §11 |

Svaka strukturna promena: **kratka ADR amend sekcija** + eval fixture koji dokazuje poboljšanje.

---

## 6. Šta se NE menja (invarianti)

Ovo su **zakucana pravila** — savršenstvo ih poštuje, ne ruši:

- `SIGNAL → FOLD → DECIDE → ACT → TELL → PROJECT`
- ACL jedini put u Order Core
- Timeline append-only
- Guest: samo `signal` + `view`
- Viktor/operator: samo egress sa TRUTH granice
- Eval gate pre merge

**Menjamo implementaciju unutar loop-a. Ne menjamo loop u chatbot.**

---

## 7. Redosled sa ADR-033 trackerom

```
ADR-032 (obligation)     → ACTIVE sada
        ↓ COMPLETE
ADR-034-A (unifikacija)  → jedan mozak, bez legacy bridge
        ↓ COMPLETE
ADR-019 Phase D          → WORLD
ADR-019 Phase E          → Actor/SSE
ADR-019 Phase F          → transcript TRUTH
… ostatak tracker reda
```

**Perfection nije preskočiti 034-A** da bismo „brže“ na Viktor — dual brain = nikad savršen.

---

## 8. Agent prompt

```
ADR-034 perfection mode. Pročitaj ADR-034-denis-perfection-doctrine.md.
Radi ACTIVE ADR iz tracker-a. Ako eval failuje strukturno — predloži ARCH fix, ne patch.
Jedan PR. eval:denis PASS. Ne commit-uj.
```

---

## 9. Za Jovicu (jedna linija)

```
Savršen Denis > stara arhitektura. eval fail = menjamo strukturu, ne spuštamo bar.
```

---

*End of ADR-034*
