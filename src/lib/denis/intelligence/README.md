# Denis intelligence modules

**Tracks:** Layer 4 M2 · Layer 7 W3, X1, X2

- `table-turnover.ts` — turnover prediction, rush detection, EWMA priors
- `load-table-turnover-priors.ts` — historical session durations per table
- `inventory-awareness.ts` — stock levels, runout prediction, copilot alerts (W3)
- `dynamic-vkg.ts` — market-basket pairing discovery from order history (X1)
- `demand-forecast.ts` — hourly demand forecast for kitchen prep briefing (X2)
- `menu-personalization.ts` — per-guest menu order, badges, allergen visibility (Q3)
- `table-transfer-advisor.ts` — staff transfer suggestions from floor + reservations (R2)

Staff-facing only — Denis never tells guests exact stock counts.

**May import:** cognition, loop, config.
