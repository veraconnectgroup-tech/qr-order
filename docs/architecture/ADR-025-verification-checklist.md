# ADR-025 — Verification checklist (TDE State-Driven Routing)

> **Architecture:** [ADR-025-tde-state-driven-routing.md](./ADR-025-tde-state-driven-routing.md)

---

## G1 — Director invariants

- [ ] `decideTurnPlan` ne koristi `isCasualSocialGuestMessage` u routing uslovu
- [ ] `planForBanter()` obrisan ili nije reachable iz guest reply path
- [ ] Default fallback nije `banter.welcome` — jeste `relational_perceive`
- [ ] `inferConversationMode()` uklonjen iz decide-turn-plan (beliefs only)
- [ ] T0 / handoff / slot / goal templates i dalje rade (regression)

## G2 — Beliefs (T2+)

- [ ] `commerce.pressure` compiled iz state + flowNodeId
- [ ] `commerce.awaiting_confirm` = true kad pressure === confirm
- [ ] `conversation.mode` ordering pre casual banter kad cart/orders open
- [ ] Beliefs logovani u timeline (`mind.beliefs_compiled`) — count ažuriran u eval

## G3 — T0 contextual (T2+)

- [ ] `može` na recap/confirm flow → T0 reflex (usedT0)
- [ ] `može` bez confirm context → **ne** T0 confirm (relational perceive OK)

## G4 — Test matrix (ADR-025 §12)

| Case | Pass |
|------|------|
| A1 Može + confirm | ☐ |
| A2 Može + no pressure | ☐ |
| A3 Daj mi sok | ☐ |
| A4 Merhaba | ☐ |
| A5 gde si legendo | ☐ |
| A6 2x cola | ☐ |
| A7 da @ recap | ☐ |
| A8 velika @ slot | ☐ |
| A9 ordering belief + hello | ☐ |
| A10 to je sve | ☐ |

## G5 — Build gates

```bash
pnpm test:run src/__tests__/denis-tde.test.ts
pnpm eval:denis
pnpm type-check
pnpm lint    # 0 errors
pnpm build
```

## G6 — Anti-patterns (grep)

```bash
# Routing must not reference casual social gate
grep -n "isCasualSocialGuestMessage" src/lib/denis/cognition/tde/decide-turn-plan.ts
# Expected: no match OR export-only comment — NOT in decideTurnPlan body

grep -n "planForBanter" src/lib/denis/cognition/tde/
# Expected: no matches

grep -rn "new Map\|new Set" src/lib/denis/cognition/
# No module-level mutable session cache
```

## G7 — Non-goals respected

- [ ] ORDERING_GUEST_PATTERN nije proširen za sok/juice/merhaba
- [ ] ACL / act submit / fiscal netaknuti
- [ ] src/lib/ai/* legacy orchestrator netaknut

## G8 — Manual smoke (optional pilot)

- [ ] Guest chat: Denis pita za piće → guest „Može“ → razumljiv odgovor (ne generic welcome)
- [ ] „Daj mi sok“ → perceive / cart action (ne banter template)
- [ ] „Merhaba“ → odgovor na turskom ili inferred lang (ne fiksno venue DE)

---

## Session report (review agent)

```markdown
## ADR-025 verification — [T1/T2/T3/All]

G1–G8: [pass/fail + notes]
eval:denis: [pass/fail]
Blockers: [none / list]
Ready to commit: [yes/no]
```
