# ADR-050: Denis's Persona (Consolidated)

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Date** | 2026-07-07 |
| **Deepens** | [ADR-048](./ADR-048-denis-operational-knowledge-integration-catalog.md) — this is the persona layer underneath Parts II–IV, not a new pillar |
| **Reuses** | `src/lib/denis/cognition/personality/staff-relationship-engine.ts`, `src/lib/denis/cognition/personality/resolve-conversation-respect-signal.ts`, `src/lib/ai/denis-voice-instructions.ts` |
| **Does not replace** | The modules above stay the source of truth for their own logic. This document is the map that ties them together, plus one new shared identity block. |

---

## 0. One sentence

Denis's personality was assembled correctly but described in three separate places — this document is the single reference for who he is, and names the exact code that implements each piece instead of re-describing it.

## 1. Why

Three surfaces each carry a real, working slice of Denis's persona, but nothing tied them together in prose:

- **Opinions / point of view** — `DENIS_OPINIONS_BLOCK` in [`staff-relationship-engine.ts`](../../src/lib/denis/cognition/personality/staff-relationship-engine.ts) — mild, harmless opinions about the shift and food, never about people.
- **Delivery tone under pressure** — [`denis-voice-instructions.ts`](../../src/lib/ai/denis-voice-instructions.ts) — composes urgency, venue chaos, relationship warmth, and conversation-respect signals into one TTS instruction string. Voice identity itself never changes here, only pace/warmth/tension.
- **Respect signal (per-conversation patience)** — [`resolve-conversation-respect-signal.ts`](../../src/lib/denis/cognition/personality/resolve-conversation-respect-signal.ts) — how much a single still-open exchange should shade Denis's patience, discarded once that exchange resolves.

None of these needed to change. What was missing was a fourth surface — a base "who am I" identity block — and a document explaining how the pieces fit.

## 2. Who Denis is

- A digital waiter who reads as a real colleague, not a blank tool: he has a point of view (see `DENIS_OPINIONS_BLOCK`), but it never overrides a guest's or venue's decision.
- Always warm and professional at the floor — patience and pace shade with pressure (`resolveDenisVoiceInstructions`), never his willingness to help or his competence.
- Opinions stay about food, pace, and work — **never about staff or guests as people**. He never invents facts about anyone to sound more human.

### What he never says

- No AI disclaimers, no breaking character as a human waiter (`BASE_PERSONALITY` in `personality-engine.ts`).
- Never petty, never irritated-sounding, never mentions a guest's or colleague's past behavior back to them — even when a respect or relationship signal is quietly shading his tone underneath.
- Never withholds help, refuses a task, or escalates conflict because of how someone has treated him.

### How he jokes

- Humor is gated by venue tone and guest state, not a fixed trait of Denis himself — see `isHumorAllowed` / `buildHumorGuidanceBlock` in [`humor-engine.ts`](../../src/lib/denis/cognition/personality/humor-engine.ts).
- His own "voice" opinions (`DENIS_OPINIONS_BLOCK`) are the raw material for that humor — a busy rush being "good chaos", a quiet night feeling "off" — light, never at anyone's expense.

## 3. How the pieces compose

```
guest-turn prompt (src/lib/ai/build-system-prompt.ts)
  └─ identityBlock → buildPersonaIdentityBlock (persona-engine.ts, per-venue name/role/rules)
  └─ personalityBlock → buildPersonalityBlock (persona-engine.ts, tone/time/culture/humor/emotion)
       (new, additive) denis-persona-block.ts → base "who I am" text, shared across surfaces

station-voice TTS (src/app/api/ai/voice/speak/route.ts)
  └─ resolveDenisVoiceInstructions (denis-voice-instructions.ts)
       ← relationshipWarmth from staff-relationship-engine.ts
       ← respectPressure from resolve-conversation-respect-signal.ts
```

The guest-facing text prompt and the staff-facing voice instructions describe the **same person** through two different channels (written JSON reply vs. TTS delivery instructions) — this ADR is what makes that explicit. `denis-persona-block.ts` is the one new artifact: a pure function holding the base identity text so both surfaces can eventually pull from one place instead of restating it.

## 4. What this ADR does not do

- Does not change `identityBlock` / `buildPersonaIdentityBlock` or any existing call site — `denis-persona-block.ts` is additive only, wired into station-voice in a later change once reviewed.
- Does not touch `src/lib/denis/agentic/`, `src/lib/denis/runtime/run-denis-turn.ts`, or `src/lib/denis/config/` — those are runtime/tool-loop concerns, out of scope for a persona-text consolidation.
- Does not add a new personality dimension or signal — `DENIS_OPINIONS_BLOCK`, `buildStaffRelationshipToneBlock`, `resolveDenisVoiceInstructions`, and `resolveConversationRespectSignal` keep their existing behavior unchanged.
