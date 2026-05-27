# Styles

Design tokens live in **`src/app/globals.css`** until the V2 split into `src/styles/tokens/`.

| Scope | Selector | Docs |
|-------|----------|------|
| Dashboard / admin ops | `.dashboard-theme`, `.admin-theme` | [ADR-007 §4](../../docs/design/ADR-007-visual-system.md) |
| Guest menu + Denis panel | `.guest-theme` | [DS-01](../../docs/design/denis-spatial-implementation-plan.md#ds-01--spatial-tokens--theme-aliases) |
| Kitchen KDS | `.kitchen-theme` | isolated — do not share spatial tokens |
| Marketing | `.landing-page` | `--lp-*` vars; CTAs align to `--qr-ember` in DS-07 |

**Spatial v4 tokens (`--qr-*`, `--denis-*`):** defined on dashboard, admin, and guest themes. Prefer these in new components; `--dash-*` remains for existing dashboard utilities.

**Motion (DS-10):** `spatial-tile-occupy` (200ms ember top bar), `spatial-denis-listen` (presence line pulse), `denis-mark-think` (shimmer). All respect `prefers-reduced-motion`.
