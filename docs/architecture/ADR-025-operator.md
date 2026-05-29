# ADR-025 — Operator mode (TDE State-Driven Routing)

> **Za tebe (Jovica):** nalepi **jednu liniju** ispod.  
> **Implement agent:** [ADR-025-session-prompts.md](./ADR-025-session-prompts.md)  
> **Review agent:** [ADR-025-verification-checklist.md](./ADR-025-verification-checklist.md)

---

## Zakucano

| Sloj | Pravilo |
|------|---------|
| **Director** | State + beliefs biraju plan — ne food regex |
| **L0** | T0 / handoff — 0 kredita |
| **L1** | Fact templates — 0 kredita |
| **L2** | relational \| transactional perceive — default za free text |
| **Cost** | Tier + budget — ne template da uštediš mozak |

**Ne graditi:** proširivanje ORDERING_GUEST_PATTERN · banter.welcome kao default reply

---

## Promptovi — kopiraj jedan

### 🟢 Default (sekvencijalno T1→T3)

```
ADR-025 TDE state-driven routing operator mode. Pročitaj docs/architecture/ADR-025-session-prompts.md (status + T1 prompt).
Uradi sledeći nedovršeni track (T1→T3). IMPLEMENTIRAJ kod + testovi PASS. Session report. Ne commit-uj osim ako kažem.
```

### 🟡 Samo T1 (brzi fix — preporučeno prvo)

```
ADR-025 track T1. Pročitaj ADR-025-session-prompts.md §AGENT T1 + ADR-025-tde-state-driven-routing.md.
Fix decideTurnPlan: ukloni isCasualSocialGuestMessage gate, default relational_perceive. Unit tests A2–A6. Ne commit-uj.
```

### 🔵 Samo provera

```
ADR-025 status check. Pročitaj ADR-025-tde-state-driven-routing.md + decide-turn-plan.ts + compile-beliefs.ts.
Uporedi sa ADR §4. Session report. Bez koda.
```

### 🟣 Review

```
ADR-025 verification. Pročitaj ADR-025-verification-checklist.md. Proveri T1 implementaciju. Session report.
```

### ⚪ Commit

```
Commituj ADR-025 T1 rad sa porukom u stilu repoa. Ne push-uj.
```

---

## Redosled

| Track | Deliverable | Gate |
|-------|-------------|------|
| **T1** | Director + beliefs reorder | denis-tde.test A2–A6, A9 |
| **T2** | pressure beliefs + T0 može | eval beliefs + A1 |
| **T3** | evidence budget + eval | eval:denis |
| **Parent** | checklist + build | full gate |

---

## Brza dijagnoza (pre T1)

Broken path today:

```
guest "Daj mi sok"
  → isCasualSocialGuestMessage = true
  → banter.welcome (requiresLlm: false)
```

Target:

```
guest "Daj mi sok"
  → compileBeliefs: commerce.pressure open OR mode ordering
  → transactional_perceive (requiresLlm: true)
```
