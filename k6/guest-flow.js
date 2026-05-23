import { check, sleep } from "k6";
import http from "k6/http";
import {
  BASE_URL,
  TEST_SLUG,
  THRESHOLDS,
  jsonParams,
  pickTableToken,
} from "./config.js";
import { createTestOrder, openTableSession } from "./helpers.js";

export const options = {
  scenarios: {
    guest_flow: {
      executor: "constant-vus",
      vus: 50,
      duration: "2m",
    },
  },
  thresholds: {
    ...THRESHOLDS,
    // SSE connections abort on timeout after headers/events — allow some noise
    "http_req_failed{name:order_stream}": ["rate<0.15"],
  },
};

export default function guestFlow() {
  const tableToken = pickTableToken();

  const landing = http.get(`${BASE_URL}/`, {
    tags: { name: "landing" },
  });
  check(landing, { "landing 200": (r) => r.status === 200 });
  sleep(1);

  const health = http.get(`${BASE_URL}/api/health`, {
    tags: { name: "health" },
  });
  check(health, { "health 200": (r) => r.status === 200 });
  sleep(1);

  const menu = http.get(`${BASE_URL}/${TEST_SLUG}/${tableToken}`, {
    tags: { name: "menu" },
  });
  check(menu, { "menu 200": (r) => r.status === 200 });
  sleep(1);

  const session = openTableSession(BASE_URL, tableToken);
  check(session.res, {
    "session 200": (r) => r.status === 200,
  });
  if (!session.ok) {
    return;
  }
  sleep(1);

  const order = createTestOrder(session.sessionToken, BASE_URL, tableToken);
  check(order.res, {
    "create order 200/201": (r) => r.status === 200 || r.status === 201,
  });
  if (!order.ok) {
    return;
  }
  sleep(1);

  const streamUrl = `${BASE_URL}/api/orders/${order.orderId}/stream?sessionToken=${encodeURIComponent(session.sessionToken)}`;
  const stream = http.get(streamUrl, {
    timeout: "5s",
    tags: { name: "order_stream" },
  });

  check(stream, {
    "sse status 200": (r) => r.status === 200,
    "sse received events": (r) =>
      Boolean(r.body) &&
      (r.body.includes("data:") || r.body.includes(": ping")),
  });
  sleep(1);
}
