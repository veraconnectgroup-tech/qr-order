import { executeDenisOrderCommand } from "@/lib/denis/acl/execute-denis-order-command";
import { executeDenisWaiterHandoff } from "@/lib/denis/acl/execute-denis-waiter-handoff";
import { executeDenisPaymentHandoff } from "@/lib/denis/acl/execute-denis-payment-handoff";
import { executeDenisGuestOrderCancel } from "@/lib/denis/acl/execute-denis-guest-order-cancel";
import { executeDenisOrderModifyRequest } from "@/lib/denis/acl/execute-denis-order-modify-request";
import type { SelectablePaymentMethod } from "@/lib/payment-methods";
import type {
  AgenticToolDefinition,
  AgenticToolExecutorInput,
  SideEffectingToolName,
} from "@/lib/denis/agentic/tool-catalog";

const SELECTABLE_PAYMENT_METHODS: SelectablePaymentMethod[] = [
  "online",
  "at_bar",
  "card_at_table",
];

/**
 * ADR-049 P2 — side-effecting tools. Every executor here follows the
 * SAME two-step shape: (1) check input.dryRun FIRST and return a
 * synthetic "would have called X" result without touching the real ACL
 * function — this check is unconditional, before any other logic; (2)
 * only past that gate does it call the existing src/lib/denis/acl/
 * executor, unchanged, with a real idempotency key. This file adds no
 * new side-effect mechanism — it is a new caller of the ACL pattern
 * already proven for order-taking, never a bypass of it.
 *
 * Wiring the real (non-dry-run) path into a live guest turn is P4 work,
 * gated by eval (P3) + founder review — not done in this session.
 */

function buildIdempotencyKey(
  prefix: string,
  ctx: AgenticToolExecutorInput["ctx"]
): string {
  const scope = ctx.tableSessionState?.session.id ?? ctx.locationId;
  return `agentic:${prefix}:${scope}:${Date.now()}`;
}

const addToOrder: AgenticToolDefinition = {
  definition: {
    name: "add_to_order",
    description: "Add one item to the guest's current order.",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string", description: "Catalog product id." },
        quantity: { type: "integer", minimum: 1, maximum: 20 },
      },
      required: ["productId", "quantity"],
    },
  },
  sideEffecting: true,
  execute: async (input, args) => {
    const productId = typeof args.productId === "string" ? args.productId : null;
    const quantity =
      typeof args.quantity === "number" && args.quantity > 0
        ? Math.min(20, Math.floor(args.quantity))
        : 1;

    if (!productId) return { ok: false, error: "missing_product_id" };

    if (input.dryRun) {
      return {
        ok: true,
        dryRun: true,
        wouldCall: "executeDenisOrderCommand",
        productId,
        quantity,
      };
    }

    if (!input.catalog || !input.session) {
      return { ok: false, error: "missing_execution_context" };
    }

    const product =
      input.catalog.catalog[productId] ?? input.catalog.productMap[productId];
    if (!product) return { ok: false, error: "unknown_product" };

    return executeDenisOrderCommand({
      command: {
        idempotencyKey: buildIdempotencyKey("order", input.ctx),
        aiSessionId: input.session.aiSessionId,
        sessionToken: input.session.sessionToken,
        tableToken: input.session.tableToken,
        deviceFingerprint: input.session.deviceFingerprint,
        deviceToken: input.session.deviceToken,
        lines: [
          {
            productId,
            quantity,
            serveSize: null,
            modifierIds: [],
            notes: "",
            expectedUnitPrice: product.price,
          },
        ],
      },
      catalog: input.catalog,
    });
  },
};

const callWaiter: AgenticToolDefinition = {
  definition: {
    name: "call_waiter",
    description: "Ask a waiter to come to this guest's table.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  sideEffecting: true,
  execute: async (input) => {
    if (input.dryRun) {
      return { ok: true, dryRun: true, wouldCall: "executeDenisWaiterHandoff" };
    }

    if (!input.session) {
      return { ok: false, error: "missing_execution_context" };
    }

    return executeDenisWaiterHandoff(input.admin, {
      tableId: input.ctx.tableSessionState?.table.id ?? "",
      locationId: input.ctx.locationId,
      tableToken: input.session.tableToken,
      sessionToken: input.session.sessionToken,
    });
  },
};

const requestPayment: AgenticToolDefinition = {
  definition: {
    name: "request_payment",
    description:
      "Request the bill be settled for this guest's table (in person, e.g. by card or cash at table).",
    parameters: {
      type: "object",
      properties: {
        paymentMethod: {
          type: "string",
          enum: SELECTABLE_PAYMENT_METHODS,
          description:
            "How the guest wants to settle in person: online (Stripe link), at_bar, or card_at_table.",
        },
      },
      required: ["paymentMethod"],
    },
  },
  sideEffecting: true,
  execute: async (input, args) => {
    const paymentMethod = SELECTABLE_PAYMENT_METHODS.includes(
      args.paymentMethod as SelectablePaymentMethod
    )
      ? (args.paymentMethod as SelectablePaymentMethod)
      : null;

    if (input.dryRun) {
      return {
        ok: true,
        dryRun: true,
        wouldCall: "executeDenisPaymentHandoff",
        paymentMethod,
      };
    }

    if (!input.session || !paymentMethod) {
      return { ok: false, error: "missing_execution_context" };
    }

    return executeDenisPaymentHandoff(input.admin, {
      tableId: input.ctx.tableSessionState?.table.id ?? "",
      locationId: input.ctx.locationId,
      sessionToken: input.session.sessionToken ?? "",
      paymentMethod,
    });
  },
};

/**
 * 2026-07-12 audit finding — order.cancel/order.modify.request were real,
 * working ACL executors (M23) that Denis had zero prompt-level awareness
 * of and no LLM-reachable way to invoke — only a deterministic reflex
 * layer (reflex-plan.ts) could trigger them. Wiring the SAME executors
 * here gives Denis actual tool-calling access to them, gated by the same
 * dryRun/shadow rules as every other side-effecting tool — the reflex
 * path is unchanged and stays the fast, deterministic first line for the
 * phrasings it already catches.
 */
const cancelOrder: AgenticToolDefinition = {
  definition: {
    name: "cancel_order",
    description:
      "Cancel the guest's current pending order. Only works before the kitchen has accepted it — check the result to see whether it actually cancelled or a staff member needs to help instead.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  sideEffecting: true,
  execute: async (input) => {
    if (input.dryRun) {
      return { ok: true, dryRun: true, wouldCall: "executeDenisGuestOrderCancel" };
    }

    if (!input.session) {
      return { ok: false, error: "missing_execution_context" };
    }

    return executeDenisGuestOrderCancel(input.admin, {
      tableId: input.ctx.tableSessionState?.table.id ?? "",
      locationId: input.ctx.locationId,
      sessionToken: input.session.sessionToken ?? "",
    });
  },
};

const requestOrderModification: AgenticToolDefinition = {
  definition: {
    name: "request_order_modification",
    description:
      "Guest wants to change an order they already submitted (add/remove/replace items). Cancels it so they can reorder if the kitchen hasn't started yet; otherwise calls a waiter to handle the change in person.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  sideEffecting: true,
  execute: async (input) => {
    if (input.dryRun) {
      return { ok: true, dryRun: true, wouldCall: "executeDenisOrderModifyRequest" };
    }

    if (!input.session) {
      return { ok: false, error: "missing_execution_context" };
    }

    return executeDenisOrderModifyRequest(input.admin, {
      tableId: input.ctx.tableSessionState?.table.id ?? "",
      locationId: input.ctx.locationId,
      tableToken: input.session.tableToken,
      sessionToken: input.session.sessionToken ?? "",
    });
  },
};

export const SIDE_EFFECTING_TOOL_CATALOG: Record<
  SideEffectingToolName,
  AgenticToolDefinition
> = {
  add_to_order: addToOrder,
  call_waiter: callWaiter,
  cancel_order: cancelOrder,
  request_order_modification: requestOrderModification,
  request_payment: requestPayment,
};
