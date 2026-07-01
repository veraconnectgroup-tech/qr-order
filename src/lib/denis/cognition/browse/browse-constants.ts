/** Product detail open ≥ this → interested (ms). */
export const BROWSE_INTERESTED_DWELL_MS = 5_000;

/** Closed quickly → abandoned (ms). */
export const BROWSE_ABANDONED_DWELL_MS = 2_500;

/** Same category, no order — min distinct products for browse nudge. */
export const BROWSE_CATEGORY_NUDGE_MIN_PRODUCTS = 3;

/** Same category browse window without ordering (ms). */
export const BROWSE_CATEGORY_NUDGE_MIN_MS = 3 * 60_000;

/** Interested product viewed, no order — follow-up delay (ms). */
export const BROWSE_PRODUCT_FOLLOW_UP_MS = 5 * 60_000;

/** unitPrice at or below → budget signal (EUR). */
export const BROWSE_BUDGET_PRICE_MAX_EUR = 12;

/** unitPrice at or above → premium signal (EUR). */
export const BROWSE_PREMIUM_PRICE_MIN_EUR = 22;
