# ADR-016 — Guest Scene Contract (SC tracks)

| Field | Value |
|-------|--------|
| **Status** | **In progress** — SC-1…SC-7, ID-1, ID-2 implemented |
| **Depends on** | [ADR-005](./ADR-005-denis-maximum.md) · [ADR-014](./ADR-014-commerce-experience-platform.md) · [ADR-017](./ADR-017-denis-scene-first-presentation.md) |

## One sentence

**Guest and dashboard UI read a versioned `Scene` projection** — composed deterministically from order, commerce, venue ops, and Denis session facts — not from chat-shaped APIs.

## Invariants

1. Only `refreshGuestScene` / outbox `session.scene.refresh` writes `guest_scene`.
2. `composeScene()` is pure — precedence table lives in one module + unit tests.
3. LLM never shapes `layers[]`; it may only fill text inside payloads produced by turns.
4. Commerce moments and Denis turns both trigger scene refresh (async).

## Tracks

| Track | Scope | Status |
|-------|-------|--------|
| SC-1 | `src/lib/scene/` types + `composeScene` + tests | ✅ |
| SC-2 | migration `00100_guest_scene` + refresh + outbox | ✅ |
| SC-3 | `GET /api/guest/scene` | ✅ |
| SC-4 | Guest UI `useGuestScene()` + SceneRenderer | ✅ |
| SC-5 | Dashboard tile from `guest_scene` | pending |
| SC-6 | Denis turn → `session.scene.refresh` outbox | ✅ |
| SC-7 | Turn → chips/inline scene projection | ✅ |
