import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";
import type { OpenAiToolDefinition } from "@/lib/ai/types";
import type { DenisTurnContext } from "@/lib/denis/runtime/turn-types";
import { loadVenueInventorySnapshot } from "@/lib/denis/intelligence/load-venue-inventory";
import { loadSessionPaymentBeliefs } from "@/lib/sessions/request-session-payment-in-person";

/**
 * ADR-049 Part V/VI (Capability Engine / Expert Registry) — read-only tools
 * Denis can call mid-conversation instead of answering from a stale
 * turn-start snapshot. Kitchen/station checks read data already computed
 * this turn (zero new queries, matches ADR-048 Slice 0's source); stock
 * and bill checks do a fresh, cheap read since those need current truth
 * beyond what's already snapshotted.
 *
 * P1 scope — read-only only. Side-effecting tools (add_to_order,
 * call_waiter, request_payment) are a separate P2 catalog that routes
 * through the existing src/lib/denis/acl/ executors, not this file.
 */

export type ReadOnlyToolName =
  | "check_kitchen_status"
  | "check_station_stress"
  | "check_stock"
  | "check_bill";

export type SideEffectingToolName =
  | "add_to_order"
  | "call_waiter"
  | "request_payment";

export type AgenticToolName = ReadOnlyToolName | SideEffectingToolName;

export type AgenticToolExecutorInput = {
  admin: SupabaseClient;
  ctx: DenisTurnContext;
  /**
   * ADR-049 §4.3 — side-effecting tools MUST check this first and never
   * call the real ACL executor when true. Read-only tools ignore it.
   * Defaults to true at the type level's call sites are expected to set
   * this explicitly, never rely on an implicit default.
   */
  dryRun: boolean;
  /** Only used by add_to_order — resolved catalog for expectedUnitPrice lookup. */
  catalog?: AiCatalog;
  /** Guest-facing identifiers ACL executors need but DenisTurnContext doesn't carry. */
  session?: {
    aiSessionId: string;
    sessionToken?: string;
    tableToken: string;
    deviceFingerprint: string;
    deviceToken?: string;
  };
};

export type AgenticToolDefinition = {
  definition: OpenAiToolDefinition;
  /** ADR-049 §4.1/§4.3 — side-effecting tools route through src/lib/denis/acl/ and respect dryRun; read-only tools do neither. */
  sideEffecting: boolean;
  execute: (
    input: AgenticToolExecutorInput,
    args: Record<string, unknown>
  ) => Promise<unknown>;
};

const checkKitchenStatus: AgenticToolDefinition = {
  definition: {
    name: "check_kitchen_status",
    description:
      "Check the kitchen's current backlog and stress level for this venue right now.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  sideEffecting: false,
  execute: async ({ ctx }) => {
    const kitchen = ctx.venueOps?.stationStress?.find(
      (station) => station.station === "kitchen"
    );
    if (!kitchen) return { known: false };
    return {
      known: true,
      stress: kitchen.stress,
      activeOrders: kitchen.activeCount,
      avgWaitMinutes: kitchen.avgWaitMinutes,
    };
  },
};

const checkStationStress: AgenticToolDefinition = {
  definition: {
    name: "check_station_stress",
    description:
      "Check load/stress for a specific station (kitchen or bar) right now.",
    parameters: {
      type: "object",
      properties: {
        station: {
          type: "string",
          enum: ["kitchen", "bar"],
          description: "Which station to check.",
        },
      },
      required: ["station"],
    },
  },
  sideEffecting: false,
  execute: async ({ ctx }, args) => {
    const station = typeof args.station === "string" ? args.station : null;
    const match = station
      ? ctx.venueOps?.stationStress?.find((row) => row.station === station)
      : undefined;
    if (!match) return { known: false };
    return {
      known: true,
      station: match.station,
      stress: match.stress,
      activeOrders: match.activeCount,
      avgWaitMinutes: match.avgWaitMinutes,
    };
  },
};

const checkStock: AgenticToolDefinition = {
  definition: {
    name: "check_stock",
    description:
      "Check current stock/availability for menu items at this venue.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  sideEffecting: false,
  execute: async ({ admin, ctx }) => {
    const snapshot = await loadVenueInventorySnapshot(admin, {
      locationId: ctx.locationId,
    });
    return {
      unavailableProductIds: snapshot.autoUnavailableProductIds,
      lowStockAlertCount: snapshot.alerts.length,
    };
  },
};

const checkBill: AgenticToolDefinition = {
  definition: {
    name: "check_bill",
    description:
      "Check the current bill and amount due for this guest's table session.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  sideEffecting: false,
  execute: async ({ admin, ctx }) => {
    const sessionId = ctx.tableSessionState?.session.id;
    if (!sessionId) return { known: false };
    const beliefs = await loadSessionPaymentBeliefs(admin, sessionId);
    return {
      known: true,
      amountDue: beliefs.amountDue,
      unpaidCount: beliefs.unpaidCount,
      paymentAlreadyRequested: beliefs.paymentAlreadyRequested,
    };
  },
};

export const READ_ONLY_TOOL_CATALOG: Record<
  ReadOnlyToolName,
  AgenticToolDefinition
> = {
  check_kitchen_status: checkKitchenStatus,
  check_station_stress: checkStationStress,
  check_stock: checkStock,
  check_bill: checkBill,
};

export function listReadOnlyToolDefinitions(): OpenAiToolDefinition[] {
  return Object.values(READ_ONLY_TOOL_CATALOG).map((tool) => tool.definition);
}
