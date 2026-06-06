import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET as getLocations } from "@/app/api/operator/v1/locations/route";
import { GET as getOrders } from "@/app/api/operator/v1/locations/[locationId]/orders/route";
import { GET as getTranscript } from "@/app/api/operator/v1/sessions/[sessionId]/transcript/route";
import * as operatorAuth from "@/lib/operator/auth";
import * as operatorAudit from "@/lib/operator/audit-log";
import * as locationOrders from "@/lib/operator/projections/list-location-orders";
import * as sessionTranscript from "@/lib/operator/projections/session-transcript";
import * as rateLimit from "@/lib/rate-limit";
import * as supabaseAdmin from "@/lib/supabase/admin";

function makeNextRequest(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { method: "GET", headers });
}

describe("operator API contract smoke", () => {
  beforeEach(() => {
    vi.spyOn(rateLimit, "withRateLimit").mockResolvedValue(null);
    vi.spyOn(operatorAudit, "logOperatorApiRequest").mockResolvedValue();
    vi.spyOn(supabaseAdmin, "createAdminClient").mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [{ id: "loc-1", name: "Main", ai_concierge_enabled: true }],
                  error: null,
                }),
            }),
          }),
        }),
      }),
    } as never);
  });

  it("returns 401 without bearer token on locations", async () => {
    const res = await getLocations(makeNextRequest("http://localhost/api/operator/v1/locations"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(401);
  });

  it("returns locations JSON with version header when auth passes", async () => {
    vi.spyOn(operatorAuth, "authenticateOperatorApiKey").mockResolvedValue({
      keyId: "key-1",
      orgId: "org-1",
      scopes: ["operator:read"],
    });

    const res = await getLocations(
      makeNextRequest("http://localhost/api/operator/v1/locations", {
        Authorization: "Bearer dns_op_live_test",
      }),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Denis-Operator-Api-Version")).toBe("1");
    const json = (await res.json()) as { data?: { locations?: unknown[] } };
    expect(Array.isArray(json.data?.locations)).toBe(true);
  });

  it("returns orders shape from projection", async () => {
    vi.spyOn(operatorAuth, "authenticateOperatorApiKey").mockResolvedValue({
      keyId: "key-1",
      orgId: "org-1",
      scopes: ["operator:read"],
    });
    vi.spyOn(locationOrders, "projectLocationOrders").mockResolvedValue([
      {
        orderId: "ord-1",
        orderNumber: 7,
        status: "preparing",
        totalCents: 990,
        itemCount: 1,
        createdAt: "2026-05-29T12:00:00.000Z",
        sessionId: "sess-1",
      },
    ]);

    const res = await getOrders(
      makeNextRequest(
        "http://localhost/api/operator/v1/locations/loc-1/orders?status=open",
        { Authorization: "Bearer dns_op_live_test" }
      ),
      { params: Promise.resolve({ locationId: "loc-1" }) }
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data?: { orders?: Array<{ orderId: string }> };
    };
    expect(json.data?.orders?.[0]?.orderId).toBe("ord-1");
  });

  it("returns transcript with redacted flag by default", async () => {
    vi.spyOn(operatorAuth, "authenticateOperatorApiKey").mockResolvedValue({
      keyId: "key-1",
      orgId: "org-1",
      scopes: ["operator:read"],
    });
    vi.spyOn(sessionTranscript, "projectOperatorSessionTranscript").mockResolvedValue({
      sessionId: "sess-1",
      locationId: "loc-1",
      turns: [{ role: "user", content: "Hi" }],
      redacted: true,
    });

    const res = await getTranscript(
      makeNextRequest(
        "http://localhost/api/operator/v1/sessions/sess-1/transcript",
        { Authorization: "Bearer dns_op_live_test" }
      ),
      { params: Promise.resolve({ sessionId: "sess-1" }) }
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data?: { redacted?: boolean; turns?: unknown[] };
    };
    expect(json.data?.redacted).toBe(true);
    expect(json.data?.turns).toHaveLength(1);
  });

  it("returns 403 when operator:read scope is missing", async () => {
    vi.spyOn(operatorAuth, "authenticateOperatorApiKey").mockResolvedValue({
      keyId: "key-1",
      orgId: "org-1",
      scopes: ["operator:propose"],
    });

    const res = await getTranscript(
      makeNextRequest(
        "http://localhost/api/operator/v1/sessions/sess-1/transcript",
        { Authorization: "Bearer dns_op_live_test" }
      ),
      { params: Promise.resolve({ sessionId: "sess-1" }) }
    );

    expect(res.status).toBe(403);
  });
});
