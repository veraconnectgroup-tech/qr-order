# ADR-049: Denis Agentic Tool-Use Loop

| Field | Value |
|-------|--------|
| **Status** | **Proposed** — awaiting founder approval before Phase 1 begins |
| **Date** | 2026-07-07 |
| **Deepens** | [ADR-048](./ADR-048-denis-operational-knowledge-integration-catalog.md) Part II (Brain), Part V (Capability Engine), Part VI (Expert Registry), Part VII (Connectors — internal experts only, not external POS/reservation connectors) |
| **Reuses** | `src/lib/denis/acl/` (schema → validate → execute), `src/lib/denis/config/rollout.ts` (canary/shadow), `src/lib/denis/eval/` (eval harness), `src/lib/denis/commercial/metering.ts` (credit gating) |
| **Does not replace** | ADR-048 remains the constitution. This document names *how* Part V/VI become real code for the first time — it does not add a new top-level pillar. |

---

## 0. One sentence

**Denis stops answering from a snapshot taken at the start of the turn and starts actually checking — kitchen, stock, the bill — mid-conversation, the way a real colleague would, using the exact same "LLM proposes, policy executes" safety pattern already proven for order-taking.**

---

## 1. Why

Verified this session (not assumed): a guest turn today is a **single LLM call**, no loop. `runTdePerceive()` reads a *snapshot* of venue state (station stress, guest mental model — see ADR-048's Slice 0 unified operational context, shipped dark this session) gathered *before* the LLM runs, hands it all to one prompt, and whatever comes back is final. If the snapshot is stale, wrong, or simply doesn't contain what the guest actually asked ("is the salmon still available tonight?" when availability changed 30 seconds ago), Denis either guesses or gives a generic non-answer. A real waiter would just go check.

Zero function-calling exists anywhere in this codebase today (`callOpenAiChat` has no `tools` parameter — confirmed by direct inspection). This is genuinely new capability, not an extension of an existing mechanism.

The good news: the hard part — a safe boundary between "the LLM wants to do X" and "X actually happens" — **already exists and is proven in production** for order-taking. `src/lib/denis/acl/` is exactly the pattern: a Zod-validated intent (`DenisOrderCommand`), a validator that checks the intent against real catalog/price/stock truth, and an executor that's the *sole* path to the real side effect (comment in the code literally says "sole Denis path to Order Core create path"). This ADR extends that one proven pattern to more tools instead of inventing a second safety mechanism.

## 2. Decision

Denis's perceive step becomes a **bounded loop**, not a single call: LLM → (optional) tool call(s) → tool executor(s) → LLM sees real results → repeat, up to a hard cap → final narrated response. Every tool that can change state goes through the ACL pattern (schema, validate, execute, idempotency key) exactly like orders do today. Every read-only tool still returns a typed, validated result — never raw DB rows straight into the prompt.

This is the concrete implementation of ADR-048's:
- **Part V (Capability Engine)** — "can I do it right now" becomes a real per-tool check, not a document.
- **Part VI (Expert Registry)** — each tool is one named "internal expert" (Kitchen, Inventory, Waiter, Payments, Order Core) Denis can consult, mirroring the doc's `LocationExpertMap` shape for the internal-only case (external POS/reservation experts stay ADR-029/047 territory, out of scope here).

## 3. Tool catalog

Every tool below maps to a **real, already-existing function** — verified this session, not proposed net-new business logic. The loop wraps them; it does not reimplement them.

| Tool | Side effect? | Existing implementation |
|------|--------------|--------------------------|
| `check_kitchen_status` | No | `src/lib/denis/venue/ops/kitchen-load-model.ts` |
| `check_station_stress` | No | `resolveEffectiveVenueOps` (station queues, already the source for ADR-048 Slice 0) |
| `check_stock` / `check_availability` | No | `autoUnavailableProductIds()` — `src/lib/denis/intelligence/load-venue-inventory.ts` |
| `check_bill` | No | `loadSessionPaymentBeliefs()` — `src/lib/denis/acl/execute-denis-payment-handoff.ts` |
| `add_to_order` / `modify_order` | **Yes** | `executeDenisOrderCommand()` — `src/lib/denis/acl/execute-denis-order-command.ts` (already ACL) |
| `call_waiter` | **Yes** | `executeDenisWaiterHandoff()` — `src/lib/denis/acl/execute-denis-waiter-handoff.ts` (already ACL) |
| `request_payment` | **Yes** | `requestSessionPaymentInPerson()` — same file as `check_bill` |

**Explicitly not in this catalog:** anything requiring a capability this restaurant doesn't have connected (reservations, external POS reads) — those stay behind ADR-047's Capability Engine "NO, not connected" honesty rule, not silently omitted. Adding a new tool later means one new Expert Registry entry + adapter, never a Brain/loop change — same "swap the connector, not the brain" rule ADR-047 already locks for POS.

## 4. Safety model (non-negotiable)

1. **Side-effecting tools are ACL-only.** `add_to_order`, `call_waiter`, `request_payment` route through the *existing* schema→validate→execute functions unchanged. The loop is a new *caller* of that pattern, never a new *bypass* of it.
2. **Idempotency.** Every side-effecting tool call carries the same `idempotencyKey` convention already used for orders — a retried tool call (network blip, model retry) cannot double-call a waiter or double-charge.
3. **Hard round cap.** Max tool-call rounds per turn (recommend starting at 3, tunable via config — never unbounded). Hitting the cap without resolution means Denis says so honestly ("let me have a colleague check that") — never silently truncates or guesses.
4. **No claimed success on tool failure.** If a tool call errors or times out, that failure is a first-class result the LLM sees and must react to honestly — this is the direct fix for the "Denis confidently answers from stale/wrong data" failure mode named in this session's earlier audit.
5. **Cost is explicit, not implicit.** Multi-round tool use costs more tokens than today's single call. Reuse `assertSufficientCredits`/`finalizeTurnMetering` (`src/lib/denis/commercial/metering.ts`) with a per-round or capped-per-turn charge — decided and coded explicitly, mirroring the station-voice `meteredByCredits` precedent from this session, not left ambiguous.
6. **Read-only tools are still typed and validated**, not raw DB access spliced into the prompt — a tool's output schema is part of its definition, same rigor as the side-effecting ones, just without the execute/idempotency machinery.

## 5. Rollout — reuse existing mechanisms, build nothing new

- **Shadow first**: `shouldRunShadowDiff` (`src/lib/denis/config/rollout.ts`) — run the tool loop in parallel with today's single-call flow, log what it *would* have done, never let it answer a real guest, for at least one full multi-day pilot window before it ever speaks.
- **Canary ramp**: `isInCanaryCohort` — per-location, then per-session-cohort, exactly the ADR-048 Slice 0 precedent (0% → 5% → 25% → 100%), never a global flip.
- **Eval gate is the actual go/no-go**, not a formality (ADR-030 P6 precedent): extend `pnpm eval:denis` with tool-use scenarios covering — correct tool chosen, no tool-call when none needed (latency regression check), graceful handling of a failed/timed-out tool, no hallucinated success, multi-tool sequences (e.g. "where's my food and can I get another beer" → check kitchen + add to order in one turn) actually resolving in ≤3 rounds.

## 6. Relationship to other in-flight work

- Reads the **same unified operational context** shipped dark this session (ADR-048 Slice 0) as one of its evidence inputs — `check_kitchen_status`/`check_station_stress` tools are a natural place for that object to *also* surface once both are live, rather than staying a passive prompt block only.
- Entirely separate from **station-voice** (kitchen/bar talking to staff) and the in-flight **Realtime API migration** for it — different conversation engine, different risk surface. Not touched by this ADR.
- Sets up, but does not itself build, a path toward Denis's own **self-awareness** (a later roadmap item) — a tool loop with visible failure/timeout handling is the natural place to eventually track "how often am I actually right when I check."

## 7. Implementation phases

Honest scope, not padded: this is the real, comprehensive version — every tool above, full safety rails, full eval coverage, gradual rollout to every location — not a 2-tool demo. Each phase ships independently, tested, with its own commit/push discipline, and the next phase does not start until the previous one's stated gate passes.

| Phase | Deliverable | Rough scope |
|-------|-------------|-------------|
| **P0** | This ADR accepted. `callOpenAiChat` extended with optional `tools`/`tool_choice` params + `toolCalls` in `OpenAiCallResult` (additive, existing callers unaffected). | Small |
| **P1** | Tool-loop orchestrator (new module) wrapping `runTdePerceive`'s single call with the bounded multi-round loop. Read-only tools only (`check_kitchen_status`, `check_station_stress`, `check_stock`, `check_bill`) — no side effects yet, lowest risk slice. Shadow-only. | Medium |
| **P2** | Side-effecting tools (`add_to_order`, `call_waiter`, `request_payment`) wired through existing ACL executors. Idempotency + credit-metering decision made explicit. Still shadow-only. | Medium |
| **P3** | Tool-use eval scenarios (§5) built out fully — the real gate. Nothing in P4 starts until this is green. | Medium |
| **P4** | Canary rollout, one pilot location, 5% → 25% → 100% guest cohort, with the founder reviewing real transcripts at each step before the next ramp. | Ongoing, paced by real usage, not a fixed calendar date |
| **P5** | Multi-location default-on, remove the shadow/legacy single-call path once confidence is proven across more than one venue's real traffic pattern. | Ongoing |

No fixed end date is claimed here on purpose — P4/P5 are paced by real guest-facing evidence (per-location review), not a calendar. P0–P3 (the actual engineering) are the bulk of the build effort; P4/P5 are deliberately unhurried because this is the highest-stakes surface touched this session (guest-facing, side-effecting, real orders and real waiter interruptions).

## 8. Success criteria

| Metric | Target |
|--------|--------|
| Side-effecting tool call bypassing ACL | **0** — architecturally impossible, not just untested |
| Tool call without idempotency key | **0** |
| Turn exceeding the round cap silently (no honest fallback line) | **0** |
| Eval: correct tool selection | **≥ existing single-call baseline accuracy**, not a regression |
| Eval: hallucinated tool success on a failed/timed-out call | **0** |
| New tool added without a Brain/loop code change | **Required** (Expert Registry entry + adapter only) |

---

*End of ADR-049*
