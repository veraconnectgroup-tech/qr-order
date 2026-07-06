import type { GuestTurnOperationalContext } from "@/lib/denis/cognition/context/assemble-operational-context";

/** `operational_context` pointer — silent unless a station is busy AND the guest is frustrated. */
export function retrieveOperationalContextEvidence(
  ctx: GuestTurnOperationalContext | null | undefined
): string {
  if (!ctx?.correlatedNote) return "";
  return `OPERATIONAL CONTEXT:\n${ctx.correlatedNote}`;
}
