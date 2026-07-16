import type {
  OpsPlannerEffects,
  VenueOpsBeliefs,
} from "@/lib/denis/venue/ops/types";

/** `venue.ops` pointer — rush, KDS stress, staff hints. */
export function retrieveVenueOpsEvidence(
  ops: VenueOpsBeliefs | null | undefined,
  effects: OpsPlannerEffects | null | undefined
): string {
  if (!ops) return "";

  const lines: string[] = [
    `Operating mode: ${ops.operatingMode}`,
    `KDS stress: ${ops.kdsStress}`,
    `Accepting orders: ${ops.acceptingOrders ? "yes" : "no"}`,
  ];

  if (effects?.empathyNote) {
    lines.push(`Kitchen note: ${effects.empathyNote}`);
  }

  if (effects?.guestSafeStaffHint) {
    lines.push(`Staff hint: ${effects.guestSafeStaffHint}`);
  }

  if (ops.staffHint?.visibility === "guest_safe") {
    lines.push(`Table hint: ${ops.staffHint.text}`);
  }

  if (ops.delayNote) {
    lines.push(
      `Announced delay: ${ops.delayNote.area} is running ~${ops.delayNote.minutes} min behind (staff announced this out loud). If the guest has or wants affected items, give them the real timeline honestly — no empty reassurance.`
    );
  }

  if (ops.staffOnFloor != null) {
    lines.push(`Staff on floor: ${ops.staffOnFloor}`);
  }

  return `VENUE OPS:\n${lines.join("\n")}`;
}
