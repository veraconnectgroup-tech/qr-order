import type {
  GuestBehavioralPatterns,
  GuestMemoryVisitItem,
  GuestRelationshipSnapshot,
  GuestRelationshipVisit,
  GuestRelationshipVisitEvent,
  PreferredMealPattern,
} from "@/lib/denis/platform/guest-memory-types";

const MAX_TIMELINE_VISITS = 12;
const DAY_LABELS = [
  "Nedelja",
  "Ponedeljak",
  "Utorak",
  "Sreda",
  "Četvrtak",
  "Petak",
  "Subota",
];

export function emptyGuestRelationshipSnapshot(): GuestRelationshipSnapshot {
  return {
    version: 1,
    timeline: [],
    behavioral: {
      typicalVisitDays: [],
      typicalVisitDayLabels: [],
      neverOrdersStarter: false,
      alwaysOrdersDessert: false,
      avgSpendEuros: null,
      preferredMealPattern: null,
    },
    preferenceEvolution: [],
    currentPreferenceItems: [],
    typicalPartySize: null,
  };
}

export function parseGuestRelationshipSnapshot(
  raw: unknown
): GuestRelationshipSnapshot {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyGuestRelationshipSnapshot();
  }
  const record = raw as Partial<GuestRelationshipSnapshot>;
  if (record.version !== 1 || !Array.isArray(record.timeline)) {
    return emptyGuestRelationshipSnapshot();
  }
  return {
    version: 1,
    timeline: record.timeline.slice(-MAX_TIMELINE_VISITS),
    behavioral: record.behavioral ?? emptyGuestRelationshipSnapshot().behavioral,
    preferenceEvolution: record.preferenceEvolution ?? [],
    currentPreferenceItems: record.currentPreferenceItems ?? [],
    typicalPartySize: record.typicalPartySize ?? null,
  };
}

function daysBetween(isoA: string, isoB: string): number | null {
  const a = Date.parse(isoA);
  const b = Date.parse(isoB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((b - a) / 86_400_000));
}

function visitHadStarter(items: GuestMemoryVisitItem[]): boolean {
  return items.some((item) => {
    const section = (item.menuSection ?? "").toLowerCase();
    return section.includes("starter") || section.includes("appetizer");
  });
}

function visitHadDessert(items: GuestMemoryVisitItem[]): boolean {
  return items.some((item) => {
    const section = (item.menuSection ?? "").toLowerCase();
    return section.includes("dessert");
  });
}

/** Append a completed visit to the relationship timeline. */
export function appendRelationshipVisit(
  snapshot: GuestRelationshipSnapshot,
  input: {
    visitedAt: string;
    itemNames: string[];
    items?: GuestMemoryVisitItem[];
    spendCents?: number | null;
    partySize?: number | null;
    feedbackSentiment?: "positive" | "neutral" | "negative" | null;
    partyNote?: string | null;
  }
): GuestRelationshipSnapshot {
  const items = input.items ?? input.itemNames.map((productName) => ({ productName }));
  const previous = snapshot.timeline[snapshot.timeline.length - 1] ?? null;
  const visitNumber = (previous?.visitNumber ?? 0) + 1;
  const visitedAt = input.visitedAt;
  const dayOfWeek = new Date(visitedAt).getUTCDay();

  const events: GuestRelationshipVisitEvent[] = [
    { kind: "arrived", at: visitedAt },
    {
      kind: "ordered",
      items: input.itemNames.filter(Boolean).slice(0, 8),
      at: visitedAt,
    },
  ];

  if (input.feedbackSentiment) {
    events.push({
      kind: "feedback",
      sentiment: input.feedbackSentiment,
      at: visitedAt,
    });
  }

  if (input.partySize != null && input.partySize > 0) {
    events.push({
      kind: "party_note",
      partySize: input.partySize,
      note: input.partyNote ?? null,
      at: visitedAt,
    });
  }

  const visit: GuestRelationshipVisit = {
    visitNumber,
    visitedAt,
    daysSincePrevious: previous
      ? daysBetween(previous.visitedAt, visitedAt)
      : null,
    dayOfWeek,
    itemNames: input.itemNames.filter(Boolean).slice(0, 8),
    spendCents: input.spendCents ?? null,
    partySize: input.partySize ?? null,
    feedbackSentiment: input.feedbackSentiment ?? null,
    events,
  };

  const timeline = [...snapshot.timeline, visit].slice(-MAX_TIMELINE_VISITS);
  return {
    ...snapshot,
    timeline,
    currentPreferenceItems: dominantItemsFromRecentVisits(timeline, 2),
    typicalPartySize: typicalPartySizeFromTimeline(timeline),
  };
}

function dominantItemsFromRecentVisits(
  timeline: GuestRelationshipVisit[],
  visitWindow: number
): string[] {
  const recent = timeline.slice(-visitWindow);
  const counts = new Map<string, number>();
  for (const visit of recent) {
    for (const name of visit.itemNames) {
      const key = name.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
}

function typicalPartySizeFromTimeline(
  timeline: GuestRelationshipVisit[]
): number | null {
  const sizes = timeline
    .map((visit) => visit.partySize)
    .filter((size): size is number => typeof size === "number" && size > 0);
  if (sizes.length === 0) return null;
  const sum = sizes.reduce((total, size) => total + size, 0);
  return Math.round((sum / sizes.length) * 10) / 10;
}

export function computeBehavioralPatterns(input: {
  timeline: GuestRelationshipVisit[];
  preferredMealPattern?: PreferredMealPattern | null;
  avgSpendCents?: number | null;
  itemsByVisit?: GuestMemoryVisitItem[][];
}): GuestBehavioralPatterns {
  const dowCounts = new Map<number, number>();
  let starterVisits = 0;
  let dessertVisits = 0;
  let visitsWithItems = 0;

  for (let index = 0; index < input.timeline.length; index += 1) {
    const visit = input.timeline[index]!;
    dowCounts.set(visit.dayOfWeek, (dowCounts.get(visit.dayOfWeek) ?? 0) + 1);

    const visitItems = input.itemsByVisit?.[index] ?? visit.itemNames.map((name) => ({
      productName: name,
      menuSection: null,
    }));

    if (visitItems.length === 0) continue;
    visitsWithItems += 1;
    if (visitHadStarter(visitItems)) starterVisits += 1;
    if (visitHadDessert(visitItems)) dessertVisits += 1;
  }

  const maxCount = Math.max(0, ...dowCounts.values());
  const typicalVisitDays = [...dowCounts.entries()]
    .filter(([, count]) => count === maxCount && maxCount > 0)
    .map(([dow]) => dow)
    .sort((a, b) => a - b);

  const neverOrdersStarter =
    visitsWithItems >= 2 && starterVisits === 0;
  const alwaysOrdersDessert =
    visitsWithItems >= 2 && dessertVisits === visitsWithItems;

  const avgSpendEuros =
    input.avgSpendCents != null && input.avgSpendCents > 0
      ? Math.round(input.avgSpendCents) / 100
      : null;

  return {
    typicalVisitDays,
    typicalVisitDayLabels: typicalVisitDays.map((dow) => DAY_LABELS[dow] ?? String(dow)),
    neverOrdersStarter,
    alwaysOrdersDessert,
    avgSpendEuros,
    preferredMealPattern: input.preferredMealPattern ?? null,
  };
}

export function refreshRelationshipSnapshot(
  snapshot: GuestRelationshipSnapshot,
  input: {
    preferredMealPattern?: PreferredMealPattern | null;
    avgSpendCents?: number | null;
    preferenceEvolution?: GuestRelationshipSnapshot["preferenceEvolution"];
  }
): GuestRelationshipSnapshot {
  return {
    ...snapshot,
    behavioral: computeBehavioralPatterns({
      timeline: snapshot.timeline,
      preferredMealPattern: input.preferredMealPattern,
      avgSpendCents: input.avgSpendCents,
    }),
    preferenceEvolution:
      input.preferenceEvolution ?? snapshot.preferenceEvolution,
    currentPreferenceItems: dominantItemsFromRecentVisits(snapshot.timeline, 2),
    typicalPartySize: typicalPartySizeFromTimeline(snapshot.timeline),
  };
}
