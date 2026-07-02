import {
  aiOrderStatusMessageKey,
  shouldNotifyStatusChange,
} from "@/lib/ai/status/status-templates";
import { t, type MenuLocale } from "@/lib/i18n/translations";
import type { SceneMarkState } from "@/lib/scene/types";

export type CommerceWorldSignalKind =
  | "commerce.order_created"
  | "commerce.order_status"
  | "commerce.product_unavailable";

export type WorldStationTell = {
  station: "kitchen" | "bar";
};

export type WorldProductTell = {
  productId: string;
  productName: string;
  message: string;
};

export type WorldOrderTellResult = {
  message: string;
  markState: SceneMarkState;
  push: boolean;
  persistTell: boolean;
};

function resolveStatusForSignal(
  signal: CommerceWorldSignalKind,
  status: string
): string {
  if (signal === "commerce.order_created") return "pending";
  return status;
}

function markStateForStatus(status: string): SceneMarkState {
  if (status === "ready") return "listen";
  if (status === "preparing") return "think";
  return "idle";
}

function resolveStationReadyTell(input: {
  stationTell: WorldStationTell;
  orderNumber: number;
  menuLocale: MenuLocale;
  isEnglish?: boolean;
}): WorldOrderTellResult | null {
  const messageKey =
    input.stationTell.station === "bar"
      ? "ai.station.readyAnswer.bar"
      : "ai.station.readyAnswer.kitchen";

  const message = t(messageKey, input.menuLocale, input.isEnglish ?? false, {
    number: String(input.orderNumber),
  });

  return {
    message,
    markState: "listen",
    push: true,
    persistTell: true,
  };
}

function resolveProductUnavailableTell(input: {
  productTell: WorldProductTell;
}): WorldOrderTellResult {
  return {
    message: input.productTell.message,
    markState: "listen",
    push: true,
    persistTell: true,
  };
}

/** Template TELL for commerce world signals — single source for headline/transcript/push (Phase D). */
export function resolveWorldOrderTell(input: {
  signal: CommerceWorldSignalKind;
  status: string;
  previousStatus?: string;
  orderNumber: number;
  menuLocale: MenuLocale;
  isEnglish?: boolean;
  orders?: unknown[];
  stationTell?: WorldStationTell;
  productTell?: WorldProductTell;
}): WorldOrderTellResult | null {
  if (input.productTell) {
    return resolveProductUnavailableTell({ productTell: input.productTell });
  }

  if (input.stationTell) {
    return resolveStationReadyTell({
      stationTell: input.stationTell,
      orderNumber: input.orderNumber,
      menuLocale: input.menuLocale,
      isEnglish: input.isEnglish,
    });
  }

  const effectiveStatus = resolveStatusForSignal(input.signal, input.status);

  if (
    input.signal === "commerce.order_status" &&
    !shouldNotifyStatusChange(input.previousStatus, effectiveStatus)
  ) {
    return null;
  }

  const messageKey = aiOrderStatusMessageKey(effectiveStatus);
  if (!messageKey) return null;

  const message = t(
    messageKey,
    input.menuLocale,
    input.isEnglish ?? false,
    { number: String(input.orderNumber) }
  );

  return {
    message,
    markState: markStateForStatus(effectiveStatus),
    push: effectiveStatus === "ready",
    persistTell: effectiveStatus === "ready",
  };
}
