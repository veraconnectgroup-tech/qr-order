import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET as getLocations } from "@/app/api/operator/v1/locations/route";
import { GET as getSessions } from "@/app/api/operator/v1/sessions/route";
import { POST as postConfigProposal } from "@/app/api/operator/v1/config/proposals/route";
import { GET as getCommerceInsights } from "@/app/api/operator/v1/locations/[locationId]/commerce/insights/route";
import { GET as getFiscalDailyClosing } from "@/app/api/operator/v1/locations/[locationId]/fiscal/daily-closing/route";
import { GET as getOrders } from "@/app/api/operator/v1/locations/[locationId]/orders/route";
import { GET as getOrderDetail } from "@/app/api/operator/v1/locations/[locationId]/orders/[orderId]/route";
import { GET as getDenisMetrics } from "@/app/api/operator/v1/locations/[locationId]/denis/metrics/route";
import { GET as getTranscript } from "@/app/api/operator/v1/sessions/[sessionId]/transcript/route";
import { GET as getSessionSummary } from "@/app/api/operator/v1/sessions/[sessionId]/summary/route";
import * as operatorAuth from "@/lib/operator/auth";
import * as operatorAudit from "@/lib/operator/audit-log";
import * as configProposals from "@/lib/operator/config-proposals";
import * as commerceInsights from "@/lib/operator/projections/commerce-insights";
import * as denisMetrics from "@/lib/operator/projections/denis-metrics";
import * as fiscalDailyClosing from "@/lib/operator/projections/fiscal-daily-closing";
import * as locationOrders from "@/lib/operator/projections/list-location-orders";
import * as listSessions from "@/lib/operator/projections/list-sessions";
import * as orderDetail from "@/lib/operator/projections/order-detail";
import * as sessionSummary from "@/lib/operator/projections/session-summary";
import * as sessionTranscript from "@/lib/operator/projections/session-transcript";
import * as rateLimit from "@/lib/rate-limit";
import * as supabaseAdmin from "@/lib/supabase/admin";

function makeNextRequest(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { method: "GET", headers });
}

describe("operator API contract smoke", () => {
  beforeEach(() => {
    vi.spyOn(rateLimit, "withOperatorOrgRateLimit").mockResolvedValue(null);
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

  it("returns sessions list for Viktor session feed", async () => {
    vi.spyOn(operatorAuth, "authenticateOperatorApiKey").mockResolvedValue({
      keyId: "key-1",
      orgId: "org-1",
      scopes: ["operator:read"],
    });
    vi.spyOn(listSessions, "projectOperatorSessionList").mockResolvedValue([
      {
        id: "sess-1",
        locationId: "loc-1",
        status: "closed",
        openedAt: "2026-06-06T20:00:00.000Z",
        closedAt: "2026-06-06T21:00:00.000Z",
        messageCount: 8,
        language: "de",
        converted: true,
      },
    ]);

    const res = await getSessions(
      makeNextRequest(
        "http://localhost/api/operator/v1/sessions?locationId=loc-1",
        { Authorization: "Bearer dns_op_live_test" }
      ),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data?: { sessions?: Array<{ id: string }> };
    };
    expect(json.data?.sessions?.[0]?.id).toBe("sess-1");
  });

  it("creates config proposal with operator:propose scope", async () => {
    vi.spyOn(operatorAuth, "authenticateOperatorApiKey").mockResolvedValue({
      keyId: "key-1",
      orgId: "org-1",
      scopes: ["operator:propose"],
    });
    vi.spyOn(configProposals, "createOperatorConfigProposal").mockResolvedValue({
      id: "prop-1",
      orgId: "org-1",
      locationId: "550e8400-e29b-41d4-a716-446655440000",
      kind: "config",
      patch: { persona: { tone: "warm_short" } },
      reason: "Improve greeting conversion",
      status: "pending",
      createdByKeyId: "key-1",
      createdAt: "2026-06-06T20:00:00.000Z",
      reviewedAt: null,
    });

    const req = new NextRequest(
      "http://localhost/api/operator/v1/config/proposals",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer dns_op_live_test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locationId: "550e8400-e29b-41d4-a716-446655440000",
          patch: { persona: { tone: "warm_short" } },
          reason: "Improve greeting conversion",
        }),
      }
    );

    const res = await postConfigProposal(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      data?: { proposal?: { id: string; status: string } };
    };
    expect(json.data?.proposal?.id).toBe("prop-1");
    expect(json.data?.proposal?.status).toBe("pending");
  });

  it("returns 429 when org rate limit is exceeded", async () => {
    vi.spyOn(operatorAuth, "authenticateOperatorApiKey").mockResolvedValue({
      keyId: "key-1",
      orgId: "org-1",
      scopes: ["operator:read"],
    });
    vi.spyOn(rateLimit, "withOperatorOrgRateLimit").mockResolvedValue(
      NextResponse.json(
        {
          ok: false,
          data: null,
          error: {
            code: "rate_limited",
            message: "Too many requests. Please wait a moment.",
            retryable: true,
          },
        },
        { status: 429, headers: { "Retry-After": "60" } }
      )
    );

    const res = await getLocations(
      makeNextRequest("http://localhost/api/operator/v1/locations", {
        Authorization: "Bearer dns_op_live_test",
      }),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
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

  it("returns order detail with items and tax breakdown", async () => {
    vi.spyOn(operatorAuth, "authenticateOperatorApiKey").mockResolvedValue({
      keyId: "key-1",
      orgId: "org-1",
      scopes: ["operator:read"],
    });
    vi.spyOn(orderDetail, "projectOperatorOrderDetail").mockResolvedValue({
      orderId: "ord-1",
      orderNumber: 7,
      locationId: "loc-1",
      locationName: "Skyline",
      status: "delivered",
      paymentMethod: "card",
      paymentMethodRaw: "card_terminal",
      paymentStatus: "paid",
      subtotalCents: 1800,
      taxCents: 287,
      totalCents: 2087,
      tipCents: 0,
      sessionId: "sess-1",
      createdAt: "2026-06-06T20:01:00.000Z",
      acceptedAt: null,
      preparingAt: null,
      readyAt: null,
      deliveredAt: "2026-06-06T20:16:00.000Z",
      taxBreakdown: [
        { rate: 19, netCents: 630, taxCents: 120, grossCents: 750 },
      ],
      items: [
        {
          id: "item-1",
          productName: "Aperol Spritz",
          quantity: 2,
          unitPriceCents: 950,
          totalCents: 1900,
          taxRate: 19,
          menuSection: "drinks",
          notes: null,
          modifiers: [],
        },
      ],
    });

    const res = await getOrderDetail(
      makeNextRequest(
        "http://localhost/api/operator/v1/locations/loc-1/orders/ord-1",
        { Authorization: "Bearer dns_op_live_test" }
      ),
      { params: Promise.resolve({ locationId: "loc-1", orderId: "ord-1" }) }
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data?: { order?: { items?: Array<{ productName: string }> } };
    };
    expect(json.data?.order?.items?.[0]?.productName).toBe("Aperol Spritz");
  });

  it("returns commerce insights for Z-bon style reporting", async () => {
    vi.spyOn(operatorAuth, "authenticateOperatorApiKey").mockResolvedValue({
      keyId: "key-1",
      orgId: "org-1",
      scopes: ["operator:read"],
    });
    vi.spyOn(commerceInsights, "projectCommerceInsights").mockResolvedValue({
      locationId: "loc-1",
      locationName: "Skyline",
      period: {
        from: "2026-06-06T00:00:00.000Z",
        to: "2026-06-06T23:59:59.999Z",
      },
      summary: {
        ordersCount: 6,
        revenueCents: 7950,
        avgCheckCents: 1325,
        firstOrderAt: "2026-06-06T20:01:00.000Z",
        lastOrderAt: "2026-06-06T22:16:00.000Z",
      },
      paymentSummary: {
        cashCents: 3500,
        cardCents: 4450,
        onlineCents: 0,
        otherCents: 0,
      },
      menu: [
        {
          productName: "Aperol Spritz",
          quantity: 4,
          revenueCents: 3800,
        },
      ],
    });

    const res = await getCommerceInsights(
      makeNextRequest(
        "http://localhost/api/operator/v1/locations/loc-1/commerce/insights?period=yesterday&include=menu,payments,tax",
        { Authorization: "Bearer dns_op_live_test" }
      ),
      { params: Promise.resolve({ locationId: "loc-1" }) }
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data?: { summary?: { ordersCount?: number } };
    };
    expect(json.data?.summary?.ordersCount).toBe(6);
  });

  it("returns fiscal daily closing for official Z-bon", async () => {
    vi.spyOn(operatorAuth, "authenticateOperatorApiKey").mockResolvedValue({
      keyId: "key-1",
      orgId: "org-1",
      scopes: ["operator:read"],
    });
    vi.spyOn(fiscalDailyClosing, "projectFiscalDailyClosing").mockResolvedValue({
      closingId: "close-1",
      locationId: "loc-1",
      locationName: "Skyline",
      businessDate: "2026-06-06",
      zNr: 42,
      status: "signed",
      totals: {
        grossCents: 7950,
        netCents: 6820,
        taxCents: 1130,
        cashCents: 3500,
        nonCashCents: 4450,
        tipsCents: 0,
      },
      taxBreakdown: [],
      taxSummary: {
        breakdown: [],
        mwst19: null,
        mwst7: null,
      },
      paymentSummary: {
        cashCents: 3500,
        cardCents: 4450,
        onlineCents: 0,
        otherCents: 0,
      },
      orderCount: 6,
      refundCount: 0,
      refundTotalCents: 0,
      tseSigned: true,
      closedAt: "2026-06-07T04:05:00.000Z",
      zBonPath: "/api/fiscal/daily-closing/close-1/z-bon",
    });

    const res = await getFiscalDailyClosing(
      makeNextRequest(
        "http://localhost/api/operator/v1/locations/loc-1/fiscal/daily-closing?date=2026-06-06",
        { Authorization: "Bearer dns_op_live_test" }
      ),
      { params: Promise.resolve({ locationId: "loc-1" }) }
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data?: { closing?: { zNr?: number } };
    };
    expect(json.data?.closing?.zNr).toBe(42);
  });

  it("requires date query param for fiscal daily closing", async () => {
    vi.spyOn(operatorAuth, "authenticateOperatorApiKey").mockResolvedValue({
      keyId: "key-1",
      orgId: "org-1",
      scopes: ["operator:read"],
    });

    const res = await getFiscalDailyClosing(
      makeNextRequest(
        "http://localhost/api/operator/v1/locations/loc-1/fiscal/daily-closing",
        { Authorization: "Bearer dns_op_live_test" }
      ),
      { params: Promise.resolve({ locationId: "loc-1" }) }
    );

    expect(res.status).toBe(400);
  });

  it("returns session summary with metrics and beliefs", async () => {
    vi.spyOn(operatorAuth, "authenticateOperatorApiKey").mockResolvedValue({
      keyId: "key-1",
      orgId: "org-1",
      scopes: ["operator:read"],
    });
    vi.spyOn(sessionSummary, "projectOperatorSessionSummary").mockResolvedValue({
      sessionId: "sess-1",
      locationId: "loc-1",
      status: "closed",
      outcome: "ordered",
      openedAt: "2026-06-06T20:00:00.000Z",
      closedAt: "2026-06-06T21:00:00.000Z",
      turnCount: 3,
      messageCount: 6,
      language: "de",
      intents: ["ORDER"],
      ordersCount: 1,
      metrics: {
        turnCount: 3,
        llmTurnCount: 1,
        llmInvocationRate: 0.333,
        gapTurnCount: 1,
        gapRate: 0.333,
      },
      beliefs: {
        beliefsHash: "hash-1",
        beliefCount: 4,
        summary: {
          "waiter.gap_count": 0,
          "waiter.can_confirm": true,
        },
        compiledAt: "2026-06-06T20:50:00.000Z",
      },
    });

    const res = await getSessionSummary(
      makeNextRequest(
        "http://localhost/api/operator/v1/sessions/sess-1/summary",
        { Authorization: "Bearer dns_op_live_test" }
      ),
      { params: Promise.resolve({ sessionId: "sess-1" }) }
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Denis-Operator-Api-Version")).toBe("1");
    const json = (await res.json()) as {
      data?: {
        metrics?: { gapRate?: number };
        beliefs?: { summary?: Record<string, unknown> };
      };
    };
    expect(json.data?.metrics?.gapRate).toBe(0.333);
    expect(json.data?.beliefs?.summary?.["waiter.can_confirm"]).toBe(true);
    expect(operatorAudit.logOperatorApiRequest).toHaveBeenCalled();
  });

  it("returns denis metrics with waiterGapRate", async () => {
    vi.spyOn(operatorAuth, "authenticateOperatorApiKey").mockResolvedValue({
      keyId: "key-1",
      orgId: "org-1",
      scopes: ["operator:read"],
    });
    vi.spyOn(denisMetrics, "projectDenisLocationMetrics").mockResolvedValue({
      locationId: "loc-1",
      period: {
        from: "2026-06-06T00:00:00.000Z",
        to: "2026-06-06T23:59:59.999Z",
      },
      sessionsCount: 12,
      sessionsWithDenisActivity: 10,
      sessionsWithOrder: 5,
      conversionRate: 0.417,
      llmInvocationRate: 0.3,
      waiterGapRate: 0.2,
      avgTurnsPerSession: 2.8,
      avgCreditsPerSession: 0.9,
      escalationsCount: 1,
      topLanguages: [{ lang: "de", count: 8 }],
      creditBalance: 200,
      lowBalance: false,
    });

    const res = await getDenisMetrics(
      makeNextRequest(
        "http://localhost/api/operator/v1/locations/loc-1/denis/metrics?period=today",
        { Authorization: "Bearer dns_op_live_test" }
      ),
      { params: Promise.resolve({ locationId: "loc-1" }) }
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data?: { waiterGapRate?: number; llmInvocationRate?: number };
    };
    expect(json.data?.waiterGapRate).toBe(0.2);
    expect(json.data?.llmInvocationRate).toBe(0.3);
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
