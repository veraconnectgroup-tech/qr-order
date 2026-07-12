# ADR-052: Denis Integration Builder

| Field | Value |
|-------|--------|
| **Status** | **Proposed** — design only, awaiting founder approval before Phase 0 begins |
| **Date** | 2026-07-12 |
| **Deepens** | [ADR-048](./ADR-048-denis-operational-knowledge-integration-catalog.md) Part VII (Connectors) — specifically VII.3's POS matrix "Code" column (today hand-filled: `adapter` / `stub` / `—`) and VII.6's "Connect Hub" admin flow, which today is a diagram, not a real pipeline |
| **Reuses** | `src/lib/denis/acl/` (schema → validate → execute), `src/lib/denis/agentic/` (`AgenticToolDefinition`, `dryRun` gate), `src/lib/integrations/registry.ts` (`CONNECTOR_CATALOG`, `resolveConnectorStatuses`), `src/lib/integrations/pos-capability-matrix.ts` (`resolvePosCapabilities`), `src/lib/denis/config/rollout.ts` (canary/shadow), `src/lib/denis/eval/run-tool-use-fixture.ts` (`THROWING_ADMIN` sandbox isolation pattern) |
| **Does not replace** | ADR-048 remains the constitution. This ADR names how VII's "Connect Hub" and POS matrix become a real, safe generation pipeline instead of a hand-maintained table — it does not add a new top-level pillar, and it does not replace the already-shipped Integration Registry or Capability Matrix, only extends them. |

---

## 0. One sentence

**Denis stops requiring a human engineer to hand-write every new POS/API adapter from scratch — instead, a human uploads documentation (OpenAPI, Postman, PDF), an AI-assisted pipeline drafts the adapter and a capability report, and a human still makes every decision with real consequences, exactly the same "LLM proposes, deterministic code decides, human approves" boundary already proven for order-taking (ACL) and mid-conversation tool use (ADR-049).**

## 1. Why

Verified this session: `CONNECTOR_CATALOG` (`src/lib/integrations/registry.ts`) lists seven connectors, one (`deliverect`) with `builtInCode: true`, six marked `false` — each of those six needs a real, hand-written adapter before it can ever move past `not_built`. ADR-048's own VII.3 POS matrix has carried this as a manually-updated table since it was written; nothing automates filling in a "Code" cell. Every new POS integration today means an engineer reading vendor docs, writing a `PosAdapter` implementation by hand, and hoping nothing in the docs was missed — exactly the kind of repetitive, error-prone, documentation-transcription work LLMs are good at, provided the boundary between "drafting" and "deciding" is as strict here as it already is everywhere else in this codebase.

The founder's own framing, verbatim: not "magic connection" to systems with no real access — a real, safe system that uses actual technical inputs (OpenAPI, Postman, PDF, sandbox credentials) and never activates anything in production without human approval.

The hard part — a safe boundary between "the LLM drafted something" and "it actually runs" — already exists and is proven twice: the ACL pattern (order-taking) and the Agentic Tool-Use Loop's `dryRun` gate (ADR-049). This ADR extends that boundary to a third, higher-stakes case (generating *new code*, not just calling existing code), so the boundary is drawn tighter here, not looser.

## 2. Decision

A human uploads documentation for a new provider through an admin screen. A pipeline of deterministic parsers (OpenAPI/Postman — machine-readable, no LLM needed for structure) plus one LLM-assisted classification step (mapping endpoints to Denis's capability vocabulary, every claim required to carry a `quotedSpan` back to the source document) produces a `CapabilityReport`. **A human picks which capabilities to actually build** — this is the first of two hard human gates, and it bounds what gets generated to what was actually asked for, not everything the docs happen to expose. Only then does code generation happen, followed by mock/sandbox testing, a bounded automatic repair loop (max 3 rounds, every attempt audited), and a final report. **A human reviews the generated code diff and explicitly approves activation** — the second hard gate. Only after that does the adapter enter `CONNECTOR_CATALOG` and go through the *existing, unchanged* connect flow (`connectPosIntegration` in `src/lib/pos/pos-actions.ts`) and the *existing, unchanged* shadow/canary rollout (`rollout.ts`).

This is the concrete implementation of ADR-048's:
- **Part VII.3's POS matrix "Code" column** — becomes a real, generated, tested, human-approved artifact instead of a hand-typed "adapter"/"stub" label.
- **Part VII.6's Connect Hub** — "Authorize / API fields → Probe → Connected ✓ · Can/Cannot" becomes the actual admin flow this ADR describes (upload → capability report → generate → test → review → approve), not a diagram of an intended one.

Capability status is layered explicitly on top of what already ships (`pos-capability-matrix.ts`, `resolvePosCapabilities`) — not replaced by a new parallel enum:

```
BASELINE   — pos-capability-matrix.ts, human-researched (Deliverect/Toast/Lightspeed/orderbird), ships today
GENERATED  — AI draft from this pipeline, for a NEW provider, pre-human-confirmation
APPROVED   — same record, once a human confirms it (the second hard gate)
```

## 3. Capability catalog — every entry maps to an existing consumption point

`DenisCapability` values (`menu.read`, `order.create`, `bill.close`, `reservation.create`, etc. — full list in the design doc) map 1:1 onto what Denis's own brain-context and ACL surfaces already need to know is possible, per `docs/denis-brain-surfaces.md`. A capability record without a `quotedSpan` citing the source documentation can never be written as `supported` — this is enforced by a deterministic function (`CapabilityMapper`), not left to LLM discretion, mirroring the `abuse-protection.ts`/`resolveGuestConductPolicy` "LLM assesses, code decides" split already proven this session.

**Explicitly not automated by this pipeline:** browser-automation "connectors" (no API exists) are a structurally separate type (`BrowserAutomationConnector`), never implement `PosAdapter`, and never get generated code that reaches a financial action without a fresh human confirmation on every sensitive step — not just the one activation gate side-effecting API adapters get.

## 4. Safety model (non-negotiable)

1. **Generated code never reaches git or production without two separate human gates** — which capabilities to build (gate 1, bounds scope), and the actual code diff before activation (gate 2, bounds correctness). Skipping either is not a configuration option; it is architecturally absent from this design.
2. **The AI can execute generated code exactly once, against exactly one kind of target: sandbox credentials a human explicitly entered and labeled as sandbox, or synthetic mock responses derived from the documentation's own examples.** No code path in this design allows the AI to call anything else. Sandbox and production credentials are stored in separate, distinctly-labeled rows; the sandbox runner is built so that reading a `production`-labeled row is not a permission check the AI could get wrong — it's a query that structurally can't return one.
3. **Side-effecting capabilities are ACL-only**, exactly like every side-effecting Denis action today — `addItemsToBill`/`applyExternalPayment`/`closeBill` route through a generated `execute-denis-*` file that a human reviews before it enters the codebase, never a direct call from generated adapter code into the agentic loop.
4. **A bounded, audited repair loop, not an open-ended one.** Maximum 3 automatic fix attempts after a test failure, each one producing a diff (not a fresh file) that must pass static validation before being tested again; after 3 failures the work goes to a human with the remaining errors listed, never silently retried forever.
5. **No credential ever appears in an LLM prompt.** Generated code receives a credential *reference* (a row id); the actual secret value is resolved only inside the non-LLM-reachable execution layer, the same boundary that already protects admin-client access from the LLM everywhere else in this codebase.
6. **Cost and blast radius are bounded explicitly, not left implicit** — sandbox-only execution, a hard repair-round cap, and the existing canary/shadow rollout mechanism for the eventual live rollout, matching every other rollout this session (Guest Conduct Policy Engine, Agentic Tool-Use Loop, Unified Operational Context).

## 5. Rollout — reuse existing mechanisms, build nothing new

Once a human approves an adapter (gate 2), it enters `CONNECTOR_CATALOG` and follows the exact same path any hand-written adapter already follows: `pos_integrations` row via `connectPosIntegration`, then `isInCanaryCohort`/`shouldRunShadowDiff` from `rollout.ts` for the first real location. No new rollout mechanism is introduced by this ADR.

## 6. Relationship to other in-flight work

- **Integration Registry / Capability Matrix** (shipped earlier this session) — this ADR's pipeline is a new *producer* of entries into the same catalog and the same capability model; it does not introduce a parallel source of truth.
- **Agentic Tool-Use Loop (ADR-049)** — a generated adapter's capabilities become new `AgenticToolDefinition` entries through the *existing* catalog mechanism, gated by the *existing* `dryRun` boundary; this ADR does not touch the loop itself.
- **Guest Conduct Policy Engine** — architecturally identical "LLM assesses, deterministic code decides" split, applied to a new domain (code generation) rather than guest tone.
- **Two P0 fixes shipped alongside this design** (2026-07-12, found during this ADR's own review): POS capability awareness was reaching staff-facing surfaces but not guest chat (fixed — see `docs/denis-brain-surfaces.md`), and a webhook route had a signature-verification bypass in one branch (fixed, tested). Neither is part of this ADR's scope — both were pre-existing gaps in already-shipped work, corrected before this ADR's Phase 0 begins so the foundation this pipeline builds on is sound.

## 7. Implementation phases

| Phase | Deliverable | Scope |
|-------|-------------|-------|
| 0 | DB schema (`integration_providers`, `integration_documents`, `integration_capabilities`, `integration_adapters`, `integration_adapter_versions`) + `CONNECTOR_CATALOG` extension points. Zero runtime behavior change. | Small |
| 1 | OpenAPI + Postman parsing into the internal capability-discovery format. Deterministic parsers, tested against real public API specs, not just synthetic fixtures. | Medium |
| 2 | Adapter + test generation from a human-confirmed capability report, output isolated to `generated/`, never auto-imported by any runtime path. | Medium |
| 3 | Sandbox execution isolation (reusing the `THROWING_ADMIN` pattern from `run-tool-use-fixture.ts`) + the first 9 of 14 test layers (schema/mock/contract/sandbox/idempotency/timeout/retry/rate-limit/duplicate-order). | Medium-large, highest-consequence phase for correctness of the safety boundary itself |
| 4 | Bounded repair loop (max 3 rounds, fully audited). | Medium |
| 5 | Human review workflow + the two hard gates enforced as real, checkable database state (not just UI convention). | Medium |
| 6 | First real adapter through shadow → canary → certified, using the *existing* rollout mechanism. | Paced by real usage, not a calendar date |
| 7 | Browser-automation fallback (separate type, separate safety rules, financial actions excluded by construction). | Deferred — not part of MVP |

No fixed end date claimed on purpose — Phase 6 (first live adapter) is paced by real evidence at each canary step, reviewed by the founder, same precedent as every rollout this session.

## 8. Success criteria

| Metric | Target |
|--------|--------|
| Generated code reaching production without both human gates | 0 — architecturally impossible |
| Sandbox runner reading a production-labeled credential | 0 |
| Capability marked `supported` without a `quotedSpan` | 0 — enforced by `CapabilityMapper`, not convention |
| Repair loop exceeding 3 rounds | 0 |
| New provider requiring a change to the Brain/agentic-loop code itself (vs. a new catalog entry) | 0 — same "swap the connector, not the brain" rule ADR-047/049 already lock in |

---

Full working design (all 26 sub-questions, folder structure, database columns, per-layer test detail, worked OpenAPI example) lives in the session plan file, not duplicated here — this ADR is the canonical, stable decision record; the plan file is the exhaustive scratch work that produced it.
