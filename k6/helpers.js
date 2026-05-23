import http from "k6/http";
import {
  BASE_URL,
  TEST_PRODUCT_ID,
  jsonParams,
  pickTableToken,
} from "./config.js";

/** POST /api/tables/{token}/session → sessionToken */
export function openTableSession(baseUrl = BASE_URL, tableToken = pickTableToken()) {
  const res = http.post(
    `${baseUrl}/api/tables/${tableToken}/session`,
    "{}",
    jsonParams({ tags: { name: "open_session" } })
  );

  if (res.status !== 200) {
    return { ok: false, res };
  }

  let body;
  try {
    body = res.json();
  } catch {
    return { ok: false, res };
  }

  const sessionToken = body?.data?.sessionToken;
  if (!sessionToken) {
    return { ok: false, res };
  }

  return { ok: true, res, sessionToken };
}

/** POST /api/orders → orderId */
export function createTestOrder(
  sessionToken,
  baseUrl = BASE_URL,
  tableToken = pickTableToken()
) {
  const payload = JSON.stringify({
    sessionToken,
    tableToken,
    paymentMethod: "unset",
    items: [
      {
        productId: TEST_PRODUCT_ID,
        productName: "Aperol Spritz",
        unitPrice: 9.5,
        quantity: 1,
        modifiers: [],
        itemTotal: 9.5,
      },
    ],
  });

  const res = http.post(`${baseUrl}/api/orders`, payload, {
    ...jsonParams({ tags: { name: "create_order" } }),
  });

  if (res.status !== 200 && res.status !== 201) {
    return { ok: false, res };
  }

  let body;
  try {
    body = res.json();
  } catch {
    return { ok: false, res };
  }

  const orderId = body?.data?.orderId;
  if (!orderId) {
    return { ok: false, res };
  }

  return { ok: true, res, orderId, sessionToken };
}

/** Session + order in one call (for SSE load tests). */
export function bootstrapGuestOrder(
  baseUrl = BASE_URL,
  tableToken = pickTableToken()
) {
  const session = openTableSession(baseUrl, tableToken);
  if (!session.ok) {
    return { ok: false, sessionRes: session.res };
  }

  const order = createTestOrder(session.sessionToken, baseUrl, tableToken);
  return {
    ok: order.ok,
    sessionToken: session.sessionToken,
    orderId: order.orderId,
    sessionRes: session.res,
    orderRes: order.res,
  };
}
