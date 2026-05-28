# ADR-017 — Denis Scene-First Presentation

| Field | Value |
|-------|-------|
| **Status** | **Accepted** — implementation SC-6, SC-7, ID-1, ID-2 |
| **Date** | 2026-05-27 |
| **Depends on** | [ADR-005](./ADR-005-denis-maximum.md) · [ADR-016](./ADR-016-guest-scene-contract.md) · [ADR-008](../design/ADR-008-web-design-architecture.md) |

## One sentence

**Denis is situational intelligence for a table — the guest sees a versioned `Scene`, not a chat thread; the desk panel is only the `sheet` layer.**

## Three planes

| Plane | Owns | Guest sees |
|-------|------|------------|
| **Command** | `runDenisTurn`, kernel, venue ops, ACL | nothing direct |
| **Scene** | `composeScene()` → `guest_scene` | presence, phase, chips, banners, inline, sheet |
| **Render** | React SceneRenderer | Table D, ember chrome, `GuestProductRow` |

## Invariants

1. UI reads **`GET /api/guest/scene`** as primary guest state — not chat history.
2. LLM never shapes `Scene.layers[]` — runtime fills text payloads only.
3. Every Denis turn and commerce projection refresh enqueues **`session.scene.refresh`**.
4. Turn quick replies → `chips` layer; recommendations → `inline` layer.
5. Chat panel = **`sheet`** layer implementation — same visual grammar as landing showcase.
6. Dashboard floor tile reads the same `guest_scene` (SC-5, pending).

## Tracks

| Track | Scope |
|-------|-------|
| SC-6 | Turn → outbox → `refreshGuestScene` |
| SC-7 | `mapTurnToSceneOverrides` + persist chips/inline in scene |
| ID-1 | `denis-scene-chips`, `denis-scene-phase-strip` on menu |
| ID-2 | `DenisMessageBlock` cards, panel ember header, no thread label |
| SC-5 | Dashboard tile (next PR) |

## Character (locked)

- **Role:** digital waiter for **this table**
- **Mark:** Table D (`DenisTableMark`) — never Sparkles bot
- **Chrome:** ember top bar + DenisBrandMark + sto · lokal
- **80% interaction:** chips, banners, inline menu rows
- **5% interaction:** free text in desk (`sheet`)
