import { check, sleep } from "k6";
import http from "k6/http";
import { BASE_URL, THRESHOLDS } from "./config.js";
import { bootstrapGuestOrder } from "./helpers.js";

export const options = {
  scenarios: {
    sse_connections: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 10 },
        { duration: "1m", target: 100 },
        { duration: "1m", target: 100 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    ...THRESHOLDS,
    "http_req_failed{name:sse_stream}": ["rate<0.2"],
    "checks{check:sse received events}": ["rate>0.9"],
  },
};

export default function sseConnections() {
  const boot = bootstrapGuestOrder();
  if (!boot.ok) {
    check(null, { "bootstrap order": () => false });
    return;
  }

  const streamUrl = `${BASE_URL}/api/orders/${boot.orderId}/stream?sessionToken=${encodeURIComponent(boot.sessionToken)}`;
  const stream = http.get(streamUrl, {
    timeout: "30s",
    tags: { name: "sse_stream" },
  });

  check(stream, {
    "sse status 200": (r) => r.status === 200,
    "sse received events": (r) =>
      Boolean(r.body) &&
      (r.body.includes("data:") || r.body.includes(": ping")),
  });

  sleep(1);
}
