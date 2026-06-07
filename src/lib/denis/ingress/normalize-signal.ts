import { chipIdToHandoff } from "@/lib/denis/commands/perceive-table-guest-command";
import type {
  DenisSignalRequest,
  NormalizeDenisSignalResult,
  NormalizedDenisSignal,
} from "@/lib/denis/ingress/signal-types";
import { denisSignalRequestSchema } from "@/lib/denis/ingress/signal-types";
import type { GuestIntent } from "@/lib/denis/platform/timeline-types";
import type { DenisSenseChannel } from "@/lib/denis/platform/sense-types";

const WAITER_CHIP_IDS = ["situation-waiter"] as const;

function isWaiterChipId(chipId: string): boolean {
  return (WAITER_CHIP_IDS as readonly string[]).includes(chipId);
}

function resolveHandoffFromChip(
  request: Extract<DenisSignalRequest, { type: "chip" }>
): {
  structuredIntent?: GuestIntent;
  handoffPaymentMethod?: "online" | "at_bar" | "card_at_table";
} {
  if (request.structuredIntent || request.handoffPaymentMethod) {
    return {
      structuredIntent: request.structuredIntent,
      handoffPaymentMethod: request.handoffPaymentMethod,
    };
  }
  const mapped = chipIdToHandoff({
    chipId: request.chipId,
    label: request.label,
  });
  return {
    structuredIntent: mapped?.structuredIntent,
    handoffPaymentMethod: mapped?.paymentMethod,
  };
}

function isHandoffOnlySignal(
  request: DenisSignalRequest,
  structuredIntent?: GuestIntent,
  handoffPaymentMethod?: "online" | "at_bar" | "card_at_table"
): boolean {
  if (structuredIntent === "HANDOFF_WAITER") return true;
  if (structuredIntent === "HANDOFF_PAY" && handoffPaymentMethod) return true;
  if (request.type === "chip" && isWaiterChipId(request.chipId)) {
    return true;
  }
  return false;
}

function telemetryToSenseChannel(
  kind: Extract<DenisSignalRequest, { type: "telemetry" }>["kind"]
): DenisSenseChannel {
  switch (kind) {
    case "cart":
      return "telemetry.manual_cart";
    case "scroll":
      return "telemetry.scroll";
    case "proactive_tick":
      return "system.proactive_tick";
    case "dwell":
      return "telemetry.scroll";
    case "browse":
      return "telemetry.browse";
  }
}

/** Validate guest ingress and pick runtime route (ADR-019 Phase C). */
export function normalizeDenisSignal(raw: unknown): NormalizeDenisSignalResult {
  const parsed = denisSignalRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid_signal" };
  }

  const request = parsed.data;

  if (request.type === "telemetry") {
    const signal: NormalizedDenisSignal = {
      route: "sense",
      request,
      channel: "chat",
      senseChannel: telemetryToSenseChannel(request.kind),
    };
    return { ok: true, signal };
  }

  if (request.type === "message") {
    const structuredIntent = request.structuredIntent;
    const handoffPaymentMethod = request.handoffPaymentMethod;
    const route = isHandoffOnlySignal(
      request,
      structuredIntent,
      handoffPaymentMethod
    )
      ? "handoff"
      : "turn";
    const signal: NormalizedDenisSignal = {
      route,
      request,
      channel: request.surface === "voice" ? "voice" : "chat",
      structuredIntent,
      handoffPaymentMethod,
    };
    return { ok: true, signal };
  }

  const handoff = resolveHandoffFromChip(request);
  const route = isHandoffOnlySignal(
    request,
    handoff.structuredIntent,
    handoff.handoffPaymentMethod
  )
    ? "handoff"
    : "turn";
  const signal: NormalizedDenisSignal = {
    route,
    request,
    channel: "chat",
    structuredIntent: handoff.structuredIntent,
    handoffPaymentMethod: handoff.handoffPaymentMethod,
  };
  return { ok: true, signal };
}
