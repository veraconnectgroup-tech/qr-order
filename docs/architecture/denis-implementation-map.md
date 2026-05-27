# Denis — Implementation Map & Compliance

| Field | Value |
|-------|-------|
| **Status** | Active — enforce on every Denis PR |
| **North star** | [ADR-005 Maximum](./ADR-005-denis-maximum.md) |
| **Kernel** | [ADR-004](./ADR-004-denis-kernel.md) |
| **Platform spine** | [ADR-003](./ADR-003-denis-platform-v2.md) |
| **Bootstrap** | [ADR-002 detail](./ADR-002-denis-architecture-detail.md) |

---

## 1. Purpose

This document is the **single operational map** between ADRs and code.  
Before writing Denis code, read ADR-005. Before merging, run **`pnpm verify:denis`**.

---

## 2. Five layers → folders

| Layer | ADR | Folder | Owns |
|-------|-----|--------|------|
| **L1 Platform** | ADR-003 | `src/lib/denis/platform/` | `denis_timeline`, fold, replay, Flow DSL files |
| **L2 Kernel** | ADR-004 | `src/lib/denis/kernel/` | beliefs, goals, VKG, conflict, correction, scheduler |
| **L3 Venue OS** | ADR-005 §5 | `src/lib/denis/venue/` | floor graph, party, ops beliefs, staff copilot |
| **Runtime** | ADR-003 PPAN+ | `src/lib/denis/runtime/` | `runDenisTurn`, perceive/plan/act/narrate |
| **L4 Surfaces** | ADR-005 §6 | `src/lib/denis/surfaces/` | chat, nudge, voice formatters (no business logic) |
| **L5 Learning** | ADR-005 §7 | `src/lib/denis/learning/` | learned edges queue, guest memory |
| **Eval** | ADR-005 §7.3 | `src/lib/denis/eval/` + `/eval` | fixtures, score, shadow helpers |
| **ACL** | ADR-003 §8 | `src/lib/denis/acl/` | `DenisOrderCommand` → Order Core only |
| **Config** | ADR-002 §7 | `src/lib/denis/config/` | `ConciergeConfig` schema, merge, cache |

**Legacy (transitional):** `src/lib/ai/**` remains until M7 cutover. New Denis logic goes in `src/lib/denis/**`, not into growing `chat-service.ts`.

---

## 3. Hard boundaries (invariants)

| Rule | Violation |
|------|-----------|
| Only **ACL** + legacy `order-executor.ts` may call Order Core create path | Direct `create-order` import elsewhere in AI |
| Only **ACT** / ACL mutates cart & orders | LLM handler writes draft without skill path |
| **T3 never decides** | `proposedItems` / submit in narration schema |
| **Timeline append-only** | UPDATE/DELETE on `denis_timeline` |
| **No module-level mutable state** | `new Map()` / `new Set()` at file scope in `src/lib/denis/` |
| **No duplicate side effects** | Old fire-and-forget + outbox for same event |
| **One PR = one M-track** | M1 config only, M2 timeline only, etc. |

---

## 4. Import matrix (enforced by `pnpm verify:denis`)

Rows import **only** columns marked ✓.

| Importer ↓ / Import → | config | platform | kernel | venue | runtime | surfaces | acl | learning | eval | openai | create-order |
|-----------------------|--------|----------|--------|-------|---------|----------|-----|----------|------|--------|--------------|
| config | — | | | | | | | | | | |
| platform | ✓ | — | | | | | | | | | |
| kernel | ✓ | ✓ | — | | | | | | | | |
| venue | ✓ | ✓ | ✓ | — | | | | | | | |
| runtime | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | | | ✓* | |
| surfaces | ✓ | | | | ✓ | — | | | | | |
| acl | | | | | | | — | | | | ✓ |
| learning | ✓ | ✓ | | | | | | — | | | |
| eval | ✓ | ✓ | ✓ | | ✓ | | | | — | | |

\* OpenAI only in `runtime/narrate/` and `runtime/perceive/slot-extract.ts` — nowhere else in `denis/`.

---

## 5. API target (M7+)

| Route | Role |
|-------|------|
| `POST /api/denis/turn` | Unified entry |
| `POST /api/denis/sense` | Sensory ingest without chat |
| Legacy `/api/ai/chat` | Thin wrapper → `runDenisTurn` |

Until M7: legacy routes stay; **no new business logic** in `chat-service.ts`.

---

## 6. M-track roadmap (execution order)

| Track | Deliverable | Folder |
|-------|-------------|--------|
| **M0** | Approve ADR-005 + this map | docs |
| **M1** | ✅ ConciergeConfig schema + merge | `config/` |
| **M2** | Timeline + minimal beliefs | `platform/` |
| **M3** | Goals + Flow DSL engine | `kernel/`, `platform/flows/` |
| **M4** | T0 + correction protocol | `kernel/` |
| **M5** | VKG v1 | `kernel/vkg/` |
| **M6** | Conflict resolver | `kernel/` |
| **M7** | Guest chat → `runDenisTurn` | `runtime/`, `surfaces/` |
| **M8** | Scheduler + sense API | `kernel/`, `platform/` |
| **M9** | Narration contract + lint | `runtime/narrate/` |
| **M10** | Eval + shadow cutover | `eval/` |
| **M11–M20** | UI-first, party, house, learn, voice | per ADR-005 §14 |

---

## 7. Verification

```bash
pnpm verify:denis
```

Checks:

1. Required layer folders + ADRs exist  
2. Import matrix respected under `src/lib/denis/`  
3. No module-level `Map`/`Set` in `src/lib/denis/`  
4. Order Core access only via ACL allowlist  
5. `chat-service.ts` line budget (legacy guard — must shrink after M7)  
6. Flow preset JSON valid  

Add to Denis PR checklist:

- [ ] Code in correct layer folder  
- [ ] `pnpm verify:denis` pass  
- [ ] `pnpm type-check` pass  
- [ ] One M-track scope only  

---

## 8. Operator prompt

```
Denis M-track mode. Read docs/architecture/denis-implementation-map.md + ADR-005.
Implement next open track only. Run pnpm verify:denis before finish.
Do not commit unless asked.
```
