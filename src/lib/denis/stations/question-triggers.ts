import type { ConciergeStationQuestions } from "@/lib/denis/config/concierge-config.schema";

export type StationQuestionStation = "kitchen" | "bar";

export type StationQuestionType =
  | "eta"
  | "pending_accept"
  | "ready_pickup"
  | "mixed_conflict";

export type StationQuestionSourceEvent =
  | "guest_ask"
  | "sla_breach"
  | "sla_approaching"
  | "manager"
  | "mixed_conflict"
  | "pending_too_long"
  | "ready_not_picked";

export type StationOrderState = {
  status: string;
  readyAt: string | null;
  pickedUpAt: string | null;
};

export type StationTriggerOrder = {
  id: string;
  orderNumber: number | null;
  status: string;
  createdAt: string;
  preparingAt: string | null;
  readyAt: string | null;
  hasKitchenItems: boolean;
  hasDrinkItems: boolean;
  kitchenStation?: StationOrderState | null;
  barStation?: StationOrderState | null;
};

export type StationQuestionCandidate = {
  orderId: string;
  orderNumber: number | null;
  station: StationQuestionStation;
  questionType: StationQuestionType;
  sourceEvent: StationQuestionSourceEvent;
  waitMinutes: number;
};

function minutesSince(iso: string | null, now: number): number {
  if (!iso) return 0;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return 0;
  return Math.floor((now - ts) / 60_000);
}

/** Which station Denis asks about this order (kitchen wins for mixed orders). */
export function stationForOrder(order: {
  hasKitchenItems: boolean;
  hasDrinkItems: boolean;
}): StationQuestionStation {
  return order.hasKitchenItems ? "kitchen" : "bar";
}

/**
 * ADR-053 M5 — the pre-warn gap must exceed cooldownMinutes, or the
 * pre-warn question's own cooldown could still be active when the real
 * SLA breach should fire, silently swallowing it. Clamped here rather
 * than at the schema level so a saved config can't end up in a state
 * where the two features fight each other.
 *
 * Known tuning edge case: with a tight drinkSlaMinutes (default 4) close
 * to or below cooldownMinutes+1 (default 5), the clamp can make the
 * pre-warn window cover the entire pre-breach period for drink orders —
 * i.e. pre-warn fires immediately instead of shortly before the SLA. A
 * location enabling this for bar should raise drinkSlaMinutes or lower
 * cooldownMinutes if that's not the feel they want.
 */
export function resolveSlaPreWarnGapMinutes(
  config: Pick<ConciergeStationQuestions, "slaPreWarnMinutes" | "cooldownMinutes">
): number {
  return Math.max(config.slaPreWarnMinutes, config.cooldownMinutes + 1);
}

function isApproachingSla(
  waitMinutes: number,
  slaMinutes: number,
  preWarnGapMinutes: number
): boolean {
  return (
    waitMinutes >= slaMinutes - preWarnGapMinutes && waitMinutes < slaMinutes
  );
}

/** Skip watcher questions when station status already answers them (ADR-043 S3). */
export function shouldSkipStationQuestionCandidate(
  candidate: Pick<StationQuestionCandidate, "questionType" | "station">,
  order: StationTriggerOrder
): boolean {
  const state =
    candidate.station === "kitchen"
      ? order.kitchenStation
      : order.barStation;
  if (!state) return false;

  switch (candidate.questionType) {
    case "eta":
    case "pending_accept":
      return ["in_prep", "ready", "picked_up", "served"].includes(
        state.status
      );
    case "ready_pickup":
      return ["picked_up", "served"].includes(state.status);
    case "mixed_conflict":
      if (candidate.station === "bar") {
        return !["queued", "in_prep"].includes(state.status);
      }
      return false;
    default:
      return false;
  }
}

function pushCandidate(
  candidates: StationQuestionCandidate[],
  order: StationTriggerOrder,
  candidate: StationQuestionCandidate
): void {
  if (shouldSkipStationQuestionCandidate(candidate, order)) return;
  candidates.push(candidate);
}

function pushReadyPickupCandidates(input: {
  order: StationTriggerOrder;
  config: ConciergeStationQuestions;
  now: number;
  candidates: StationQuestionCandidate[];
}): void {
  const { order, config, now, candidates } = input;

  for (const station of ["kitchen", "bar"] as const) {
    const hasItems =
      station === "kitchen" ? order.hasKitchenItems : order.hasDrinkItems;
    if (!hasItems) continue;

    const state =
      station === "kitchen" ? order.kitchenStation : order.barStation;
    if (!state || state.status !== "ready" || state.pickedUpAt) continue;

    const wait = minutesSince(
      state.readyAt ?? order.readyAt ?? order.createdAt,
      now
    );
    if (wait < config.readyPickupMinutes) continue;

    pushCandidate(candidates, order, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      station,
      questionType: "ready_pickup",
      sourceEvent: "ready_not_picked",
      waitMinutes: wait,
    });
  }
}

/**
 * Watcher trigger rules (T2 SLA / T4 mixed / T5 pending / T6 ready-not-picked).
 * Pure — anti-spam (open/cooldown/cap) is enforced at create time.
 */
export function evaluateStationQuestionTriggers(input: {
  orders: StationTriggerOrder[];
  config: ConciergeStationQuestions;
  now?: number;
}): StationQuestionCandidate[] {
  const now = input.now ?? Date.now();
  const candidates: StationQuestionCandidate[] = [];

  for (const order of input.orders) {
    if (!order.hasKitchenItems && !order.hasDrinkItems) continue;

    if (order.status === "pending" || order.status === "pending_approval") {
      const wait = minutesSince(order.createdAt, now);
      if (wait >= input.config.pendingAcceptMinutes) {
        pushCandidate(candidates, order, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          station: stationForOrder(order),
          questionType: "pending_accept",
          sourceEvent: "pending_too_long",
          waitMinutes: wait,
        });
      }
      continue;
    }

    if (order.status === "accepted" || order.status === "preparing") {
      const wait = minutesSince(order.createdAt, now);

      if (order.hasKitchenItems && wait >= input.config.foodSlaMinutes) {
        pushCandidate(candidates, order, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          station: "kitchen",
          questionType: "eta",
          sourceEvent: "sla_breach",
          waitMinutes: wait,
        });
        pushReadyPickupCandidates({ order, config: input.config, now, candidates });
        continue;
      }

      // Pre-warn only for a plain kitchen order — mixed orders keep the
      // existing mixed_conflict handling below unchanged, kept narrow on
      // purpose rather than layering pre-warn onto that already-subtle case.
      if (
        input.config.slaPreWarnEnabled &&
        order.hasKitchenItems &&
        !order.hasDrinkItems &&
        isApproachingSla(
          wait,
          input.config.foodSlaMinutes,
          resolveSlaPreWarnGapMinutes(input.config)
        )
      ) {
        pushCandidate(candidates, order, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          station: "kitchen",
          questionType: "eta",
          sourceEvent: "sla_approaching",
          waitMinutes: wait,
        });
      }

      if (order.hasDrinkItems && wait >= input.config.drinkSlaMinutes) {
        if (order.hasKitchenItems) {
          const barStatus = order.barStation?.status;
          if (
            !barStatus ||
            barStatus === "queued" ||
            barStatus === "in_prep"
          ) {
            pushCandidate(candidates, order, {
              orderId: order.id,
              orderNumber: order.orderNumber,
              station: "bar",
              questionType: "mixed_conflict",
              sourceEvent: "mixed_conflict",
              waitMinutes: wait,
            });
          }
        } else {
          pushCandidate(candidates, order, {
            orderId: order.id,
            orderNumber: order.orderNumber,
            station: "bar",
            questionType: "eta",
            sourceEvent: "sla_breach",
            waitMinutes: wait,
          });
        }
      } else if (
        input.config.slaPreWarnEnabled &&
        order.hasDrinkItems &&
        !order.hasKitchenItems &&
        isApproachingSla(
          wait,
          input.config.drinkSlaMinutes,
          resolveSlaPreWarnGapMinutes(input.config)
        )
      ) {
        pushCandidate(candidates, order, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          station: "bar",
          questionType: "eta",
          sourceEvent: "sla_approaching",
          waitMinutes: wait,
        });
      }

      pushReadyPickupCandidates({ order, config: input.config, now, candidates });
      continue;
    }

    if (order.status === "ready") {
      const hasStationStates = order.kitchenStation || order.barStation;
      if (hasStationStates) {
        pushReadyPickupCandidates({ order, config: input.config, now, candidates });
      } else {
        const wait = minutesSince(order.readyAt ?? order.createdAt, now);
        if (wait >= input.config.readyPickupMinutes) {
          pushCandidate(candidates, order, {
            orderId: order.id,
            orderNumber: order.orderNumber,
            station: stationForOrder(order),
            questionType: "ready_pickup",
            sourceEvent: "ready_not_picked",
            waitMinutes: wait,
          });
        }
      }
    }
  }

  return candidates;
}

const STATION_LABEL_SR: Record<StationQuestionStation, string> = {
  kitchen: "kuhinju",
  bar: "bar",
};

/** Staff-facing card copy (Serbian, matching KDS/bar surfaces). */
export function buildStationQuestionMessage(input: {
  questionType: StationQuestionType;
  station: StationQuestionStation;
  tableName: string;
  orderNumber: number | null;
  waitMinutes: number;
  sourceEvent?: StationQuestionSourceEvent;
}): string {
  const bon = input.orderNumber != null ? `Bon #${input.orderNumber}` : "Bon";
  const table = `Sto ${input.tableName}`;

  // ADR-053 M5 — same "eta" question type as a real breach, deliberately
  // softer tone: a heads-up before the SLA is blown reads very differently
  // out loud than "you're already late."
  if (input.questionType === "eta" && input.sourceEvent === "sla_approaching") {
    return `${table} · ${bon} — gost čeka ${input.waitMinutes} min, bliži se rok. Koliko još treba?`;
  }

  switch (input.questionType) {
    case "pending_accept":
      return `${table} · ${bon} čeka ${input.waitMinutes} min bez prihvatanja. Kreće li priprema?`;
    case "ready_pickup":
      return `${table} · ${bon} je spreman ${input.waitMinutes} min. Da li je preuzet?`;
    case "mixed_conflict":
      return `${table} čeka piće ${input.waitMinutes} min (hrana se sprema). Da li je piće izašlo?`;
    case "eta":
      return `${table} · ${bon} — gost čeka ${input.waitMinutes} min. Kada je gotovo?`;
  }
}

/** Who is Denis asking — used in strip header. */
export function stationQuestionAskLabel(station: StationQuestionStation): string {
  return `Denis pita ${STATION_LABEL_SR[station]}`;
}
