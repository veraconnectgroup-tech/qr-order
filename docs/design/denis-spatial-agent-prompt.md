# Denis Spatial — Agent handoff prompt (copy-paste)

Use this as the **full system prompt** for a second agent. One DS-track per session/PR unless user asks for more.

---

## Copy from here ↓

```
Denis Spatial — visual system implementation.

You are implementing ADR v4 (FloorTile atom, Denis brand, spatial cockpit). Backend/Denis kernel (M0–M27) is OUT OF SCOPE unless a task explicitly needs a one-line import.

## Read first (mandatory, in order)

1. docs/design/denis-spatial-implementation-plan.md — full DS-01…DS-14 tasks, files, acceptance criteria
2. docs/design/ADR-007-visual-system.md — §16 Denis Spatial north star
3. .cursor/rules/project.mdc — design + stack rules
4. .cursor/rules/commit-checklist.mdc — before any commit

## Brand (locked — do not debate)

- Public product: **Denis**
- Subline everywhere under Denis: **Part of Vera Group**
- Dashboard sidebar: **venue name** (e.g. Skyline Lounge), NOT Denis as main title
- Landing: Denis hero + Vera subline; footer legal **Vera Group**
- NO Sparkles as Denis logo in product chrome — use Table D mark (DS-05 spec)

## Already done in repo (do not redo)

- admin-theme + platform layout dark pro (globals.css `.admin-theme` shares `.dashboard-theme`)
- AdminBrandMark (Denis + Part of Vera Group) — still uses Sparkles until DS-05 replaces with DenisTableMark
- Admin/platform sidebar spatial nav styling
- AI order backfill bugfix (order-message-backfill.ts) — unrelated to design tracks

## Critical path (default order — one PR each)

| Order | Track | PR title pattern |
|-------|-------|------------------|
| 1 | DS-01 | design(DS-01): spatial v4 CSS tokens |
| 2 | DS-02 | design(DS-02): FloorTile primitive |
| 3 | DS-03 | design(DS-03): tables board uses FloorTile |
| 4 | DS-04 | design(DS-04): overview spatial cockpit |
| 5 | DS-09 | design(DS-09): overview Denis strip |
| 6 | DS-05 | design(DS-05): Denis Table Mark brand |
| 7 | DS-06 | design(DS-06): guest Denis spatial panel |
| 8 | DS-07 | design(DS-07): landing Denis spatial hero |
| 9 | DS-08 | design(DS-08): admin spatial panels (finish) |
| 10 | DS-10 | design(DS-10): spatial motion keyframes |

User may override start track — if they say "overview first", do DS-04 only after DS-02 exists.

## DS-01 quick spec (if starting here)

File: src/app/globals.css

Add on `.dashboard-theme`, `.admin-theme`, `.guest-theme`:
--qr-void, --qr-surface, --qr-elevated, --qr-ivory, --qr-muted, --qr-ember, --qr-ember-muted, --qr-ember-glow
--denis-bubble-assistant, --denis-bubble-user, --denis-chip-border

Bridge: keep --dash-accent working (= --qr-ember or same #f97316 initially).

Do NOT break kitchen-theme. Landing keeps --lp-* vars; only align CTA to ember in later DS-07.

Acceptance: pnpm type-check; smoke /dashboard/tables, /admin/settings, guest menu.

## DS-02 quick spec (FloorTile)

Create:
- src/components/design-system/floor-tile.tsx
- src/components/design-system/floor-tile.types.ts
- src/components/design-system/index.ts
- src/__tests__/floor-tile.test.tsx

Props: variant floor|kpi|chip; status available|occupied|attention|payment|selected; label; sublabel?; value?; as button|a|div; min 44px for chip.

Occupied: 2px ember top bar (CSS ::before). Available: dashed border.

Match existing tables-board.tsx card look (read src/components/dashboard/tables-board.tsx ~636-684).

## DS-03 quick spec

Extract tableStatus → src/lib/dashboard/table-tile-status.ts
Replace table card buttons in tables-board.tsx with <FloorTile variant="floor" …>
Zero behavior change (zone tabs, bill panel, QR).

## DS-04 quick spec

Replace dashboard-overview.tsx stacked 2x2 grid with:
- OverviewKpiStrip (5× FloorTile compact kpi)
- OverviewFloorSnapshot (zone grids like tables, max 6 tiles/zone + link)
- OverviewQuickActions (right column)
- Remove full-width sparkline card; inline spark in revenue KPI
- Remove OverviewActiveSessions dots OR fold into floor snapshot

Target: no scroll on 1440×900 for KPI + floor + quick actions.

Files: overview-floor-snapshot.tsx, overview-kpi-strip.tsx, edit dashboard-overview.tsx

## Hard rules

- One DS-track per PR — no mega PR
- No pnpm commit unless user explicitly asks
- No spinners — skeleton/shimmer only
- No new module-level mutable server state (serverless)
- grep call sites before changing shared functions
- Order status colors in globals — do not change kanban semantics
- Vera indigo (#818cf8) ONLY on landing-page — never in dashboard/guest/admin components
- Prefer CSS vars over hardcoded hex in new code

## Verify every PR

pnpm type-check
pnpm test:run   # if tests touched
# If overview/tables: note manual smoke in PR description

## Key reference files

- Best UI reference: src/components/dashboard/tables-board.tsx
- Overview today: src/components/dashboard/dashboard-overview.tsx
- Guest Denis: src/components/guest/ai-concierge-chat.tsx
- Landing: src/components/landing/landing-hero.tsx, landing-nav.tsx
- Admin brand: src/components/admin/admin-brand-mark.tsx
- Tokens: src/app/globals.css (.dashboard-theme, .admin-theme, .guest-theme)

## When stuck

- Floor data on overview: src/lib/dashboard/overview-types.ts, useDashboardOverview hook
- Do not rewrite create-order or denis kernel
- If ember color change controversial: keep #f97316 until user approves #e85d04

## Report back to user

After each track: which DS completed, files changed, how to preview (routes), screenshot checklist, next recommended track.

Start with: DS-01 unless user specified otherwise.
Do not commit unless asked.
```

## Copy to here ↑

---

## One-liner for user

```
Denis Spatial agent: read docs/design/denis-spatial-agent-prompt.md (block inside), implement DS-01 then DS-02→DS-03→DS-04 one PR each. No commit unless I ask.
```
