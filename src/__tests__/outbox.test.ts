import { describe, expect, it, vi, afterEach } from "vitest";
import { buildOutboxEvents } from "@/lib/outbox/build-outbox-events";
import { retryDeadLetterQueueItem } from "@/lib/outbox/dead-letter-queue";
import * as enqueueEvents from "@/lib/outbox/enqueue-events";
import * as dlq from "@/lib/outbox/dead-letter-queue";
import {
  getOutboxHandler,
} from "@/lib/outbox/handlers/registry";
import * as registry from "@/lib/outbox/handlers/registry";
import {
  processClaimedOutboxEvent,
  snapshotToHandlerMetrics,
  type OutboxEventRow,
} from "@/lib/outbox/processor";
import type { OrderOutboxContext } from "@/lib/outbox/types";

function baseContext(
  overrides: Partial<OrderOutboxContext> = {}
): OrderOutboxContext {
  return {
    orderId: "order-1",
    locationId: "loc-1",
    orgId: "org-1",
    orderNumber: 42,
    tableName: "Table 5",
    total: 19.9,
    paymentStatus: "pending",
    posIntegration: null,
    posPushOnPayment: false,
    cloudPrinters: [],
    activeWebhooks: [],
    ...overrides,
  };
}

describe("buildOutboxEvents", () => {
  it("returns no outbox rows for approval_requested phase", () => {
    const events = buildOutboxEvents(baseContext(), "approval_requested");
    expect(events).toEqual([]);
  });

  it("does not enqueue fiscal events on order create (FC-2: TSE at payment)", () => {
    const events = buildOutboxEvents(
      baseContext({ guestEmail: "guest@example.com" }),
      "created"
    );
    expect(events.map((e) => e.event_type)).toEqual(["fulfill.notify_staff"]);
    expect(events.some((e) => e.domain === "fiscal")).toBe(false);
  });

  it("skips fulfill.push_pos for pos-origin orders", () => {
    const events = buildOutboxEvents(
      baseContext({
        orderSource: "pos",
        posIntegration: {
          id: "pos-1",
          provider: "deliverect",
          status: "connected",
        },
      }),
      "created"
    );

    expect(events.map((e) => e.event_type)).toEqual(["fulfill.notify_staff"]);
  });

  it("skips fiscal events in vorsystem mode and adds fulfill.push_pos", () => {
    const events = buildOutboxEvents(
      baseContext({
        posIntegration: {
          id: "pos-1",
          provider: "deliverect",
          status: "connected",
        },
        paymentStatus: "paid",
      }),
      "created"
    );

    expect(events.map((e) => e.event_type)).toEqual([
      "fulfill.notify_staff",
      "fulfill.push_pos",
    ]);

    const posEvent = events.find((e) => e.event_type === "fulfill.push_pos");
    expect(posEvent?.payload.paymentState).toBe("PAID");
  });

  it("holds fulfill.push_pos at create time for pay-first locations until payment confirms", () => {
    const events = buildOutboxEvents(
      baseContext({
        posIntegration: {
          id: "pos-1",
          provider: "deliverect",
          status: "connected",
        },
        posPushOnPayment: true,
        paymentStatus: "pending",
      }),
      "created"
    );

    expect(events.map((e) => e.event_type)).not.toContain("fulfill.push_pos");
  });

  it("still pushes at create time for pay-first locations if somehow already paid", () => {
    const events = buildOutboxEvents(
      baseContext({
        posIntegration: {
          id: "pos-1",
          provider: "deliverect",
          status: "connected",
        },
        posPushOnPayment: true,
        paymentStatus: "paid",
      }),
      "created"
    );

    expect(events.map((e) => e.event_type)).toContain("fulfill.push_pos");
  });

  it("adds integration.webhook per active webhook config", () => {
    const events = buildOutboxEvents(
      baseContext({
        activeWebhooks: [
          { id: "wh-1", url: "https://example.com/hook" },
          { id: "wh-2", url: "https://example.com/hook2" },
        ],
      }),
      "approved"
    );

    const webhookEvents = events.filter(
      (e) => e.event_type === "integration.webhook"
    );
    expect(webhookEvents).toHaveLength(2);
    expect(webhookEvents[0]?.payload.webhookConfigId).toBe("wh-1");
  });

  it("adds fulfill.cloud_print for auto-print cloud printers", () => {
    const events = buildOutboxEvents(
      baseContext({
        cloudPrinters: [
          { id: "cp-1", provider: "star_cloudprnt", autoPrint: true },
          { id: "cp-2", provider: "star_cloudprnt", autoPrint: false },
        ],
      }),
      "created"
    );

    expect(
      events.filter((e) => e.event_type === "fulfill.cloud_print")
    ).toHaveLength(1);
  });

  it("enqueues four side-effect handlers on order create with full venue config", () => {
    const events = buildOutboxEvents(
      baseContext({
        posIntegration: {
          id: "pos-1",
          provider: "deliverect",
          status: "connected",
        },
        cloudPrinters: [
          { id: "cp-1", provider: "star_cloudprnt", autoPrint: true },
        ],
        activeWebhooks: [{ id: "wh-1", url: "https://example.com/hook" }],
      }),
      "created"
    );

    expect(events).toHaveLength(4);
    expect(events.map((event) => event.event_type)).toEqual([
      "fulfill.notify_staff",
      "fulfill.push_pos",
      "fulfill.cloud_print",
      "integration.webhook",
    ]);
  });
});

describe("computeOutboxRetryDelaySeconds", () => {
  it("applies exponential backoff capped at 300s", async () => {
    const { computeOutboxRetryDelaySeconds } = await import(
      "@/lib/outbox/retry-delay"
    );
    expect(computeOutboxRetryDelaySeconds(0)).toBe(5);
    expect(computeOutboxRetryDelaySeconds(1)).toBe(10);
    expect(computeOutboxRetryDelaySeconds(2)).toBe(20);
    expect(computeOutboxRetryDelaySeconds(10)).toBe(300);
  });
});

describe("getOutboxHandler", () => {
  const prompt60Handlers = [
    "fulfill.notify_staff",
    "fulfill.push_pos",
    "fulfill.cloud_print",
    "fiscal.tse_sign",
    "fiscal.beleg",
    "fiscal.send_receipt",
    "integration.webhook",
    "billing.low_balance",
    "commerce.denis.world",
    "commerce.alert.staff",
    "commerce.preorder.release",
    "session.paid_online",
  ] as const;

  it("registers every Prompt 60 handler", () => {
    for (const eventType of prompt60Handlers) {
      const handler = getOutboxHandler(eventType);
      expect(handler, eventType).toBeTypeOf("function");
    }
  });

  it("resolves known event types", () => {
    expect(getOutboxHandler("fulfill.notify_staff")).toBeDefined();
    expect(getOutboxHandler("fulfill.push_pos")).toBeDefined();
    expect(getOutboxHandler("session.paid_online")).toBeDefined();
    expect(getOutboxHandler("fiscal.tse_sign")).toBeDefined();
    expect(getOutboxHandler("fiscal.beleg")).toBeDefined();
    expect(getOutboxHandler("commerce.preorder.release")).toBeDefined();
    expect(getOutboxHandler("session.eval")).toBeDefined();
    expect(getOutboxHandler("unknown.event")).toBeUndefined();
  });
});

describe("outbox processor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aggregates handler metrics from batch snapshot", () => {
    const metrics = snapshotToHandlerMetrics({
      "fulfill.notify_staff": {
        processed: 8,
        failed: 1,
        deadLetter: 1,
        totalLatencyMs: 400,
      },
    });

    expect(metrics).toEqual([
      {
        eventType: "fulfill.notify_staff",
        throughput: 8,
        failed: 1,
        deadLetter: 1,
        failureRate: 20,
        avgLatencyMs: 50,
      },
    ]);
  });

  it("dead-letters after max attempts and retries on success", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const admin = { rpc } as never;
    const metrics = {};
    const failingHandler = vi.fn().mockRejectedValue(new Error("printer offline"));
    const successHandler = vi.fn().mockResolvedValue(undefined);
    const moveToDeadLetterQueue = vi
      .spyOn(dlq, "moveToDeadLetterQueue")
      .mockResolvedValue(undefined);

    vi.spyOn(registry, "getOutboxHandler").mockReturnValue(failingHandler);

    const baseEvent = {
      id: "evt-1",
      event_type: "fulfill.cloud_print",
      domain: "fulfillment",
      aggregate_id: "order-1",
      aggregate_type: "order",
      payload: { orderId: "order-1" },
      max_attempts: 3,
      attempts: 1,
      status: "processing",
      next_retry_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      processed_at: null,
      last_error: null,
    } satisfies OutboxEventRow;

    const outcomeFail = await processClaimedOutboxEvent(
      admin,
      { ...baseEvent, attempts: 1 },
      metrics
    );
    expect(outcomeFail).toBe("failed");
    expect(moveToDeadLetterQueue).not.toHaveBeenCalled();

    const outcomeDlq = await processClaimedOutboxEvent(
      admin,
      { ...baseEvent, attempts: 3 },
      metrics
    );
    expect(outcomeDlq).toBe("deadLetter");
    expect(moveToDeadLetterQueue).toHaveBeenCalledTimes(1);

    vi.spyOn(registry, "getOutboxHandler").mockReturnValue(successHandler);
    const successOutcome = await processClaimedOutboxEvent(
      admin,
      { ...baseEvent, attempts: 1 },
      {}
    );
    expect(successOutcome).toBe("succeeded");
    expect(successHandler).toHaveBeenCalled();
  });

  it("re-enqueues DLQ payload for manual retry", async () => {
    const enqueueOutboxEvents = vi
      .spyOn(enqueueEvents, "enqueueOutboxEvents")
      .mockResolvedValue(1);

    vi.spyOn(dlq, "moveToDeadLetterQueue").mockResolvedValue(undefined);

    const adminModule = await import("@/lib/supabase/admin");
    vi.spyOn(adminModule, "createAdminClient").mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            is: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "dlq-1",
                  org_id: "org-1",
                  job_type: "fulfill.notify_staff",
                  payload: {
                    outboxPayload: { orderId: "order-1", locationId: "loc-1" },
                    aggregateId: "order-1",
                    domain: "fulfillment",
                  },
                },
                error: null,
              }),
            }),
          }),
        }),
        update: () => ({
          eq: async () => ({ error: null }),
        }),
      }),
    } as never);

    const result = await retryDeadLetterQueueItem("dlq-1", "user-1");
    expect(result.error).toBeUndefined();
    expect(enqueueOutboxEvents).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([
        expect.objectContaining({
          aggregate_id: "order-1",
          domain: "fulfillment",
          event_type: "fulfill.notify_staff",
        }),
      ])
    );
  });
});
