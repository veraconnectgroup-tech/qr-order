import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DenisTurnContext } from "@/lib/denis/runtime/turn-types";

const executeDenisOrderCommandMock = vi.fn();
const executeDenisWaiterHandoffMock = vi.fn();
const executeDenisPaymentHandoffMock = vi.fn();
const executeDenisGuestOrderCancelMock = vi.fn();
const executeDenisOrderModifyRequestMock = vi.fn();

vi.mock("@/lib/denis/acl/execute-denis-order-command", () => ({
  executeDenisOrderCommand: (...args: unknown[]) =>
    executeDenisOrderCommandMock(...args),
}));
vi.mock("@/lib/denis/acl/execute-denis-waiter-handoff", () => ({
  executeDenisWaiterHandoff: (...args: unknown[]) =>
    executeDenisWaiterHandoffMock(...args),
}));
vi.mock("@/lib/denis/acl/execute-denis-payment-handoff", () => ({
  executeDenisPaymentHandoff: (...args: unknown[]) =>
    executeDenisPaymentHandoffMock(...args),
}));
vi.mock("@/lib/denis/acl/execute-denis-guest-order-cancel", () => ({
  executeDenisGuestOrderCancel: (...args: unknown[]) =>
    executeDenisGuestOrderCancelMock(...args),
}));
vi.mock("@/lib/denis/acl/execute-denis-order-modify-request", () => ({
  executeDenisOrderModifyRequest: (...args: unknown[]) =>
    executeDenisOrderModifyRequestMock(...args),
}));

const { SIDE_EFFECTING_TOOL_CATALOG } = await import(
  "@/lib/denis/agentic/side-effecting-tool-catalog"
);

const baseCtx = {
  locationId: "loc_1",
  tableSessionState: { table: { id: "table_1" }, session: { id: "session_1" } },
} as unknown as DenisTurnContext;

const fullSession = {
  aiSessionId: "11111111-1111-1111-1111-111111111111",
  sessionToken: "session-token",
  tableToken: "table-token",
  deviceFingerprint: "fingerprint-12345678",
};

describe("SIDE_EFFECTING_TOOL_CATALOG — ADR-049 §4.3 incident prevention", () => {
  beforeEach(() => {
    executeDenisOrderCommandMock.mockReset();
    executeDenisWaiterHandoffMock.mockReset();
    executeDenisPaymentHandoffMock.mockReset();
    executeDenisGuestOrderCancelMock.mockReset();
    executeDenisOrderModifyRequestMock.mockReset();
  });

  it("add_to_order never calls executeDenisOrderCommand when dryRun is true, even with full context", async () => {
    const result = await SIDE_EFFECTING_TOOL_CATALOG.add_to_order.execute(
      {
        admin: {} as never,
        ctx: baseCtx,
        dryRun: true,
        catalog: {
          menuText: "",
          productMap: {},
          catalog: { p1: { id: "p1", name: "Cola", price: 3.5 } as never },
          currency: "EUR",
          cachedAt: "",
        },
        session: fullSession,
      },
      { productId: "p1", quantity: 2 }
    );

    expect(executeDenisOrderCommandMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, dryRun: true, productId: "p1", quantity: 2 });
  });

  it("call_waiter never calls executeDenisWaiterHandoff when dryRun is true, even with full context", async () => {
    const result = await SIDE_EFFECTING_TOOL_CATALOG.call_waiter.execute(
      { admin: {} as never, ctx: baseCtx, dryRun: true, session: fullSession },
      {}
    );

    expect(executeDenisWaiterHandoffMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, dryRun: true });
  });

  it("request_payment never calls executeDenisPaymentHandoff when dryRun is true, even with full context", async () => {
    const result = await SIDE_EFFECTING_TOOL_CATALOG.request_payment.execute(
      { admin: {} as never, ctx: baseCtx, dryRun: true, session: fullSession },
      { paymentMethod: "at_bar" }
    );

    expect(executeDenisPaymentHandoffMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, dryRun: true, paymentMethod: "at_bar" });
  });

  it("add_to_order DOES call the real executor when dryRun is false and context is complete", async () => {
    executeDenisOrderCommandMock.mockResolvedValue({ ok: true, data: { orderId: "o1" } });

    await SIDE_EFFECTING_TOOL_CATALOG.add_to_order.execute(
      {
        admin: {} as never,
        ctx: baseCtx,
        dryRun: false,
        catalog: {
          menuText: "",
          productMap: {},
          catalog: { p1: { id: "p1", name: "Cola", price: 3.5 } as never },
          currency: "EUR",
          cachedAt: "",
        },
        session: fullSession,
      },
      { productId: "p1", quantity: 1 }
    );

    expect(executeDenisOrderCommandMock).toHaveBeenCalledTimes(1);
  });

  it("add_to_order refuses to call the real executor when dryRun is false but context is incomplete", async () => {
    const result = await SIDE_EFFECTING_TOOL_CATALOG.add_to_order.execute(
      { admin: {} as never, ctx: baseCtx, dryRun: false },
      { productId: "p1", quantity: 1 }
    );

    expect(executeDenisOrderCommandMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: "missing_execution_context" });
  });

  it("cancel_order never calls executeDenisGuestOrderCancel when dryRun is true, even with full context", async () => {
    const result = await SIDE_EFFECTING_TOOL_CATALOG.cancel_order.execute(
      { admin: {} as never, ctx: baseCtx, dryRun: true, session: fullSession },
      {}
    );

    expect(executeDenisGuestOrderCancelMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, dryRun: true });
  });

  it("cancel_order DOES call the real executor when dryRun is false and context is complete", async () => {
    executeDenisGuestOrderCancelMock.mockResolvedValue({
      ok: true,
      kind: "cancelled",
      orderId: "o1",
      orderNumber: 42,
    });

    const result = await SIDE_EFFECTING_TOOL_CATALOG.cancel_order.execute(
      { admin: {} as never, ctx: baseCtx, dryRun: false, session: fullSession },
      {}
    );

    expect(executeDenisGuestOrderCancelMock).toHaveBeenCalledTimes(1);
    expect(executeDenisGuestOrderCancelMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        tableId: "table_1",
        locationId: "loc_1",
        sessionToken: "session-token",
      })
    );
    expect(result).toMatchObject({ ok: true, kind: "cancelled" });
  });

  it("cancel_order refuses to call the real executor when dryRun is false but context is incomplete", async () => {
    const result = await SIDE_EFFECTING_TOOL_CATALOG.cancel_order.execute(
      { admin: {} as never, ctx: baseCtx, dryRun: false },
      {}
    );

    expect(executeDenisGuestOrderCancelMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: "missing_execution_context" });
  });

  it("request_order_modification never calls executeDenisOrderModifyRequest when dryRun is true, even with full context", async () => {
    const result = await SIDE_EFFECTING_TOOL_CATALOG.request_order_modification.execute(
      { admin: {} as never, ctx: baseCtx, dryRun: true, session: fullSession },
      {}
    );

    expect(executeDenisOrderModifyRequestMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, dryRun: true });
  });

  it("request_order_modification DOES call the real executor when dryRun is false and context is complete", async () => {
    executeDenisOrderModifyRequestMock.mockResolvedValue({
      ok: true,
      kind: "staff_escalation",
      orderNumber: 42,
    });

    const result = await SIDE_EFFECTING_TOOL_CATALOG.request_order_modification.execute(
      { admin: {} as never, ctx: baseCtx, dryRun: false, session: fullSession },
      {}
    );

    expect(executeDenisOrderModifyRequestMock).toHaveBeenCalledTimes(1);
    expect(executeDenisOrderModifyRequestMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        tableId: "table_1",
        locationId: "loc_1",
        tableToken: "table-token",
        sessionToken: "session-token",
      })
    );
    expect(result).toMatchObject({ ok: true, kind: "staff_escalation" });
  });

  it("request_order_modification refuses to call the real executor when dryRun is false but context is incomplete", async () => {
    const result = await SIDE_EFFECTING_TOOL_CATALOG.request_order_modification.execute(
      { admin: {} as never, ctx: baseCtx, dryRun: false },
      {}
    );

    expect(executeDenisOrderModifyRequestMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: "missing_execution_context" });
  });
});
