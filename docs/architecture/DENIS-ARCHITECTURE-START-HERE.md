# Denis — Start Here (Architecture)

| Field | Value |
|-------|--------|
| **Purpose** | One page — what we build, why, in what order |
| **Product** | **Denis** — global POS + Table OS; **Viktor** = partner operator layer |
| **Implementation contract** | **[DENIS-FULL-IMPLEMENTATION-BACKLOG.md](./DENIS-FULL-IMPLEMENTATION-BACKLOG.md)** — status po stavci |
| **Phased plan (remainder)** | **[DENIS-PHASED-IMPLEMENTATION-PLAN.md](./DENIS-PHASED-IMPLEMENTATION-PLAN.md)** — F0→F9 |

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

**Viktor:** first **operator** connector — [ADR-028](./ADR-028-viktor-denis-integration.md).

---

## Locked rules (never break)

1. Denis **standalone** at table — Viktor **never** in guest hot path  
2. **Operator API** (`/api/operator/v1/`) — contract-first egress  
3. **Webhooks** — async, versioned payloads, outbox-only dispatch  
4. **ADR-025** routing — relational / transactional, not regex banter  
5. **Write = proposal** — owner approves config/playbook changes  
6. **Comprehend-first** — ADR-030; template never interprets guest input  
7. **Situation Pack** — ADR-031 C1; LLM sees full table truth every turn  

---

## Build order (current)

| Wave | What | Status |
|------|------|--------|
| **C0–C5** | Cognition spine (FSP, ACT, eval, contract, sim gate) | **CODE** on main |
| **Deploy** | iota + `denis_only` on pilot venue | **OPEN** |
| **D-PRO** | Proactive through same brain loop | **OPEN** ← next code |
| **D-EVAL** | Anticipation journey eval | **OPEN** |
| **I0→I3** | Operator API + webhooks | **PARTIAL** |
| **MR-9 / E3** | Org playbook pack | **OPEN** |

Full row-level status: **[DENIS-FULL-IMPLEMENTATION-BACKLOG.md](./DENIS-FULL-IMPLEMENTATION-BACKLOG.md)**  
**Fazni plan (F0→F9):** **[DENIS-PHASED-IMPLEMENTATION-PLAN.md](./DENIS-PHASED-IMPLEMENTATION-PLAN.md)**

**Gate:** I1 does not ship until I0 (eval green + waiter parity ≥95% + pilot deploy verified).

---

## Full docs

| Doc | Role |
|-----|------|
| [DENIS-PHASED-IMPLEMENTATION-PLAN.md](./DENIS-PHASED-IMPLEMENTATION-PLAN.md) | **F0→F9 phased plan** |
| [DENIS-FULL-IMPLEMENTATION-BACKLOG.md](./DENIS-FULL-IMPLEMENTATION-BACKLOG.md) | Row status CODE/OPEN |
| [denis-implementation-map.md](./denis-implementation-map.md) | Code ↔ ADR map |
| [DENIS-TABLE-OS-ARCHITECTURE.md](./DENIS-TABLE-OS-ARCHITECTURE.md) | Master spec |
| [ADR-031](./ADR-031-denis-maximum-cognition-phases.md) | Cognition phases C0–C5 |
| [ARCHITECTURE-INDEX.md](./ARCHITECTURE-INDEX.md) | All ADRs |

---

## Agent one-liner

```
Read DENIS-PHASED-IMPLEMENTATION-PLAN.md. Implement next open step (F0→F9).
One PR per step. pnpm eval:denis. Update DENIS-FULL-IMPLEMENTATION-BACKLOG.md.
```
