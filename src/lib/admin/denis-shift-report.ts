import {
  isServiceRecoveryNotificationMessage,
} from "@/lib/denis/cognition/recovery/build-service-recovery-alert";
import { turnaroundMinutesBetween } from "@/lib/denis/cognition/waiter/bus-table-obligation";

export type DenisShiftQuestionRow = {
  station: "kitchen" | "bar";
  status: string;
  asked_at: string;
  answered_at: string | null;
  expires_at: string;
  table_id: string | null;
  order_id: string | null;
};

export type DenisShiftNotificationRow = {
  type: string;
  priority: string;
  table_id: string | null;
  created_at: string;
  message?: string;
  read_at?: string | null;
};

export type DenisShiftWaiterCallRow = {
  table_id: string;
  created_at: string;
};

export type DenisShiftStationStateRow = {
  station: "kitchen" | "bar";
  in_prep_at: string | null;
  ready_at: string | null;
};

export type DenisShiftStationQuestionStats = {
  station: "kitchen" | "bar";
  asked: number;
  answered: number;
  expired: number;
  avgAnswerMinutes: number | null;
};

export type DenisShiftEscalationCounts = {
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  total: number;
};

export type DenisShiftRiskTable = {
  tableId: string;
  tableName: string;
  questionCount: number;
  escalationCount: number;
  waiterCallCount: number;
  riskScore: number;
};

export type DenisShiftStationDelay = {
  station: "kitchen" | "bar";
  avgPrepMinutes: number | null;
  sampleCount: number;
};

export type DenisShiftEightySixEvent = {
  productName: string;
  at: string;
};

export type DenisShiftDessertWindowStats = {
  proposed: number;
  accepted: number;
  declined: number;
  valueEuros: number;
};

export type DenisShiftReturningGuestStats = {
  /** Unique returning guests recognized today (visit_count > 1). */
  recognizedToday: number;
  /** Sum of order totals from their sessions today. */
  returningSpendTotal: number;
  /** Average spend per recognized returning guest today. */
  returningAvgSpend: number;
  /** Venue average order value today (comparison baseline). */
  venueAvgSpend: number;
};

export type DenisShiftServiceRecoveryStats = {
  casesOpened: number;
  resolved: number;
  unresolved: number;
  avgManagerResponseMinutes: number | null;
};

export type DenisShiftBusObligationRow = {
  table_id: string;
  paid_at: string;
  bussed_at: string | null;
  status: string;
};

export type DenisShiftTableTurnaroundStats = {
  bussedCount: number;
  avgTurnaroundMinutes: number | null;
  worstTableId: string | null;
  worstTableName: string | null;
  worstTurnaroundMinutes: number | null;
  openAtClose: number;
};

export type DenisShiftRecap = {
  stationQuestions: DenisShiftStationQuestionStats[];
  escalations: DenisShiftEscalationCounts;
  riskiestTable: DenisShiftRiskTable | null;
  stationDelays: DenisShiftStationDelay[];
  preventedProblems: number;
  eightySixEvents: DenisShiftEightySixEvent[];
  dessertWindow: DenisShiftDessertWindowStats;
  returningGuests: DenisShiftReturningGuestStats;
  serviceRecovery: DenisShiftServiceRecoveryStats;
  tableTurnaround: DenisShiftTableTurnaroundStats;
};

export type BuildDenisShiftRecapInput = {
  stationQuestions: DenisShiftQuestionRow[];
  staffNotifications: DenisShiftNotificationRow[];
  waiterCalls: DenisShiftWaiterCallRow[];
  stationStates: DenisShiftStationStateRow[];
  tableNames: Record<string, string>;
  kitchenFallbackPrepMinutes: number | null;
  eightySixEvents?: DenisShiftEightySixEvent[];
  dessertWindow?: DenisShiftDessertWindowStats;
  returningGuests?: DenisShiftReturningGuestStats;
  serviceRecovery?: DenisShiftServiceRecoveryStats;
  busObligations?: DenisShiftBusObligationRow[];
};

const STATIONS: Array<"kitchen" | "bar"> = ["kitchen", "bar"];

function minutesBetween(startIso: string, endIso: string): number | null {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  return Math.round((end - start) / 60_000);
}

function roundAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length
  );
}

export function aggregateStationQuestionStats(
  rows: DenisShiftQuestionRow[]
): DenisShiftStationQuestionStats[] {
  return STATIONS.map((station) => {
    const stationRows = rows.filter((row) => row.station === station);
    const answeredRows = stationRows.filter(
      (row) => row.status === "answered" && row.answered_at
    );
    const answerMinutes = answeredRows
      .map((row) => minutesBetween(row.asked_at, row.answered_at!))
      .filter((value): value is number => value != null);

    return {
      station,
      asked: stationRows.length,
      answered: answeredRows.length,
      expired: stationRows.filter((row) => row.status === "expired").length,
      avgAnswerMinutes: roundAverage(answerMinutes),
    };
  });
}

export function aggregateEscalationCounts(
  rows: DenisShiftNotificationRow[]
): DenisShiftEscalationCounts {
  const byType: Record<string, number> = {};
  const byPriority: Record<string, number> = {};

  for (const row of rows) {
    byType[row.type] = (byType[row.type] ?? 0) + 1;
    byPriority[row.priority] = (byPriority[row.priority] ?? 0) + 1;
  }

  return {
    byType,
    byPriority,
    total: rows.length,
  };
}

export function aggregateStationDelays(input: {
  stationStates: DenisShiftStationStateRow[];
  kitchenFallbackPrepMinutes: number | null;
}): DenisShiftStationDelay[] {
  return STATIONS.map((station) => {
    const durations = input.stationStates
      .filter(
        (row) =>
          row.station === station && row.in_prep_at && row.ready_at
      )
      .map((row) => minutesBetween(row.in_prep_at!, row.ready_at!))
      .filter((value): value is number => value != null);

    if (durations.length > 0) {
      return {
        station,
        avgPrepMinutes: roundAverage(durations),
        sampleCount: durations.length,
      };
    }

    if (station === "kitchen" && input.kitchenFallbackPrepMinutes != null) {
      return {
        station,
        avgPrepMinutes: input.kitchenFallbackPrepMinutes,
        sampleCount: 0,
      };
    }

    return {
      station,
      avgPrepMinutes: null,
      sampleCount: 0,
    };
  });
}

export function findRiskiestTable(input: {
  stationQuestions: DenisShiftQuestionRow[];
  staffNotifications: DenisShiftNotificationRow[];
  waiterCalls: DenisShiftWaiterCallRow[];
  tableNames: Record<string, string>;
}): DenisShiftRiskTable | null {
  const scores = new Map<
    string,
    { questionCount: number; escalationCount: number; waiterCallCount: number }
  >();

  function bump(
    tableId: string | null | undefined,
    field: "questionCount" | "escalationCount" | "waiterCallCount"
  ) {
    if (!tableId) return;
    const current = scores.get(tableId) ?? {
      questionCount: 0,
      escalationCount: 0,
      waiterCallCount: 0,
    };
    current[field] += 1;
    scores.set(tableId, current);
  }

  for (const row of input.stationQuestions) {
    bump(row.table_id, "questionCount");
  }

  for (const row of input.staffNotifications) {
    bump(row.table_id, "escalationCount");
  }

  for (const row of input.waiterCalls) {
    bump(row.table_id, "waiterCallCount");
  }

  let best: DenisShiftRiskTable | null = null;

  for (const [tableId, counts] of scores) {
    const riskScore =
      counts.questionCount * 2 +
      counts.escalationCount * 3 +
      counts.waiterCallCount;
    if (!best || riskScore > best.riskScore) {
      best = {
        tableId,
        tableName: input.tableNames[tableId] ?? `Sto ${tableId.slice(0, 6)}`,
        questionCount: counts.questionCount,
        escalationCount: counts.escalationCount,
        waiterCallCount: counts.waiterCallCount,
        riskScore,
      };
    }
  }

  return best;
}

/**
 * Heuristic (ADR-043 S6): a station question counts as "prevented" when staff
 * answered before expiry — Denis got truth in time, so the guest did not need
 * a repeat ask and the S0 expiry escalation did not fire for that card.
 * Does not attempt to detect duplicate guest utterances (no guest transcript join).
 */
export function countPreventedProblems(rows: DenisShiftQuestionRow[]): number {
  return rows.filter((row) => {
    if (row.status !== "answered" || !row.answered_at) return false;
    const answeredAt = Date.parse(row.answered_at);
    const expiresAt = Date.parse(row.expires_at);
    return (
      Number.isFinite(answeredAt) &&
      Number.isFinite(expiresAt) &&
      answeredAt <= expiresAt
    );
  }).length;
}

export function aggregateDessertWindowStats(input: {
  byNudgeKind?: Record<string, number>;
  byOutcome?: Record<string, number>;
  valueEuros?: number;
}): DenisShiftDessertWindowStats {
  const byKind = input.byNudgeKind ?? {};
  const byOutcome = input.byOutcome ?? {};
  const proposed =
    (byKind.dessert_nudge ?? 0) +
    (byKind.coffee_nudge ?? 0) +
    (byKind.digestif_nudge ?? 0);

  return {
    proposed,
    accepted: byOutcome.accepted ?? 0,
    declined: byOutcome.declined ?? 0,
    valueEuros: input.valueEuros ?? 0,
  };
}

/** ADR-043 S11 — returning guest spend vs venue average for shift recap. */
export function aggregateReturningGuestStats(input: {
  orders: Array<{ session_id: string | null; total: number }>;
  sessions: Array<{ id: string; guest_token: string | null }>;
  visitCountByToken: Record<string, number>;
}): DenisShiftReturningGuestStats {
  const sessionById = new Map(input.sessions.map((row) => [row.id, row]));
  const returningTokens = new Set<string>();
  for (const [token, visits] of Object.entries(input.visitCountByToken)) {
    if (visits > 1) returningTokens.add(token);
  }

  const seenTokens = new Set<string>();
  let recognizedToday = 0;
  for (const session of input.sessions) {
    const token = session.guest_token?.trim();
    if (!token || !returningTokens.has(token) || seenTokens.has(token)) continue;
    seenTokens.add(token);
    recognizedToday += 1;
  }

  let returningSpendTotal = 0;
  for (const order of input.orders) {
    if (!order.session_id) continue;
    const session = sessionById.get(order.session_id);
    const token = session?.guest_token?.trim();
    if (!token || !returningTokens.has(token)) continue;
    returningSpendTotal += Number(order.total) || 0;
  }

  const venueOrderCount = input.orders.length;
  const venueSpendTotal = input.orders.reduce(
    (sum, order) => sum + (Number(order.total) || 0),
    0
  );
  const venueAvgSpend =
    venueOrderCount > 0 ? venueSpendTotal / venueOrderCount : 0;
  const returningAvgSpend =
    recognizedToday > 0 ? returningSpendTotal / recognizedToday : 0;

  return {
    recognizedToday,
    returningSpendTotal,
    returningAvgSpend,
    venueAvgSpend,
  };
}

/** ADR-043 S12 — service recovery cases from staff notifications (Recovery — prefix). */
export function aggregateServiceRecoveryStats(
  rows: DenisShiftNotificationRow[]
): DenisShiftServiceRecoveryStats {
  const recoveryRows = rows.filter((row) =>
    isServiceRecoveryNotificationMessage(row.message ?? "")
  );

  const responseMinutes: number[] = [];
  let resolved = 0;
  let unresolved = 0;

  for (const row of recoveryRows) {
    if (row.read_at) {
      resolved += 1;
      const minutes = minutesBetween(row.created_at, row.read_at);
      if (minutes != null) responseMinutes.push(minutes);
    } else {
      unresolved += 1;
    }
  }

  return {
    casesOpened: recoveryRows.length,
    resolved,
    unresolved,
    avgManagerResponseMinutes: roundAverage(responseMinutes),
  };
}

/** ADR-043 S13 — paid_at → bussed_at turnaround for shift recap. */
export function aggregateTableTurnaroundStats(input: {
  rows: DenisShiftBusObligationRow[];
  tableNames: Record<string, string>;
}): DenisShiftTableTurnaroundStats {
  const turnaroundMinutes: number[] = [];
  let worstTableId: string | null = null;
  let worstMinutes: number | null = null;
  let openAtClose = 0;

  for (const row of input.rows) {
    if (row.status === "open") {
      openAtClose += 1;
      continue;
    }
    if (row.status !== "bussed" || !row.bussed_at) continue;

    const minutes = turnaroundMinutesBetween(row.paid_at, row.bussed_at);
    if (minutes == null) continue;
    turnaroundMinutes.push(minutes);
    if (worstMinutes == null || minutes > worstMinutes) {
      worstMinutes = minutes;
      worstTableId = row.table_id;
    }
  }

  return {
    bussedCount: turnaroundMinutes.length,
    avgTurnaroundMinutes: roundAverage(turnaroundMinutes),
    worstTableId,
    worstTableName:
      worstTableId != null
        ? (input.tableNames[worstTableId] ?? worstTableId)
        : null,
    worstTurnaroundMinutes: worstMinutes,
    openAtClose,
  };
}

export function buildDenisShiftRecap(
  input: BuildDenisShiftRecapInput
): DenisShiftRecap {
  return {
    stationQuestions: aggregateStationQuestionStats(input.stationQuestions),
    escalations: aggregateEscalationCounts(input.staffNotifications),
    riskiestTable: findRiskiestTable({
      stationQuestions: input.stationQuestions,
      staffNotifications: input.staffNotifications,
      waiterCalls: input.waiterCalls,
      tableNames: input.tableNames,
    }),
    stationDelays: aggregateStationDelays({
      stationStates: input.stationStates,
      kitchenFallbackPrepMinutes: input.kitchenFallbackPrepMinutes,
    }),
    preventedProblems: countPreventedProblems(input.stationQuestions),
    eightySixEvents: input.eightySixEvents ?? [],
    dessertWindow:
      input.dessertWindow ??
      aggregateDessertWindowStats({ byNudgeKind: {}, byOutcome: {} }),
    returningGuests:
      input.returningGuests ??
      aggregateReturningGuestStats({
        orders: [],
        sessions: [],
        visitCountByToken: {},
      }),
    serviceRecovery:
      input.serviceRecovery ??
      aggregateServiceRecoveryStats(input.staffNotifications),
    tableTurnaround: aggregateTableTurnaroundStats({
      rows: input.busObligations ?? [],
      tableNames: input.tableNames,
    }),
  };
}

export function emptyDenisShiftRecap(
  kitchenFallbackPrepMinutes: number | null = null
): DenisShiftRecap {
  return buildDenisShiftRecap({
    stationQuestions: [],
    staffNotifications: [],
    waiterCalls: [],
    stationStates: [],
    tableNames: {},
    kitchenFallbackPrepMinutes,
  });
}
