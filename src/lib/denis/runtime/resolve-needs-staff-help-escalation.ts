/**
 * Founder's "find a way" directive — pure decision extracted out of
 * run-denis-turn.ts's giant orchestration function so the actual gate
 * logic is directly unit-testable without mocking the whole turn.
 */
export function shouldEscalateNeedsStaffHelp(input: {
  needsStaffHelp: string | null | undefined;
  handoffCommandType: string | null | undefined;
  waiterCallEnabled: boolean;
  liveExecutionEnabled: boolean;
  tableId: string | null | undefined;
  locationId: string | null | undefined;
}): boolean {
  return Boolean(
    input.needsStaffHelp &&
      // T0 already fired a real WAITER.REQUEST this same turn — its own
      // free-text reason already covers it, don't double-insert.
      input.handoffCommandType !== "WAITER.REQUEST" &&
      input.waiterCallEnabled &&
      input.liveExecutionEnabled &&
      input.tableId &&
      input.locationId
  );
}

export const NEEDS_STAFF_HELP_FAILURE_MESSAGE =
  "Razumem — nisam uspeo automatski da javim osoblju, ali pokušajte dugme za pozivanje konobara ili pitajte kad prođe pored stola.";
