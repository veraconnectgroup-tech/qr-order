import { createHmac } from "crypto";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { loadIntegrationMock, handleDeliverectWebhookMock, rateLimitMock } =
  vi.hoisted(() => ({
    loadIntegrationMock: vi.fn(),
    handleDeliverectWebhookMock: vi.fn(),
    rateLimitMock: vi.fn().mockResolvedValue(null),
  }));

vi.mock("@/lib/pos/inbound/handle-inbound-webhook", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/pos/inbound/handle-inbound-webhook")
  >("@/lib/pos/inbound/handle-inbound-webhook");
  return {
    ...actual,
    loadIntegration: loadIntegrationMock,
  };
});

vi.mock("@/lib/pos/deliverect-webhook", () => ({
  handleDeliverectWebhook: handleDeliverectWebhookMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  withRateLimitByKey: rateLimitMock,
}));

const STATUS_ECHO_BODY = JSON.stringify({
  channelOrderId: "11111111-1111-4111-8111-111111111111",
  status: 70,
});

const SECRET = "test-webhook-secret";

function signedRequest(body: string, secret: string | null) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret) {
    headers["x-deliverect-signature"] = createHmac("sha256", secret)
      .update(body)
      .digest("hex");
  }
  return new NextRequest("https://example.com/api/pos/inbound/integration-1", {
    method: "POST",
    headers,
    body,
  });
}

describe("POS inbound status-echo branch requires a valid signature", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a status-echo payload with no signature header", async () => {
    loadIntegrationMock.mockResolvedValue({
      id: "integration-1",
      location_id: "loc-1",
      provider: "deliverect",
      status: "connected",
      config: { webhook_secret: SECRET },
    });

    const { POST } = await import("@/app/api/pos/inbound/[integrationId]/route");
    const res = await POST(signedRequest(STATUS_ECHO_BODY, null), {
      params: Promise.resolve({ integrationId: "11111111-1111-4111-8111-111111111112" }),
    });

    expect(res.status).toBe(401);
    expect(handleDeliverectWebhookMock).not.toHaveBeenCalled();
  });

  it("rejects a status-echo payload with a wrong signature", async () => {
    loadIntegrationMock.mockResolvedValue({
      id: "integration-1",
      location_id: "loc-1",
      provider: "deliverect",
      status: "connected",
      config: { webhook_secret: SECRET },
    });

    const { POST } = await import("@/app/api/pos/inbound/[integrationId]/route");
    const res = await POST(signedRequest(STATUS_ECHO_BODY, "wrong-secret"), {
      params: Promise.resolve({ integrationId: "11111111-1111-4111-8111-111111111112" }),
    });

    expect(res.status).toBe(401);
    expect(handleDeliverectWebhookMock).not.toHaveBeenCalled();
  });

  it("dispatches to handleDeliverectWebhook only once the signature is valid", async () => {
    loadIntegrationMock.mockResolvedValue({
      id: "integration-1",
      location_id: "loc-1",
      provider: "deliverect",
      status: "connected",
      config: { webhook_secret: SECRET },
    });
    handleDeliverectWebhookMock.mockResolvedValue({ ok: true, message: "processed" });

    const { POST } = await import("@/app/api/pos/inbound/[integrationId]/route");
    const res = await POST(signedRequest(STATUS_ECHO_BODY, SECRET), {
      params: Promise.resolve({ integrationId: "11111111-1111-4111-8111-111111111112" }),
    });

    expect(res.status).toBe(200);
    expect(handleDeliverectWebhookMock).toHaveBeenCalledTimes(1);
  });

  it("rejects when the integration is not connected, before checking the signature outcome", async () => {
    loadIntegrationMock.mockResolvedValue({
      id: "integration-1",
      location_id: "loc-1",
      provider: "deliverect",
      status: "disconnected",
      config: { webhook_secret: SECRET },
    });

    const { POST } = await import("@/app/api/pos/inbound/[integrationId]/route");
    const res = await POST(signedRequest(STATUS_ECHO_BODY, SECRET), {
      params: Promise.resolve({ integrationId: "11111111-1111-4111-8111-111111111112" }),
    });

    expect(res.status).toBe(409);
    expect(handleDeliverectWebhookMock).not.toHaveBeenCalled();
  });
});
