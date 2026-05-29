# Denis — Start Here (Architecture)

| Field | Value |
|-------|--------|
| **Purpose** | One page — what we build, why, in what order |
| **Product** | **Denis** — global POS + Table OS; **Viktor** = partner operator layer |

---

## The bet (one paragraph)

**Denis runs the restaurant floor** — guest, waiter, kitchen, payments, AI waiter at every table, alone, with no external wait. **Viktor runs the owner’s wider business** in Slack — and **reads Denis** via Operator API + webhooks. Together: owner operates everything except in-room work. Denis becomes the **hospitality connector in Viktor’s world** (like essential tools in a developer’s Cursor stack). Architecture is built for that flywheel, not for two AIs at one table.

---

## Stack (5 planes)

```
5  OPERATOR     Viktor · analytics · proposals     ← read Denis, never block guest
4  INTEGRATION  POS · delivery · Stripe · Viktor    ← ADR-029 three channels
3  TABLE OS     Denis mind · signal/view · ACT
2  PLATFORM     Order Core · outbox · KDS · fiscal modules
1  TRUTH        timeline · orders · journal
```

---

## Integration (how partners connect)

**Master:** [ADR-029 Integration Spine](./ADR-029-denis-integration-spine.md)

```
External system
    │
    ├─ A Egress    Operator API + webhooks  (Denis → out, read-only)
    ├─ B Ingress   validated signals in     (partner → Denis loop)
    └─ C Connector outbox adapters          (POS push, catalog sync)
    │
    ▼
TRUTH boundary — guest path never imports integration code
```

**Viktor:** first **operator** connector — [ADR-028](./ADR-028-viktor-denis-integration.md). Same API any future BI tool would use.

---

## Locked rules (never break)

1. Denis **standalone** at table — Viktor **never** in guest hot path  
2. **Operator API** (`/api/operator/v1/`) — contract-first egress  
3. **Webhooks** — async, versioned payloads, outbox-only dispatch  
4. **ADR-025** routing — relational / transactional, not regex banter  
5. **Write = proposal** — owner approves config/playbook changes  
6. **Global core** — DE/US/UK = market modules, not forks  
7. **Comprehend-first** — ADR-030; template never interprets guest input  

Full list: [DENIS-TABLE-OS-ARCHITECTURE.md §18](./DENIS-TABLE-OS-ARCHITECTURE.md) · [ADR-030](./ADR-030-denis-conversation-comprehension.md)

---

## Build order

| Step | What | Doc |
|------|------|-----|
| I0 | ADR-025 cognition + waiter eval O1 | ADR-025 |
| I1 | Operator API read + audit | ADR-029 · [VIKTOR prompts § P1](./VIKTOR-DENIS-CURSOR-PROMPTS.md) |
| I2 | `denis.*` webhooks + session rollup | ADR-029 · [VIKTOR prompts § P2](./VIKTOR-DENIS-CURSOR-PROMPTS.md) |
| I3 | OpenAPI + contract tests | ADR-029-session-prompts |
| Partner | Viktor Skill (read-only) | ADR-028 V4 |

**Gate:** I1 does not start until I0 (`pnpm eval:denis` waiter parity ≥ 95%).

---

## Full docs

| Doc | Role |
|-----|------|
| [DENIS-TABLE-OS-ARCHITECTURE.md](./DENIS-TABLE-OS-ARCHITECTURE.md) | **Master spec** — product + planes |
| [ADR-029-denis-integration-spine.md](./ADR-029-denis-integration-spine.md) | **Integration north star** |
| [ADR-028-viktor-denis-integration.md](./ADR-028-viktor-denis-integration.md) | Viktor partner contract |
| [VIKTOR-DENIS-CURSOR-PROMPTS.md](./VIKTOR-DENIS-CURSOR-PROMPTS.md) | Agent prompts P0–P4, V5 |
| [ARCHITECTURE-INDEX.md](./ARCHITECTURE-INDEX.md) | All ADRs |

---

## Agent one-liner

```
Pročitaj DENIS-ARCHITECTURE-START-HERE.md + ADR-029 + VIKTOR-DENIS-CURSOR-PROMPTS.md.
Implementiraj sledeći I-track. Guest path bez operator/ importa. Testovi PASS.
```
