export const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const TEST_SLUG = __ENV.TEST_SLUG || "skyline-lounge";
export const TEST_TOKEN = __ENV.TEST_TOKEN || "demo-table-1";
/** Seed table tokens — spread VUs across tables to avoid one shared session. */
export const TEST_TABLE_TOKENS = __ENV.TEST_TABLE_TOKENS
  ? __ENV.TEST_TABLE_TOKENS.split(",").map((t) => t.trim()).filter(Boolean)
  : [
      "demo-table-1",
      "demo-table-2",
      "demo-table-3",
      "demo-table-4",
      "demo-table-8",
    ];
export const TEST_PRODUCT_ID =
  __ENV.TEST_PRODUCT_ID || "f0000000-0000-4000-8000-000000000001";

/** Pick a table token for this VU (1-indexed). Override with TEST_TOKEN for a single table. */
export function pickTableToken(vu = __VU) {
  if (__ENV.TEST_TOKEN) {
    return TEST_TOKEN;
  }
  const tokens = TEST_TABLE_TOKENS;
  return tokens[(vu - 1) % tokens.length];
}

export const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

export const THRESHOLDS = {
  http_req_duration: ["p(95)<500", "p(99)<1500"],
  http_req_failed: ["rate<0.05"],
};

/** Softer targets for local dev (`pnpm test:load:smoke`). */
export const SMOKE_THRESHOLDS = {
  http_req_duration: ["p(95)<5000", "p(99)<8000"],
  http_req_failed: ["rate<0.10"],
};

export const jsonParams = (extra = {}) => ({
  headers: DEFAULT_HEADERS,
  ...extra,
});
