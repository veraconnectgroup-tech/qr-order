# Denis Table OS — Session Prompts

> **Master architecture:** [DENIS-TABLE-OS-ARCHITECTURE.md](./DENIS-TABLE-OS-ARCHITECTURE.md)  
> **As-built map:** [denis-implementation-map.md](./denis-implementation-map.md)

---

## Phase status

| Phase | Scope | Status |
|-------|-------|--------|
| **O0** | ADR-025 T1–T3 cognition | T1 🔲 in progress |
| **O1** | Waiter parity eval (40 scenarios) | 🔲 |
| **O2** | World loop push = TELL | 🔲 |
| **O3** | Integration SDK + adapters | 🔲 |
| **O4** | Operator API (Viktor partner) | 🔲 |
| **O5** | Market US module | 🔲 |
| **O6** | Phase F signal/view GA | ✅ |

---

## Operator one-liner

```
Denis Table OS operator mode. Pročitaj docs/architecture/DENIS-TABLE-OS-ARCHITECTURE.md + DENIS-TABLE-OS-session-prompts.md.
Uradi sledeći nedovršeni O-track (O0→O6). IMPLEMENTIRAJ kod + pnpm verify:denis. Session report. Ne commit-uj osim ako kažem.
```

---

## O0 — Cognition (ADR-025)

See [ADR-025-session-prompts.md](./ADR-025-session-prompts.md) T1 → T2 → T3.

**Gate:** `pnpm test:run src/__tests__/denis-tde.test.ts` + eval beliefs.

---

## O1 — Waiter parity eval

```
Denis Table OS O1 — waiter parity eval fixtures.

Pročitaj DENIS-TABLE-OS-ARCHITECTURE.md §13.

Kreiraj src/lib/denis/eval/fixtures/waiter-parity/scenarios.ts sa min 40 scenarija:
- SR/DE/EN confirm, ordering, banter at table, allergy, complaint, rush, 86, party conflict
- Svaki scenario: input message, fold overrides, expected plan kind OR expected intent, forbidden outputs (reservation, banter.welcome)

Dodaj src/lib/denis/eval/run-waiter-parity.ts + wire u pnpm eval:denis.

Gate: pnpm eval:denis PASS.
Ne commit-uj.
```

---

## O4 — Operator API (Viktor partner)

```
Denis Table OS O4 — Operator read API.

Pročitaj DENIS-TABLE-OS-ARCHITECTURE.md §7.3.

Scope:
- src/app/api/operator/v1/locations/[locationId]/summary/route.ts
- src/app/api/operator/v1/locations/[locationId]/denis/metrics/route.ts
- src/lib/operator/auth.ts — API key scope operator:read, org bound
- audit log svaki request

Read-only. No guest PII export without redaction flag.
Tests: src/__tests__/operator-api.test.ts

Ne commit-uj.
```

---

## Session report template

```markdown
## Denis Table OS — [O0/O1/…]

### Done
- [ ] files
- [ ] tests / eval

### Waiter parity
- scenarios added: N
- pass rate: X%

### Next
- O?
```
