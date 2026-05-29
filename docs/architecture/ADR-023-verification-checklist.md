# ADR-023 — Verification Checklist (Maximum Runtime)

> **Za review agenta** — ne implementiraj, samo grep/read/test/report.  
> **Literatura:** [ADR-023](./ADR-023-denis-maximum-runtime.md) · [ADR-019](./ADR-019-denis-unified-brain.md)

---

## Global (svaki MR)

| # | Provera | Kako |
|---|---------|------|
| G1 | Jedan PR = jedan MR | git diff scope |
| G2 | `pnpm verify:denis` PASS | pokreni |
| G3 | Nema LLM → Order Core | grep guest/components za create-order |
| G4 | Nema module-level Map/Set | `grep -rn "new Map\|new Set" src/lib/denis/` |
| G5 | Spine A–F netaknut | nema novog orchestratora |
| G6 | Template before LLM gde plan kaže | read TDE wire |
| G7 | `pnpm type-check` PASS | pokreni |

---

## MR-0 — Language + Leadership

```bash
test -f src/lib/ai/conversation-leadership.ts && echo OK
pnpm test:run src/__tests__/conversation-leadership.test.ts src/__tests__/ai-guest-language.test.ts
```

- [ ] `applyConversationLeadership` u perceive path
- [ ] `followGuest` iz ConciergeConfig u `resolveStickyGuestLanguage`
- [ ] `venueMenuLocale` u `buildSystemPrompt` odvojen od conversation lang
- [ ] Refusal patterns ne prolaze do guest UI

---

## MR-1 — compileBeliefs

```bash
test -f src/lib/denis/cognition/beliefs/compile-beliefs.ts && echo OK
grep -rn "compileBeliefs" src/lib/denis/
```

- [ ] 6 core beliefs minimum
- [ ] `confidence` + `source` na svakom belief
- [ ] Timeline `mind.beliefs_compiled`
- [ ] Eval fixture u `pnpm eval:denis`

---

## MR-2 — TDE + templates

```bash
test -f src/lib/denis/cognition/tde/decide-turn-plan.ts && echo OK
```

- [ ] Banter → plan ≠ transactional-only
- [ ] `template-utterance` pokriva sr/de/en minimum
- [ ] Unit tests bez OpenAI mock dependency gde moguće

---

## MR-3 — TDE wire

- [ ] `run-denis-turn` poziva compileBeliefs → decideTurnPlan pre perceive
- [ ] Template path preskače OpenAI (observability ili test mock)
- [ ] `pnpm eval:denis` PASS — order scenarios
- [ ] `resolve-runtime-profile` u cognition/

---

## MR-4 — Venue Manifest

- [ ] Zod schema parse ADR-023 §6 example
- [ ] Invalid manifest graceful fallback
- [ ] capabilities clamp

---

## MR-5 — Evidence

- [ ] Banter turn ne učitava full menu u prompt (review diff)
- [ ] commerce + transcript uvek prisutni

---

## MR-6 — Menu RAG

- [ ] productId iz evidence postoji u catalog
- [ ] Gate kad capability off

---

## MR-7 — Quality Contract

- [ ] `turn_profile` ili ekvivalent u timeline/observability
- [ ] Refusal fixtures fail contract

---

## MR-8 — Sim gate

- [ ] Manifest promote blocked on sim fail
- [ ] Rollback documented

---

## MR-9 — Org pack

- [ ] Org-level playbookPackId
- [ ] Location override still works

---

## Review session report template

```markdown
## Denis Maximum Runtime verification — MR-[X]

### Verdict
PASS / FAIL / PARTIAL

### Global G1–G7
| Check | OK? | Notes |

### MR-specific
| Check | OK? | Notes |

### Tests run
| Command | Result |

### Regressions
- …

### Preporuka
- Merge / fix / needs MR-[Y] first
```
