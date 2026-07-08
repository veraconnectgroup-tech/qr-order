import type {
  StationStress,
  VenueOpsBeliefs,
} from "@/lib/denis/venue/ops/types";
import type { GuestFrustration, GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";

/** Minimal order shape needed to compute this guest's own oldest wait — avoids importing the full OrderFact/loop-types surface. */
export type OperationalContextOrder = {
  status: string;
  createdAt: string;
  deliveredAt?: string | null;
};

/**
 * A guest-turn-scoped slice of ADR-048 Part III's target
 * `DenisOperationalContext` — station load + this guest's frustration,
 * correlated into one note instead of two independent lossy summaries
 * (the venue-wide "operating mode" block and the 0-10 experience score
 * already exist separately; this doesn't replace them, it adds the
 * connection neither of them makes on its own).
 */
export type GuestTurnOperationalContext = {
  stations: {
    kitchen: StationStress | null;
    bar: StationStress | null;
  };
  guestFrustration: GuestFrustration | null;
  /** Minutes since this guest's oldest still-open order was created. Null when nothing is outstanding. */
  oldestWaitMinutes: number | null;
  /** Only set when a station is busy AND the guest is frustrated — silent on a calm shift. */
  correlatedNote: string | null;
};

function isStationBusy(station: StationStress | null): station is StationStress {
  return station != null && station.stress !== "normal";
}

const OPEN_ORDER_STATUSES: readonly string[] = [
  "pending_approval",
  "pending",
  "accepted",
  "preparing",
  "ready",
];

function resolveOldestWaitMinutes(
  orders: OperationalContextOrder[],
  nowMs: number
): number | null {
  let oldestMs: number | null = null;
  for (const order of orders) {
    if (order.deliveredAt) continue;
    if (!OPEN_ORDER_STATUSES.includes(order.status)) continue;
    const createdMs = Date.parse(order.createdAt);
    if (Number.isNaN(createdMs)) continue;
    if (oldestMs === null || createdMs < oldestMs) oldestMs = createdMs;
  }
  if (oldestMs === null) return null;
  return Math.max(0, Math.round((nowMs - oldestMs) / 60_000));
}

export function assembleGuestTurnOperationalContext(input: {
  venueOps: VenueOpsBeliefs | null | undefined;
  mental: GuestMentalModel | null | undefined;
  orders?: OperationalContextOrder[] | null;
  nowMs?: number;
}): GuestTurnOperationalContext {
  const stationStress = input.venueOps?.stationStress ?? [];
  const kitchen = stationStress.find((s) => s.station === "kitchen") ?? null;
  const bar = stationStress.find((s) => s.station === "bar") ?? null;

  const frustration = input.mental?.affect.frustration ?? null;
  const guestFrustration =
    frustration && frustration.level !== "none" ? frustration : null;

  const oldestWaitMinutes = resolveOldestWaitMinutes(
    input.orders ?? [],
    input.nowMs ?? Date.now()
  );

  const busyStations = [kitchen, bar].filter(isStationBusy);

  let correlatedNote: string | null = null;
  if (busyStations.length > 0 && guestFrustration) {
    const stationList = busyStations
      .map((station) => `${station.station} (${station.stress})`)
      .join(" and ");
    const waitClause =
      oldestWaitMinutes != null
        ? ` and this guest's oldest open order has been waiting ~${oldestWaitMinutes} min`
        : "";
    correlatedNote =
      `${stationList} ${busyStations.length > 1 ? "are" : "is"} running behind` +
      `${waitClause} while this guest's frustration reads ${guestFrustration.level} — ` +
      "prioritize a brief, honest update over upselling or adding delay.";
  }

  return {
    stations: { kitchen, bar },
    guestFrustration,
    oldestWaitMinutes,
    correlatedNote,
  };
}
