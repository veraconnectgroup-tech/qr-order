import type {
  StationStress,
  VenueOpsBeliefs,
} from "@/lib/denis/venue/ops/types";
import type { GuestFrustration, GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";

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
  /** Only set when a station is busy AND the guest is frustrated — silent on a calm shift. */
  correlatedNote: string | null;
};

function isStationBusy(station: StationStress | null): station is StationStress {
  return station != null && station.stress !== "normal";
}

export function assembleGuestTurnOperationalContext(input: {
  venueOps: VenueOpsBeliefs | null | undefined;
  mental: GuestMentalModel | null | undefined;
}): GuestTurnOperationalContext {
  const stationStress = input.venueOps?.stationStress ?? [];
  const kitchen = stationStress.find((s) => s.station === "kitchen") ?? null;
  const bar = stationStress.find((s) => s.station === "bar") ?? null;

  const frustration = input.mental?.affect.frustration ?? null;
  const guestFrustration =
    frustration && frustration.level !== "none" ? frustration : null;

  const busyStations = [kitchen, bar].filter(isStationBusy);

  let correlatedNote: string | null = null;
  if (busyStations.length > 0 && guestFrustration) {
    const stationList = busyStations
      .map((station) => `${station.station} (${station.stress})`)
      .join(" and ");
    correlatedNote =
      `${stationList} ${busyStations.length > 1 ? "are" : "is"} running behind ` +
      `while this guest's frustration reads ${guestFrustration.level} — ` +
      "prioritize a brief, honest update over upselling or adding delay.";
  }

  return {
    stations: { kitchen, bar },
    guestFrustration,
    correlatedNote,
  };
}
