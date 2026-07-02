import type { OrderFact } from "@/lib/denis/loop/types";
import {
  cachedStationAnswerGuestMessage,
  type FreshStationAnswer,
} from "@/lib/denis/stations/station-questions";
import { stationsForOrderItems } from "@/lib/orders/station-states";
import { tForAiGuestLanguage } from "@/lib/ai/guest-language";
import type { TranslationKey } from "@/lib/i18n/translations";

const READY_PLUS = new Set(["ready", "picked_up", "served"]);

export type StationGuestMessageInput = {
  order: OrderFact;
  language: string;
  freshEta?: FreshStationAnswer | null;
};

function stationState(order: OrderFact, station: "kitchen" | "bar") {
  return order.stationStates?.find((row) => row.station === station);
}

function activeStationStates(order: OrderFact): NonNullable<OrderFact["stationStates"]> {
  const stations = stationsForOrderItems(
    order.items.map((item) => ({ menu_section: item.menuSection }))
  );
  return (order.stationStates ?? []).filter(
    (row) => stations.has(row.station) && row.status !== "cancelled"
  );
}

function allStationsReadyPlus(states: NonNullable<OrderFact["stationStates"]>): boolean {
  return (
    states.length > 0 &&
    states.every((row) => READY_PLUS.has(row.status))
  );
}

/** Truth contract guest order status — testable pure builder (ADR-043 S3). */
export function buildStationAwareOrderStatusMessage(
  input: StationGuestMessageInput
): string | null {
  const { order, language, freshEta } = input;
  const states = activeStationStates(order);
  if (states.length === 0) return null;

  const number =
    order.orderNumber != null ? String(order.orderNumber) : "?";

  if (freshEta?.answer === "eta" && freshEta.etaMinutes) {
    const etaMessage = cachedStationAnswerGuestMessage({
      fresh: freshEta,
      language,
    });
    if (etaMessage) return etaMessage;
  }

  if (freshEta && freshEta.answer !== "eta") {
    const fromAnswer = cachedStationAnswerGuestMessage({
      fresh: freshEta,
      language,
    });
    if (fromAnswer) return fromAnswer;
  }

  if (allStationsReadyPlus(states)) {
    return tForAiGuestLanguage("ai.station.guest.allReady", language, {
      number,
    });
  }

  const kitchen = stationState(order, "kitchen");
  const bar = stationState(order, "bar");
  const hasKitchen = states.some((row) => row.station === "kitchen");
  const hasBar = states.some((row) => row.station === "bar");

  if (
    hasBar &&
    hasKitchen &&
    bar &&
    READY_PLUS.has(bar.status) &&
    kitchen &&
    kitchen.status === "in_prep"
  ) {
    return tForAiGuestLanguage(
      "ai.station.guest.barReadyKitchenInPrep",
      language,
      { number }
    );
  }

  if (
    hasBar &&
    hasKitchen &&
    bar &&
    READY_PLUS.has(bar.status) &&
    kitchen &&
    (kitchen.status === "queued" ||
      kitchen.status === "ready" ||
      kitchen.status === "picked_up")
  ) {
    if (kitchen.status === "queued") {
      return tForAiGuestLanguage(
        "ai.station.guest.barReadyKitchenQueued",
        language,
        { number }
      );
    }
  }

  const lines: string[] = [];
  for (const row of states) {
    const key = stationStatusMessageKey(row.station, row.status);
    if (!key) continue;
    lines.push(tForAiGuestLanguage(key, language, { number }));
  }

  if (lines.length === 0) return null;
  if (lines.length === 1) return lines[0]!;
  return lines.join(" ");
}

function stationStatusMessageKey(
  station: "kitchen" | "bar",
  status: string
): TranslationKey | null {
  if (status === "queued") {
    return station === "kitchen"
      ? "ai.station.guest.queued.kitchen"
      : "ai.station.guest.queued.bar";
  }
  if (status === "in_prep") {
    return station === "kitchen"
      ? "ai.station.guest.inPrep.kitchen"
      : "ai.station.guest.inPrep.bar";
  }
  if (status === "ready" || status === "picked_up") {
    return station === "kitchen"
      ? "ai.station.guest.ready.kitchen"
      : "ai.station.guest.ready.bar";
  }
  if (status === "served") {
    return station === "kitchen"
      ? "ai.station.guest.served.kitchen"
      : "ai.station.guest.served.bar";
  }
  return null;
}

/** Guard: message must not contain minute counts unless from fresh station ETA. */
export function messageContainsInventedEta(message: string): boolean {
  return /\b\d+\s*(min|minute|minut)\b/i.test(message);
}
