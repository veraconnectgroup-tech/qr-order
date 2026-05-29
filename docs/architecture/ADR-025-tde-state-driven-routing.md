# ADR-025: TDE State-Driven Routing — Director bez jezičkog rečnika

| Field | Value |
|-------|-------|
| **Status** | **Accepted** — target architecture for `decideTurnPlan` / perceive routing |
| **Date** | 2026-05-29 |
| **Fixes** | Bug class in ADR-023 §4 TDE — regex as LLM gatekeeper |
| **Unifies** | [ADR-019](./ADR-019-denis-unified-brain.md) · [ADR-020](./ADR-020-denis-table-operating-system.md) · [ADR-023](./ADR-023-denis-maximum-runtime.md) §3–4 |
| **Code target** | `src/lib/denis/cognition/tde/` · `src/lib/denis/cognition/beliefs/` · `src/lib/denis/kernel/reflex-rules.ts` |
| **Implement** | [ADR-025-session-prompts.md](./ADR-025-session-prompts.md) · [ADR-025-operator.md](./ADR-025-operator.md) |
| **Verify** | [ADR-025-verification-checklist.md](./ADR-025-verification-checklist.md) |

---

## 0. One sentence

**Director (`decideTurnPlan`) routes turns from Table OS state and beliefs — not from food-word regex — using three layers (T0 / fact-template / perceive), with relational vs transactional as a plan branch, not a vocabulary test.**

---

## 1. Problem (as-built bug)

Today `decideTurnPlan` treats “does this message contain pizza|beer|order?” as “does Denis get a brain?”

```typescript
// decide-turn-plan.ts — THE BUG
if (mode === "banter" || isCasualSocialGuestMessage(message)) {
  return planForBanter(suppressUpsell); // banter.welcome, requiresLlm: false
}
```

`isCasualSocialGuestMessage` = message does **not** match `ORDERING_GUEST_PATTERN` → almost all free text → template.

**Worse:** the `|| isCasualSocialGuestMessage(message)` overrides **belief `conversation.mode: ordering`** from `compileBeliefs` when cart/orders are open.

| Guest says | Expected (Table OS) | Today |
|------------|---------------------|-------|
| **Može** (after Denis asked “Craft IPA?”) | Confirm → perceive or T0 | Not in T0 confirm list → `banter.welcome` |
| **Daj mi sok** | `transactional_perceive` | `sok` ∉ regex → banter template |
| **Merhaba** / **Que tal** | `relational_perceive` in guest language | `banter.welcome` in venue locale |
| **gde si legendo** (true banter) | `relational_perceive` (cheap) | template OK but wrong tier for multilingual |

**Root cause:** language-list routing in POLICY layer. ADR-023 says beliefs + goals decide; code does word-list gatekeeping.

**Non-goal:** expanding `ORDERING_GUEST_PATTERN` with sok|juice|merhaba — that does not scale and duplicates catalog semantics.

---

## 2. Design principles

1. **TRUTH → BELIEF → POLICY → LANGUAGE** — unchanged spine (ADR-023).
2. **Regex may hint beliefs; it may not veto LLM** in `decideTurnPlan`.
3. **Three layers, not two:** T0/reflex · fact-template · perceive (relational | transactional).
4. **Perceive is default for free guest text** after deterministic paths exhaust.
5. **Cost control = tier + prompt budget + session credits** — not “ignore the guest.”

---

## 3. Target architecture — three layers

```
                    Guest message
                          │
                          ▼
              ┌───────────────────────┐
              │ L0 — T0 / handoff     │  0 credits
              │ reflex-rules, chips   │  deterministic
              └───────────┬───────────┘
                          │ miss
                          ▼
              ┌───────────────────────┐
              │ L1 — Fact templates   │  0 credits
              │ goals, slots, status, │  system facts
              │ cart conflict         │
              └───────────┬───────────┘
                          │ miss
                          ▼
              ┌───────────────────────┐
              │ L2 — Perceive (LLM)   │  0–1 credit
              │ relational │ trans.   │  state picks branch
              └───────────────────────┘
```

**Director never calls OpenAI.** It returns `TurnPlan { kind, requiresLlm, reason }`.

---

## 4. Decision algorithm (`decideTurnPlan`)

Replace the bottom half of `decideTurnPlan` (after L0/L1 early exits) with **state-driven perceive routing**.

### 4.1 Early exits (unchanged — keep)

| Order | Condition | Plan | LLM |
|-------|-----------|------|-----|
| 1 | `reflex.usedT0 \|\| handoffCommand` | `reflex_only` | ❌ |
| 2 | `commerce.pending_slot` belief | `slot_extract` | ❌ (optional mini later) |
| 3 | Top goal `RECONCILE_CART` | `template_tell` cart.conflict | ❌ |
| 4 | Top goal `CLARIFY_SLOT` | `slot_extract` | ❌ |
| 5 | Top goal `INFORM_STATUS` | `template_tell` status.headline | ❌ |
| 6 | `committedFacts.length > 0` | `narrate_paraphrase` | ✅ (T3) |

### 4.2 Perceive branch selection (new)

After early exits, **always** enter perceive unless settling template applies:

```typescript
function resolvePerceiveKind(input: DecideTurnPlanInput): TurnPlanKind {
  const mode = getBeliefValue(input.beliefs, "conversation.mode");
  const awaitingConfirm = getBeliefValue(input.beliefs, "commerce.awaiting_confirm");
  const hasCommercePressure = getBeliefValue(input.beliefs, "commerce.pressure") !== "none";

  if (mode === "settling") return "template_tell"; // settle.thanks — keep

  if (hasCommercePressure || awaitingConfirm || mode === "ordering") {
    return "transactional_perceive";
  }

  if (VAGUE_RECOMMEND_PATTERN.test(input.message)) {
    return "relational_perceive"; // menu RAG in evidence
  }

  return "relational_perceive"; // default for free text — NOT banter.welcome
}
```

**Remove entirely:**
- `if (mode === "banter" || isCasualSocialGuestMessage(message))` block
- `planForBanter()` as default path
- `inferConversationMode()` inside `decideTurnPlan` (beliefs only)
- Default fallback `banter.welcome`

**Deprecate exports** (keep for tests one release, then delete):
- `isCasualSocialGuestMessage` as routing input — move to eval-only or delete
- `looksLikeOrderLine` as routing input — belief hint only

### 4.3 `requiresLlm` rule

| Plan kind | `requiresLlm` |
|-----------|---------------|
| `reflex_only`, `template_tell`, `slot_extract` | `false` |
| `relational_perceive`, `transactional_perceive`, `narrate_paraphrase` | `true` |

No third state. Template-first for L2 is **forbidden** except LLM-down fallback in `runTdePerceive` (already exists).

---

## 5. Belief graph extensions (MR-1 delta)

Add to `compileBeliefs()` — logged to timeline with other beliefs.

| Key | Values | Derivation |
|-----|--------|------------|
| `commerce.pressure` | `none` \| `open` \| `confirm` | See §5.1 |
| `commerce.awaiting_confirm` | `boolean` | `pressure === "confirm"` |

**Do not add** `ORDERING_GUEST_PATTERN` to beliefs as a mode switch — optional low-confidence hint only if needed for analytics.

### 5.1 `commerce.pressure` derivation

```typescript
function resolveCommercePressure(state: TableSessionState, flowNodeId: FlowNodeId): "none" | "open" | "confirm" {
  const cartLines = state.commerce.cart.visibleLines.length;
  const openOrders = state.commerce.orders.some(o => !["delivered","cancelled"].includes(o.status));

  const confirmFlow = flowNodeId === "recap" || flowNodeId === "submit";
  const upsellPending = /* last mind turn offered upsell && no cart delta since — optional T2 */;

  if (confirmFlow && (cartLines > 0 || openOrders)) return "confirm";
  if (cartLines > 0 || openOrders) return "open";
  return "none";
}
```

Pass `flowNodeId` into `compileBeliefs` from `run-denis-turn` (already available on `ctx.flowNodeId`).

### 5.2 Fix `conversation.mode` ordering in `compile-beliefs.ts`

**Reorder** `resolveConversationMode` — state before word-list:

1. `billSettled` → settling  
2. `SETTLING_GUEST_PATTERN` → settling  
3. **`commerce.pressure !== "none"` → ordering** (confidence 0.85)  
4. `ORDERING_GUEST_PATTERN` → ordering (hint, 0.75)  
5. casual social → banter (0.7) — **only when pressure is none**  
6. default → banter (0.55)

This fixes belief side; T1 still must fix Director OR override.

---

## 6. Perceive tiers (relational vs transactional)

Already wired in `run-denis-turn.ts`:

```typescript
resolvePerceiveMode(turnPlan) // relational → "social", transactional → "commerce"
resolvePerceiveModel(profile, perceiveMode)
```

**Evidence budget** (`planEvidence`) — tighten in T3:

| Pointer | relational | transactional |
|---------|------------|---------------|
| `transcript.window` | last 6 turns | last 4 turns |
| `commerce.*` | summary only | full draft + cart |
| `catalog.rag` | on vague recommend | always when ordering |
| `guest.memory` | tier ≥ 2 | tier ≥ 2 |
| `playbook.examples` | relational pack | transactional pack |

Relational prompt: persona + language belief + short transcript — **no full menu JSON**.

---

## 7. T0 contextual fast-paths (not global lists)

Keep T0 **deterministic** but **context-gated**.

### 7.1 Contextual confirm (T2)

Extend `resolveT0Reflex` / `isT0Confirm` with optional context:

```typescript
isT0Confirm(message, { awaitingConfirm: boolean })
```

When `awaitingConfirm === true`, also accept:

```
^(može|moze|klar|gerne|jep|tamam|evet|oui|si|sí|vale)([\s,.!]|$)
```

When `awaitingConfirm === false`, keep existing list — **do not** treat bare “može” as confirm mid-browse.

Wire: pass `commerce.awaiting_confirm` from beliefs into `planTurnWithReflex` (new optional field on `ReflexTurnInput`).

### 7.2 Slot replies

Keep `slot_extract` + template for **structured** slots (serve_size with fixed options).  
Free-text slot answers (“velika”, “0.5”) → T0 if numeric pattern matches, else **transactional_perceive** with slot goal in evidence — not banter.

---

## 8. Cost & credit policy

Align with ADR-009 + ADR-023 target `llm_invocation_rate < 35%`.

| Control | Mechanism |
|---------|-----------|
| L0/L1 deterministic | ~40–55% of turns (T0, status, slots, conflict) |
| Relational vs transactional | cheaper model / smaller context for relational |
| Session cap | `assertSufficientCredits` before turn; degrade to template **only on 402**, not on routing |
| Metering | charge 1 credit when `requiresLlm && !skipLlm` — unchanged |

**Forbidden:** routing to template to save credits while guest is in commerce flow.

---

## 9. What stays template-only (0 credits)

| Scenario | Plan | Why |
|----------|------|-----|
| T0 confirm/decline/done/correction | `reflex_only` | Deterministic protocol |
| Handoff chips | `reflex_only` | ADR-018 |
| Cart conflict | `template_tell` | Fact from system |
| Order status headline | `template_tell` | Fact from KDS |
| Pending slot with closed options | `slot_extract` + template | Structured UI |
| Settling (“to je sve”) | `template_tell` settle.thanks | Mode belief |

**Remove as default:** `banter.welcome` for unmatched free text.

Keep `banter.welcome` template for: explicit `GUEST_SEATED` proactive nudge (scheduler / world signal) — not guest reply path.

---

## 10. Delete / deprecate

| Item | Action |
|------|--------|
| `planForBanter()` default in `decideTurnPlan` | **Delete** |
| `\|\| isCasualSocialGuestMessage(message)` in Director | **Delete** |
| `inferConversationMode()` in `decide-turn-plan.ts` | **Delete** — use beliefs |
| Duplicate `ORDERING_GUEST_PATTERN` in decide-turn-plan | **Delete** — single source in compile-beliefs if kept as hint |
| `looksLikeOrderLine` routing at line 207 | **Delete** |
| Default `banter.welcome` fallback | **Replace** with `relational_perceive` |

---

## 11. Implementation tracks (one PR each)

```
T1 → T2 → T3 → Parent verify → [eval fixtures] → Commit (operator)
```

| Track | Scope | Resolves |
|-------|-------|----------|
| **T1** | Director rewrite + compile-beliefs mode reorder + tests | Može, sok, Merhaba |
| **T2** | `commerce.pressure` beliefs + contextual T0 confirm | Može at recap without LLM |
| **T3** | Evidence budgets + eval scenarios + llm rate metric | Cost guardrails |

**Do not merge T1–T3 into one PR.**

---

## 12. Acceptance test matrix

Add to `src/__tests__/denis-tde.test.ts` and eval fixtures.

| # | Message | Beliefs / state | Expected plan | LLM |
|---|---------|-----------------|---------------|-----|
| A1 | `Može` | mode ordering, pressure confirm | `reflex_only` (T2) or `transactional_perceive` (T1) | T2: ❌ |
| A2 | `Može` | mode banter, pressure none | `relational_perceive` | ✅ |
| A3 | `Daj mi sok` | pressure open, cart empty | `transactional_perceive` | ✅ |
| A4 | `Merhaba` | pressure none, lang tr inferred | `relational_perceive` | ✅ |
| A5 | `gde si legendo` | mode banter | `relational_perceive` | ✅ |
| A6 | `2x cola` | mode ordering | `transactional_perceive` | ✅ |
| A7 | `da` | recap flow, T0 | `reflex_only` | ❌ |
| A8 | `velika` | pending_slot serve_size | `slot_extract` | ❌ |
| A9 | ordering belief + `hello` | mode ordering from cart | `transactional_perceive` — **not** banter | ✅ |
| A10 | `to je sve` | settling | `template_tell` settle.thanks | ❌ |

---

## 13. Files touched (by track)

### T1
- `src/lib/denis/cognition/tde/decide-turn-plan.ts` — main rewrite
- `src/lib/denis/cognition/beliefs/compile-beliefs.ts` — mode reorder
- `src/__tests__/denis-tde.test.ts` — matrix A2–A6, A9
- `src/lib/denis/cognition/tde/index.ts` — export cleanup if needed

### T2
- `src/lib/denis/cognition/beliefs/belief-types.ts` — new keys
- `src/lib/denis/cognition/beliefs/compile-beliefs.ts` — pressure derivation
- `src/lib/denis/cognition/tde/turn-plan-types.ts` — CORE_BELIEF_KEYS sync
- `src/lib/denis/kernel/reflex-rules.ts` — contextual confirm
- `src/lib/denis/kernel/reflex-plan.ts` — pass awaitingConfirm
- `src/lib/denis/runtime/run-denis-turn.ts` — wire flowNodeId → compileBeliefs
- `src/lib/denis/eval/run-beliefs-fixture.ts` — belief count + keys

### T3
- `src/lib/denis/cognition/context/plan-evidence.ts` — tier budgets
- `src/lib/denis/eval/fixtures/pilot-sr-scenarios.ts` — A1, A3, A4
- `docs/architecture/denis-implementation-map.md` — gap closed note

**Forbidden:** `src/lib/ai/*` legacy orchestrator · guest → Order Core bypass · new Map() session cache

---

## 14. Non-goals

- Full catalog NLP without LLM (RAG stays in perceive)
- Per-language regex packs for food items
- Removing `banter.welcome` template entirely (keep for proactive seated)
- Changing ACL / act submit / fiscal paths
- MR-4+ manifest / venue sim (orthogonal)

---

## 15. Success metrics

| Metric | Before (est.) | After T1+T2 |
|--------|---------------|-------------|
| Free-text → banter.welcome | ~60% non-ordering msgs | **0%** guest reply path |
| “Može” after offer understood | ~0% | **>95%** (T0 or transactional) |
| Multilingual greeting correct lang | Low | relational + language belief |
| `llm_invocation_rate` | ~15% (too low — dumb) | 25–35% (intentional) |
| `pnpm eval:denis` | pass | pass |
| Refusal / “ne razumem” rate | — | 0 (leadership sanitizer) |

---

## 16. Relation to ADR-023

This ADR **narrows** ADR-023 §4 TDE with explicit anti-patterns. Does not supersede MR tracks — insert as **MR-2b** between MR-2 and MR-3 completion review.

Update [denis-implementation-map.md](./denis-implementation-map.md) §gaps when T1 ships.

---

*End of ADR-025*
