export const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const TEST_SLUG = __ENV.TEST_SLUG || "skyline-lounge";
export const TEST_TOKEN = __ENV.TEST_TOKEN || "demo-table-1";
export const TEST_PRODUCT_ID =
  __ENV.TEST_PRODUCT_ID || "f0000000-0000-4000-8000-000000000001";

export const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

export const THRESHOLDS = {
  http_req_duration: ["p(95)<500", "p(99)<1500"],
  http_req_failed: ["rate<0.05"],
};

export const jsonParams = (extra = {}) => ({
  headers: DEFAULT_HEADERS,
  ...extra,
});
