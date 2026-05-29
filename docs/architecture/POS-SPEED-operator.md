# POS Speed — Operator mode (Vera Maximum POS)

> **Za tebe (Jovica):** **SVI promptovi u jednom fajlu:** [POS-SPEED-all-prompts.md](./POS-SPEED-all-prompts.md)  
> Detalj scope: [POS-SPEED-session-prompts.md](./POS-SPEED-session-prompts.md) · **Arhitektura:** [POS-SPEED-ARCHITECTURE.md](./POS-SPEED-ARCHITECTURE.md) · **Verify:** [POS-SPEED-verification-checklist.md](./POS-SPEED-verification-checklist.md)

---

## Usvojeno (zakucano)

| Nivo | Šta | Agent track |
|------|-----|-------------|
| **P0** | Server quick wins + UI unblock | jedan agent |
| **P1** | **M1** Local-first PWA + idempotency | jedan agent |
| **P2** | **M2** Kitchen provisional broadcast | jedan agent (ili P2A+P2B paralelno) |
| **P3** | Denis staff signal + polish | jedan agent |
| **Parent** | Ti proveravaš — bez koda | P0 verify |

**Ne graditi:** drugi order engine · client TSE · CRDT · Venue Cell (M4) · LAN P2P.

**Fiskal:** TSE samo na plaćanje — `runFiscalPipeline` — **ne dirati timing**.

---

## Redosled wave-ova

```
Wave 0   P0  server defer outbox + parallel queries + UI fixes
    ↓
Wave 1   P1  M1 local-first + clientOrderId + migration 00112
    ↓
Wave 2   P2  M2 provisional → KDS (broadcast + merge UI)
    ↓
Wave 3   P3  Denis staff signal + trust UI polish
    ↓
Parent   TI  POS-SPEED-verification-checklist.md
```

**Paralelno (opciono Wave 2):** P2A emit · P2B KDS — samo posle P1 PASS.

---

## Promptovi — kopiraj jedan

### 🟢 Default (sledeći track)

```
POS Speed operator mode. Pročitaj docs/architecture/POS-SPEED-parallel-agents.md i uradi sledeći nedovršeni track (P0→P3, jedan po sesiji). IMPLEMENTIRAJ kod + testovi PASS. Session report. Ne commit-uj osim ako kažem.
```

### 🟡 Konkretan track

```
POS Speed — Agent P0. COPY-PASTE blok iz docs/architecture/POS-SPEED-parallel-agents.md §Wave 0. IMPLEMENTIRAJ kod. pnpm test:run + type-check + lint + build. Session report. Ne commit-uj.
```

Zameni `P0` sa: `P1`, `P2`, `P2A`, `P2B`, `P3`.

### 🔵 Paralelno (Wave 2)

```
POS Speed Wave 2 paralelno — pošalji OBA agenta:
- Agent P2A (provisional emit) — blok iz POS-SPEED-parallel-agents.md
- Agent P2B (KDS consume) — blok iz POS-SPEED-parallel-agents.md
Posle oba: ti Parent verify.
```

### 🟣 Parent verify (ti)

```
POS Speed Parent P0 verify. Pročitaj docs/architecture/POS-SPEED-verification-checklist.md. Pokreni testove/build. Manual smoke checklist. Session report. Popravi gapove ako FAIL.
```

### ⚪ Commit

```
Commituj POS Speed P[X] rad sa porukom u stilu repoa. Ne push-uj.
```

### 🔴 Fix (kad verify FAIL)

```
POS Speed FIX agent. Parent verify FAIL: [nalepi FAIL stavke]. COPY-PASTE blok iz POS-SPEED-parallel-agents.md §Fix agent. Minimal fix + svi gate-ovi PASS. Ne commit-uj.
```

### 🟠 Migration (posle P1)

```
POS Speed Agent MIG. Proveri/kreiraj 00112_staff_order_idempotency.sql po ADR-001-safe-rollout. Ne push remote. Session report.
```

---

## Session report (agent popunjava)

```markdown
## POS Speed — Track P[X]

| Gate | Result |
|------|--------|
| git diff u scope-u | |
| pnpm test:run (navedeni) | PASS/FAIL |
| pnpm type-check | PASS/FAIL |
| pnpm lint | PASS/FAIL |
| pnpm build | PASS/FAIL |

### Fajlovi
- ...

### Feature flags
- POS_LOCAL_FIRST / POS_KITCHEN_PROVISIONAL: ...

### Fiscal regression
- staff create outbox excludes fiscal.tse_sign: YES/NO

### Notes / blockers
```

---

## Pilot env (posle P1)

```bash
# .env.local (pilot location)
POS_LOCAL_FIRST=true
POS_KITCHEN_PROVISIONAL=true   # posle P2
# opciono: POS_LOCAL_FIRST_LOCATIONS=uuid1,uuid2
```
