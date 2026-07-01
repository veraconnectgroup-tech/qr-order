export type WaitlistStatus =
  | "waiting"
  | "notified"
  | "seated"
  | "no_show"
  | "cancelled";

export type WaitlistEntry = {
  id: string;
  guestName: string;
  partySize: number;
  joinedAt: string;
  estimatedWaitMinutes: number;
  status: WaitlistStatus;
  notifiedAt: string | null;
  deviceFingerprint: string;
  /** VIP / Gold loyalty priority boost. */
  priorityBoost?: number;
  isReturningGuest?: boolean;
};

export type WaitlistConfig = {
  enabled: boolean;
  maxQueueSize: number;
  avgTurnoverMinutes: number;
  notifyBeforeMinutes: number;
  noShowTimeoutMinutes: number;
};

export const DEFAULT_WAITLIST_CONFIG: WaitlistConfig = {
  enabled: true,
  maxQueueSize: 50,
  avgTurnoverMinutes: 25,
  notifyBeforeMinutes: 5,
  noShowTimeoutMinutes: 10,
};

export type WaitlistFloorSnapshot = {
  activeTables: number;
  avgTurnoverMinutes: number;
  currentOccupancy: number;
  /** Tables in settling/paying — likely free within ~5 min. */
  imminentFreeTables: number;
  /** Post-meal idle tables wrapping up. */
  wrappingTables?: number;
};

export function estimateWaitTime(input: {
  position: number;
  activeTables: number;
  avgTurnover: number;
  currentOccupancy: number;
}): number {
  const tables = Math.max(1, input.activeTables);
  const position = Math.max(1, input.position);
  const occupancy = Math.min(1, Math.max(0, input.currentOccupancy));
  const occupancyFactor = 0.85 + occupancy * 0.15;
  const minutes = (position / tables) * input.avgTurnover * occupancyFactor;
  return Math.max(5, Math.round(minutes));
}

/** Smart wait — EWMA turnover + imminent table frees from floor phases. */
export function estimateWaitTimeSmart(input: {
  position: number;
  floor: WaitlistFloorSnapshot;
}): number {
  const base = estimateWaitTime({
    position: input.position,
    activeTables: input.floor.activeTables,
    avgTurnover: input.floor.avgTurnoverMinutes,
    currentOccupancy: input.floor.currentOccupancy,
  });

  const imminentCredit = input.floor.imminentFreeTables * 5;
  const wrappingCredit = (input.floor.wrappingTables ?? 0) * 2;
  const adjusted = base - imminentCredit - wrappingCredit;

  if (input.position === 1 && input.floor.imminentFreeTables > 0) {
    return Math.max(5, Math.min(base, Math.round(base * 0.85 + 5)));
  }

  return Math.max(5, Math.round(adjusted));
}

export function resolveWaitlistPriority(input: {
  explicitBoost?: number;
  loyaltyBoost?: number;
  isReturningGuest?: boolean;
}): { priorityBoost: number; isReturningGuest: boolean } {
  const loyaltyBoost = input.loyaltyBoost ?? 0;
  const returning = Boolean(input.isReturningGuest) || loyaltyBoost > 0;
  const returningBoost = returning ? 1 : 0;
  const explicit = input.explicitBoost ?? 0;

  return {
    priorityBoost: Math.min(
      5,
      Math.max(explicit, loyaltyBoost, loyaltyBoost + returningBoost)
    ),
    isReturningGuest: returning,
  };
}

export function buildDenisWaitlistGreeting(language?: string): string {
  const lang = (language ?? "sr").slice(0, 2);
  if (lang === "en") {
    return "We're full right now — I'll add you to the waitlist.";
  }
  if (lang === "de") {
    return "Aktuell ist voll — ich trage Sie auf die Warteliste ein.";
  }
  return "Trenutno je puno! Dodajem vas na listu čekanja.";
}

export function canJoinWaitlist(input: {
  queueLength: number;
  config: WaitlistConfig;
}): { allowed: boolean; reason?: string } {
  if (!input.config.enabled) {
    return { allowed: false, reason: "waitlist_disabled" };
  }
  if (input.queueLength >= input.config.maxQueueSize) {
    return { allowed: false, reason: "queue_full" };
  }
  return { allowed: true };
}

export function buildWaitlistJoinMessage(input: {
  guestName: string;
  partySize: number;
  estimatedMinutes: number;
  language?: string;
}): string {
  const lang = (input.language ?? "sr").slice(0, 2);
  const wait = input.estimatedMinutes;

  if (lang === "en") {
    return `Welcome${input.guestName ? `, ${input.guestName}` : ""}! ${buildDenisWaitlistGreeting("en")} Party of ${input.partySize} — estimated wait ~${wait} min. We'll notify you when a table is ready!`;
  }

  if (lang === "de") {
    return `Willkommen${input.guestName ? `, ${input.guestName}` : ""}! ${buildDenisWaitlistGreeting("de")} Gruppe ${input.partySize} — geschätzte Wartezeit ~${wait} min. Wir benachrichtigen Sie, sobald ein Tisch frei ist!`;
  }

  return `${buildDenisWaitlistGreeting("sr")}${input.guestName ? ` ${input.guestName},` : ""} grupa ${input.partySize} — procijenjeno čekanje ~${wait} min. Obavijestit ćemo vas kad se sto oslobodi!`;
}

export function buildTableReadyNotification(input: {
  guestName: string;
  timeoutMinutes: number;
  language?: string;
}): string {
  const lang = (input.language ?? "sr").slice(0, 2);
  if (lang === "en") {
    return `${input.guestName}, your table is ready! You have ${input.timeoutMinutes} minutes to arrive.`;
  }
  return `${input.guestName}, vaš sto je spreman! Imate ${input.timeoutMinutes} min da dođete.`;
}

export function buildWaitlistBrowseHint(language?: string): string {
  const lang = (language ?? "sr").slice(0, 2);
  if (lang === "en") return "Browse the menu while you wait! 🍽️";
  if (lang === "de") return "Schauen Sie sich die Karte an, während Sie warten! 🍽️";
  return "Možete pogledati meni dok čekate! 🍽️";
}

/** Denis proactive nudge after 10+ min on waitlist. */
export function buildWaitlistProactiveMessage(input: {
  waitedMinutes: number;
  estimatedMinutes: number;
  language?: string;
}): string | null {
  if (input.waitedMinutes < 10) return null;

  const lang = (input.language ?? "sr").slice(0, 2);
  const eta = Math.max(5, input.estimatedMinutes);

  if (lang === "en") {
    return `Almost there! A table should free up in ~${eta} min. Browse our menu while you wait :) ${buildWaitlistBrowseHint("en")}`;
  }
  if (lang === "de") {
    return `Gleich soweit! Ein Tisch in ~${eta} min. Schauen Sie sich die Karte an :) ${buildWaitlistBrowseHint("de")}`;
  }
  return `Još malo! Slobodan sto za ~${eta} min. Pogledajte naš meni dok čekate :) ${buildWaitlistBrowseHint("sr")}`;
}

/** Sort queue: priority boost first, then FIFO. */
export function sortWaitlistQueue(entries: WaitlistEntry[]): WaitlistEntry[] {
  return [...entries].sort((a, b) => {
    const boostDiff = (b.priorityBoost ?? 0) - (a.priorityBoost ?? 0);
    if (boostDiff !== 0) return boostDiff;
    return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
  });
}

export function assignWaitlistPosition(
  entries: WaitlistEntry[],
  entryId: string
): number {
  const sorted = sortWaitlistQueue(
    entries.filter((e) => e.status === "waiting" || e.status === "notified")
  );
  const idx = sorted.findIndex((e) => e.id === entryId);
  return idx >= 0 ? idx + 1 : sorted.length + 1;
}

export function pickBestTableForParty(input: {
  partySize: number;
  availableTables: { id: string; seats: number }[];
}): string | null {
  const suitable = input.availableTables
    .filter((table) => table.seats >= input.partySize)
    .sort((a, b) => a.seats - b.seats);
  return suitable[0]?.id ?? null;
}

export function resolveNoShowEntries(
  entries: WaitlistEntry[],
  config: WaitlistConfig,
  now = Date.now()
): WaitlistEntry[] {
  const timeoutMs = config.noShowTimeoutMinutes * 60_000;
  return entries.map((entry) => {
    if (entry.status !== "notified" || !entry.notifiedAt) return entry;
    const notifiedAt = new Date(entry.notifiedAt).getTime();
    if (Number.isNaN(notifiedAt)) return entry;
    if (now - notifiedAt > timeoutMs) {
      return { ...entry, status: "no_show" as const };
    }
    return entry;
  });
}

/** First waiting party after no-shows are resolved (FIFO + priority). */
export function pickNextWaitingEntry(
  entries: WaitlistEntry[]
): WaitlistEntry | null {
  const waiting = sortWaitlistQueue(
    entries.filter((entry) => entry.status === "waiting")
  );
  return waiting[0] ?? null;
}

/** Host drag-and-drop reorder — preserves priority tiers, reorders within tier. */
export function reorderWaitlistQueue(
  entries: WaitlistEntry[],
  orderedActiveIds: string[]
): WaitlistEntry[] {
  const active = sortWaitlistQueue(
    entries.filter(
      (entry) => entry.status === "waiting" || entry.status === "notified"
    )
  );
  const inactive = entries.filter(
    (entry) => entry.status !== "waiting" && entry.status !== "notified"
  );

  const byId = new Map(active.map((entry) => [entry.id, entry]));
  const reordered: WaitlistEntry[] = [];

  for (const id of orderedActiveIds) {
    const entry = byId.get(id);
    if (entry) {
      reordered.push(entry);
      byId.delete(id);
    }
  }

  for (const entry of active) {
    if (byId.has(entry.id)) reordered.push(entry);
  }

  return [...reordered, ...inactive];
}

export type WaitlistStaffRow = {
  entryId: string;
  position: number;
  guestName: string;
  partySize: number;
  waitedMinutes: number;
  estimatedMinutes: number;
  status: WaitlistEntry["status"];
  priorityBoost: number;
  isReturningGuest: boolean;
};

export function formatWaitlistStaffView(
  entries: WaitlistEntry[],
  _config: WaitlistConfig,
  floor: WaitlistFloorSnapshot,
  now = Date.now()
): WaitlistStaffRow[] {
  const waiting = sortWaitlistQueue(
    entries.filter((e) => e.status === "waiting" || e.status === "notified")
  );

  return waiting.map((entry, index) => {
    const joined = new Date(entry.joinedAt).getTime();
    const waitedMinutes = Number.isNaN(joined)
      ? 0
      : Math.max(0, Math.round((now - joined) / 60_000));

    return {
      entryId: entry.id,
      position: index + 1,
      guestName: entry.guestName,
      partySize: entry.partySize,
      waitedMinutes,
      estimatedMinutes: estimateWaitTimeSmart({
        position: index + 1,
        floor,
      }),
      status: entry.status,
      priorityBoost: entry.priorityBoost ?? 0,
      isReturningGuest: entry.isReturningGuest ?? false,
    };
  });
}

export function guestCancelWaitlistEntry(
  entries: WaitlistEntry[],
  entryId: string,
  deviceFingerprint: string
): WaitlistEntry[] {
  return entries.map((entry) => {
    if (entry.id !== entryId) return entry;
    if (entry.deviceFingerprint !== deviceFingerprint) return entry;
    return { ...entry, status: "cancelled" };
  });
}

/** Never promise immediate seating when queue is non-empty. */
export function formatEstimatedWaitLabel(minutes: number, language?: string): string {
  const lang = (language ?? "sr").slice(0, 2);
  if (minutes <= 0) {
    return lang === "en" ? "A few minutes" : "Nekoliko minuta";
  }
  return lang === "en" ? `~${minutes} min` : `~${minutes} min`;
}
