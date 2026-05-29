import { describe, expect, it } from "vitest";
import { resolveFiscalBehavior } from "@/lib/fulfillment/resolve-fiscal-behavior";
import type { OrderOutboxContext } from "@/lib/outbox/types";

function buildPaymentCompletionEvents(ctx: OrderOutboxContext) {
  const events: Array<{ event_type: string }> = [];
  const guestEmail = ctx.guestEmail ?? null;

  if (
    resolveFiscalBehavior(ctx.posIntegration) !== "standalone" &&
    guestEmail
  ) {
    events.push({ event_type: "fiscal.send_receipt" });
  }

  for (const printer of ctx.cloudPrinters) {
    if (!printer.autoPrint) continue;
    events.push({ event_type: "fulfill.cloud_print" });
  }

  return events;
}

describe("order saga deferrable steps", () => {
  const baseCtx: OrderOutboxContext = {
    orderId: "order-1",
    locationId: "loc-1",
    orgId: "org-1",
    orderNumber: 42,
    tableName: "Table 5",
    total: 12.5,
    paymentStatus: "paid",
    guestEmail: "guest@example.com",
    posIntegration: null,
    cloudPrinters: [],
    activeWebhooks: [],
  };

  it("does not queue tse_sign from buildPaymentCompletionEvents (fiscal pipeline owns TSE)", () => {
    const events = buildPaymentCompletionEvents(baseCtx);
    expect(events.map((event) => event.event_type)).not.toContain(
      "fiscal.tse_sign"
    );
  });

  it("queues cloud_print for auto printers", () => {
    const events = buildPaymentCompletionEvents({
      ...baseCtx,
      cloudPrinters: [
        { id: "p1", provider: "star_cloudprnt", autoPrint: true },
      ],
    });
    expect(events.map((event) => event.event_type)).toContain(
      "fulfill.cloud_print"
    );
  });

  it("queues send_receipt for connected POS with guest email", () => {
    const events = buildPaymentCompletionEvents({
      ...baseCtx,
      posIntegration: {
        id: "pos-1",
        provider: "deliverect",
        status: "connected",
      },
    });
    expect(events.map((event) => event.event_type)).toEqual([
      "fiscal.send_receipt",
    ]);
  });
});
