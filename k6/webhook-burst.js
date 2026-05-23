import { check, sleep } from "k6";
import http from "k6/http";
import { BASE_URL, DEFAULT_HEADERS, THRESHOLDS } from "./config.js";

export const options = {
  scenarios: {
    webhook_burst: {
      executor: "constant-vus",
      vus: 100,
      duration: "30s",
    },
  },
  thresholds: {
    ...THRESHOLDS,
    // Mock payloads fail signature verification (400) — endpoint must stay up
    http_req_failed: ["rate<0.01"],
    "http_req_duration{name:stripe_webhook}": ["p(95)<1000"],
  },
};

function mockStripeEvent(vu, iter) {
  const eventId = `evt_loadtest_${vu}_${iter}_${Date.now()}`;
  return JSON.stringify({
    id: eventId,
    object: "event",
    api_version: "2024-12-18.acacia",
    created: Math.floor(Date.now() / 1000),
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: `pi_loadtest_${vu}_${iter}`,
        object: "payment_intent",
        amount: 4750,
        currency: "eur",
        metadata: {
          order_id: "e1000000-0000-4000-8000-000000000001",
        },
        status: "succeeded",
      },
    },
  });
}

export default function webhookBurst() {
  const payload = mockStripeEvent(__VU, __ITER);

  const res = http.post(`${BASE_URL}/api/stripe/webhook`, payload, {
    headers: {
      ...DEFAULT_HEADERS,
      "stripe-signature": "t=0,v1=loadtest_invalid_signature",
    },
    tags: { name: "stripe_webhook" },
  });

  check(res, {
    "webhook rejects invalid signature (400)": (r) => r.status === 400,
    "webhook not server error": (r) => r.status < 500,
  });

  // Duplicate same event id on next iter tests handler idempotency when signature is valid
  if (__ITER % 5 === 0) {
    const dup = http.post(`${BASE_URL}/api/stripe/webhook`, payload, {
      headers: {
        ...DEFAULT_HEADERS,
        "stripe-signature": "t=0,v1=loadtest_invalid_signature",
      },
      tags: { name: "stripe_webhook_dup" },
    });
    check(dup, {
      "duplicate webhook not 500": (r) => r.status < 500,
    });
  }

  sleep(0.1);
}
