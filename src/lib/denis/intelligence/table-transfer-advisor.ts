import type { GuestPace } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { TableTurnoverPrediction } from "@/lib/denis/intelligence/table-turnover";

/** Mirrors venue/party/types — kept local to avoid intelligence→venue import. */
type PartyMode = "shared_cart" | "per_device";

export type TransferReason =
  | "group_merge"
  | "better_seat"
  | "capacity_rebalance"
  | "reserved_incoming"
  | "turnover_soon"
  | "waitlist_table_merge";

export type TransferSuggestion = {
  fromTableId: string;
  fromTableName: string;
  toTableId: string;
  toTableName: string;
  reason: TransferReason;
  confidence: number;
  orderIds: string[];
  detail: string;
};

export type TransferTableState = {
  tableId: string;
  tableName: string;
  seats: number;
  hasActiveSession: boolean;
  partySize: number;
  openOrderCount: number;
  seatedMinutes: number | null;
  /** Same party spanning multiple tables — group_merge. */
  partyGroupId?: string | null;
  isWindowSeat?: boolean;
  guestPace?: GuestPace | null;
  isPayingPhase?: boolean;
};

export type TransferOrder = {
  id: string;
  tableId: string;
};

export type TransferReservation = {
  tableId: string;
  partySize: number;
  scheduledAt: string;
};

export type TransferWaitingParty = {
  tableId?: string | null;
  tableName: string;
  partySize: number;
};

export const MAX_TRANSFER_SUGGESTIONS = 2;
export const RESERVATION_HORIZON_MINUTES = 60;
const UNDERUTILIZED_PARTY_MAX = 3;
const LARGE_TABLE_MIN_SEATS = 6;
const TURNOVER_SOON_MIN_SEATED_MINUTES = 75;
const WAITLIST_MERGE_MIN_PARTY = 5;

function tableById(
  tables: TransferTableState[]
): Map<string, TransferTableState> {
  return new Map(tables.map((table) => [table.tableId, table]));
}

function ordersForTable(
  orders: TransferOrder[],
  tableId: string
): TransferOrder[] {
  return orders.filter((order) => order.tableId === tableId);
}

function findFreeTable(input: {
  tables: TransferTableState[];
  minSeats: number;
  maxSeats?: number;
  excludeTableId?: string;
  requireWindow?: boolean;
}): TransferTableState | null {
  const candidates = input.tables
    .filter(
      (table) =>
        !table.hasActiveSession &&
        table.seats >= input.minSeats &&
        (input.maxSeats == null || table.seats <= input.maxSeats) &&
        table.tableId !== input.excludeTableId &&
        (!input.requireWindow || table.isWindowSeat === true)
    )
    .sort((a, b) => a.seats - b.seats);

  return candidates[0] ?? null;
}

function suggestionKey(suggestion: TransferSuggestion): string {
  return `${suggestion.fromTableId}:${suggestion.toTableId}:${suggestion.reason}`;
}

function pushSuggestion(
  bucket: TransferSuggestion[],
  seen: Set<string>,
  suggestion: TransferSuggestion | null
): void {
  if (!suggestion) return;
  const key = suggestionKey(suggestion);
  if (seen.has(key)) return;
  seen.add(key);
  bucket.push(suggestion);
}

function parseTableNumber(tableName: string): number | null {
  const match = tableName.trim().match(/\d+/);
  if (!match) return null;
  const value = Number.parseInt(match[0]!, 10);
  return Number.isFinite(value) ? value : null;
}

/** Adjacent tables share consecutive numeric names (e.g. 3 + 4). */
export function areAdjacentTableNames(a: string, b: string): boolean {
  const na = parseTableNumber(a);
  const nb = parseTableNumber(b);
  if (na == null || nb == null) return false;
  return Math.abs(na - nb) === 1;
}

function formatReservationTime(scheduledAt: string): string {
  const date = new Date(scheduledAt);
  if (!Number.isFinite(date.getTime())) return scheduledAt;
  return date.toLocaleTimeString("sr-RS", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function detectReservedIncoming(input: {
  tables: TransferTableState[];
  orders: TransferOrder[];
  reservations: TransferReservation[];
  now: number;
  tableMap: Map<string, TransferTableState>;
}): TransferSuggestion[] {
  const out: TransferSuggestion[] = [];

  for (const reservation of input.reservations) {
    const scheduledMs = Date.parse(reservation.scheduledAt);
    if (!Number.isFinite(scheduledMs)) continue;

    const minutesUntil = (scheduledMs - input.now) / 60_000;
    if (minutesUntil < 0 || minutesUntil > RESERVATION_HORIZON_MINUTES) {
      continue;
    }

    const table = input.tableMap.get(reservation.tableId);
    if (!table?.hasActiveSession) continue;

    const tableOrders = ordersForTable(input.orders, table.tableId);
    const reservationTime = formatReservationTime(reservation.scheduledAt);

    if (table.isPayingPhase) {
      out.push({
        fromTableId: table.tableId,
        fromTableName: table.tableName,
        toTableId: table.tableId,
        toTableName: table.tableName,
        reason: "reserved_incoming",
        confidence: minutesUntil <= 30 ? 0.95 : 0.82,
        orderIds: tableOrders.map((order) => order.id),
        detail: `Sto ${table.tableName} treba za ${reservationTime} rezervaciju`,
      });
      continue;
    }

    const currentParty = Math.max(1, table.partySize);
    const remainingSeats = table.seats - currentParty;
    if (reservation.partySize <= remainingSeats) continue;

    const destination = findFreeTable({
      tables: input.tables,
      minSeats: currentParty,
      maxSeats: Math.max(currentParty + 2, 4),
      excludeTableId: table.tableId,
    });
    if (!destination) continue;

    out.push({
      fromTableId: table.tableId,
      fromTableName: table.tableName,
      toTableId: destination.tableId,
      toTableName: destination.tableName,
      reason: "reserved_incoming",
      confidence: minutesUntil <= 30 ? 0.92 : 0.78,
      orderIds: tableOrders.map((order) => order.id),
      detail: `Rezervacija za ${reservation.partySize} osoba za ${Math.round(minutesUntil)} min — sto ${table.tableName} (${table.seats} mesta)`,
    });
  }

  return out;
}

function detectCapacityRebalance(input: {
  tables: TransferTableState[];
  orders: TransferOrder[];
  rushMode: boolean;
  waitingParties: TransferWaitingParty[];
}): TransferSuggestion[] {
  if (!input.rushMode) return [];

  const out: TransferSuggestion[] = [];
  const waiting = input.waitingParties[0];
  if (!waiting) return out;

  // Do not free a large table for a couple — seat them at a right-sized table.
  if (waiting.partySize <= UNDERUTILIZED_PARTY_MAX) return out;

  for (const large of input.tables) {
    if (!large.hasActiveSession || large.seats < LARGE_TABLE_MIN_SEATS) continue;
    const party = Math.max(1, large.partySize);
    if (party > UNDERUTILIZED_PARTY_MAX) continue;

    const destination = findFreeTable({
      tables: input.tables,
      minSeats: party,
      maxSeats: 4,
      excludeTableId: large.tableId,
    });
    if (!destination) continue;

    out.push({
      fromTableId: large.tableId,
      fromTableName: large.tableName,
      toTableId: destination.tableId,
      toTableName: destination.tableName,
      reason: "capacity_rebalance",
      confidence: 0.86,
      orderIds: ordersForTable(input.orders, large.tableId).map(
        (order) => order.id
      ),
      detail: `Sto ${large.tableName} (${large.seats} mesta) ima ${party} gosta, sto ${waiting.tableName} čeka`,
    });
    break;
  }

  return out;
}

function detectTurnoverSoon(input: {
  tables: TransferTableState[];
  orders: TransferOrder[];
}): TransferSuggestion[] {
  const out: TransferSuggestion[] = [];

  for (const table of input.tables) {
    if (!table.hasActiveSession) continue;
    const seated = table.seatedMinutes ?? 0;
    if (seated < TURNOVER_SOON_MIN_SEATED_MINUTES) continue;
    if (!table.isPayingPhase) continue;

    const tableOrders = ordersForTable(input.orders, table.tableId);
    out.push({
      fromTableId: table.tableId,
      fromTableName: table.tableName,
      toTableId: table.tableId,
      toTableName: table.tableName,
      reason: "turnover_soon",
      confidence: seated >= 90 ? 0.9 : 0.78,
      orderIds: tableOrders.map((order) => order.id),
      detail: `Sto ${table.tableName} se uskoro oslobađa`,
    });
    break;
  }

  return out;
}

function detectWaitlistTableMerge(input: {
  tables: TransferTableState[];
  waitingParties: TransferWaitingParty[];
}): TransferSuggestion[] {
  const waiting = input.waitingParties.find(
    (party) => party.partySize >= WAITLIST_MERGE_MIN_PARTY
  );
  if (!waiting) return [];

  const freeTables = input.tables
    .filter((table) => !table.hasActiveSession)
    .sort((a, b) => a.seats - b.seats);

  for (let i = 0; i < freeTables.length; i += 1) {
    for (let j = i + 1; j < freeTables.length; j += 1) {
      const first = freeTables[i]!;
      const second = freeTables[j]!;
      if (!areAdjacentTableNames(first.tableName, second.tableName)) continue;
      if (first.seats + second.seats < waiting.partySize) continue;

      return [
        {
          fromTableId: first.tableId,
          fromTableName: first.tableName,
          toTableId: second.tableId,
          toTableName: second.tableName,
          reason: "waitlist_table_merge",
          confidence: 0.84,
          orderIds: [],
          detail: `Lista čekanja: grupa od ${waiting.partySize} — spojite sto ${first.tableName} i ${second.tableName}`,
        },
      ];
    }
  }

  return [];
}

function detectGroupMerge(input: {
  tables: TransferTableState[];
  orders: TransferOrder[];
  partyMode: PartyMode;
}): TransferSuggestion[] {
  const active = input.tables.filter(
    (table) => table.hasActiveSession && table.openOrderCount > 0
  );
  if (active.length < 2) return [];

  const byPartyGroup = new Map<string, TransferTableState[]>();
  for (const table of active) {
    const groupId = table.partyGroupId?.trim();
    if (!groupId) continue;
    const list = byPartyGroup.get(groupId) ?? [];
    list.push(table);
    byPartyGroup.set(groupId, list);
  }

  for (const group of byPartyGroup.values()) {
    if (group.length < 2) continue;

    const sorted = [...group].sort(
      (a, b) => b.seats - a.seats || b.openOrderCount - a.openOrderCount
    );
    const target = sorted[0];
    const source = sorted.find((table) => table.tableId !== target.tableId);
    if (!target || !source) continue;

    const combinedParty = target.partySize + source.partySize;
    if (combinedParty > target.seats) continue;

    return [
      {
        fromTableId: source.tableId,
        fromTableName: source.tableName,
        toTableId: target.tableId,
        toTableName: target.tableName,
        reason: "group_merge",
        confidence: 0.88,
        orderIds: ordersForTable(input.orders, source.tableId).map(
          (order) => order.id
        ),
        detail: "Dva stola istog društva — predlog spajanja na veći sto",
      },
    ];
  }

  if (input.partyMode !== "shared_cart") return [];

  const sorted = [...active].sort(
    (a, b) => b.openOrderCount - a.openOrderCount || b.seats - a.seats
  );
  const target = sorted[0];
  const source = sorted.find((table) => table.tableId !== target.tableId);
  if (!target || !source) return [];

  const combinedParty = target.partySize + source.partySize;
  if (combinedParty > target.seats) return [];

  return [
    {
      fromTableId: source.tableId,
      fromTableName: source.tableName,
      toTableId: target.tableId,
      toTableName: target.tableName,
      reason: "group_merge",
      confidence: 0.8,
      orderIds: ordersForTable(input.orders, source.tableId).map(
        (order) => order.id
      ),
      detail: "Dva stola naručuju zajedno — spajanje olakšava servis",
    },
  ];
}

function detectBetterSeat(input: {
  tables: TransferTableState[];
  orders: TransferOrder[];
}): TransferSuggestion[] {
  const out: TransferSuggestion[] = [];

  for (const table of input.tables) {
    if (!table.hasActiveSession || table.guestPace !== "relaxed") continue;
    if (table.isWindowSeat) continue;

    const party = Math.max(1, table.partySize);
    const destination = findFreeTable({
      tables: input.tables,
      minSeats: party,
      maxSeats: Math.max(party + 1, 4),
      excludeTableId: table.tableId,
      requireWindow: true,
    });
    if (!destination) continue;

    out.push({
      fromTableId: table.tableId,
      fromTableName: table.tableName,
      toTableId: destination.tableId,
      toTableName: destination.tableName,
      reason: "better_seat",
      confidence: 0.72,
      orderIds: ordersForTable(input.orders, table.tableId).map(
        (order) => order.id
      ),
      detail: `Sto ${destination.tableName} pored prozora je slobodan — želite li da se preselite?`,
    });
    break;
  }

  return out;
}

/** Detect when a table transfer would help floor flow (R2). */
export function detectTransferOpportunities(input: {
  tables: TransferTableState[];
  activeOrders: TransferOrder[];
  reservations: TransferReservation[];
  turnoverPredictions?: TableTurnoverPrediction[];
  partyMode?: PartyMode;
  rushMode?: boolean;
  waitingParties?: TransferWaitingParty[];
  now?: number;
}): TransferSuggestion[] {
  const now = input.now ?? Date.now();
  const tableMap = tableById(input.tables);
  const seen = new Set<string>();
  const suggestions: TransferSuggestion[] = [];

  for (const suggestion of detectReservedIncoming({
    tables: input.tables,
    orders: input.activeOrders,
    reservations: input.reservations,
    now,
    tableMap,
  })) {
    pushSuggestion(suggestions, seen, suggestion);
  }

  for (const suggestion of detectCapacityRebalance({
    tables: input.tables,
    orders: input.activeOrders,
    rushMode: input.rushMode ?? false,
    waitingParties: input.waitingParties ?? [],
  })) {
    pushSuggestion(suggestions, seen, suggestion);
  }

  for (const suggestion of detectGroupMerge({
    tables: input.tables,
    orders: input.activeOrders,
    partyMode: input.partyMode ?? "shared_cart",
  })) {
    pushSuggestion(suggestions, seen, suggestion);
  }

  for (const suggestion of detectBetterSeat({
    tables: input.tables,
    orders: input.activeOrders,
  })) {
    pushSuggestion(suggestions, seen, suggestion);
  }

  for (const suggestion of detectTurnoverSoon({
    tables: input.tables,
    orders: input.activeOrders,
  })) {
    pushSuggestion(suggestions, seen, suggestion);
  }

  for (const suggestion of detectWaitlistTableMerge({
    tables: input.tables,
    waitingParties: input.waitingParties ?? [],
  })) {
    pushSuggestion(suggestions, seen, suggestion);
  }

  return limitTransferSuggestions(suggestions);
}

/** Max 2 suggestions per refresh — staff decides, Denis never nags guests (R2). */
export function limitTransferSuggestions(
  suggestions: TransferSuggestion[],
  max = MAX_TRANSFER_SUGGESTIONS
): TransferSuggestion[] {
  const byFromTable = new Map<string, TransferSuggestion>();

  for (const suggestion of suggestions) {
    const existing = byFromTable.get(suggestion.fromTableId);
    if (!existing || suggestion.confidence > existing.confidence) {
      byFromTable.set(suggestion.fromTableId, suggestion);
    }
  }

  return [...byFromTable.values()]
    .sort(
      (a, b) =>
        b.confidence - a.confidence ||
        a.fromTableName.localeCompare(b.fromTableName)
    )
    .slice(0, max);
}

export function formatTransferSuggestionHeadline(
  suggestion: TransferSuggestion
): string {
  if (
    (suggestion.reason === "reserved_incoming" ||
      suggestion.reason === "turnover_soon") &&
    suggestion.fromTableId === suggestion.toTableId
  ) {
    return suggestion.reason === "turnover_soon"
      ? `Sto ${suggestion.fromTableName} — uskoro slobodan`
      : `Sto ${suggestion.fromTableName} — rezervacija`;
  }
  if (suggestion.reason === "waitlist_table_merge") {
    return `Sto ${suggestion.fromTableName} + Sto ${suggestion.toTableName}`;
  }
  return `Sto ${suggestion.fromTableName} → Sto ${suggestion.toTableName}`;
}

export function formatTransferSuggestionReason(
  suggestion: TransferSuggestion
): string {
  switch (suggestion.reason) {
    case "reserved_incoming":
      return suggestion.detail;
    case "capacity_rebalance":
      return suggestion.detail;
    case "group_merge":
      return suggestion.detail;
    case "better_seat":
      return suggestion.detail;
    case "turnover_soon":
      return suggestion.detail;
    case "waitlist_table_merge":
      return suggestion.detail;
    default:
      return suggestion.detail;
  }
}

export function formatTransferCopilotLine(
  suggestion: TransferSuggestion
): string {
  return `💡 TRANSFER: ${formatTransferSuggestionHeadline(suggestion)} — ${formatTransferSuggestionReason(suggestion)}`;
}

export function transferSuggestionStaffMessage(
  suggestion: TransferSuggestion
): string {
  return formatTransferSuggestionReason(suggestion);
}

export function transferSuggestionActionUrl(
  suggestion: TransferSuggestion
): string {
  return `/waiter/tables/${suggestion.fromTableId}?transfer=${suggestion.toTableId}`;
}
