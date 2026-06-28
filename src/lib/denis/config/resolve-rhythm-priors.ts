import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type {
  LocationRhythmPriorsJson,
  ResolvedRhythmContext,
  RhythmBehaviorDirectives,
  RhythmSlotStress,
  RhythmSlotTopProduct,
  VenueServicePeriod,
} from "@/lib/denis/config/rhythm-prior-types";
import { resolveRhythmMode } from "@/lib/denis/config/resolve-rhythm-mode";
import { computeRushIndex, medianSlotSessions } from "@/lib/denis/config/evaluate-rhythm-ops-alerts";

const WEEKDAY_SHORT: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function rhythmSlotKey(dow: number, hour: number): string {
  return `${dow}:${hour}`;
}

export function localSlotFromDate(
  date: Date,
  timezone: string
): { dow: number; hour: number } {
  const tz = timezone.trim() || "Europe/Berlin";
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(date);
  const hourPart = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(hourPart.find((part) => part.type === "hour")?.value ?? "0");

  return {
    dow: WEEKDAY_SHORT[weekday] ?? date.getUTCDay(),
    hour: Number.isFinite(hour) ? hour : 0,
  };
}

export function servicePeriodFromHour(hour: number): VenueServicePeriod {
  if (hour >= 6 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "dinner";
  return "late";
}

export function slotConfidence(
  sampleSessions: number,
  minSampleSessions: number
): number {
  if (minSampleSessions <= 0) return 0;
  return Math.min(1, sampleSessions / minSampleSessions);
}

export function slotStressFromRushIndex(index: number): RhythmSlotStress {
  if (index >= 1.8) return "rush";
  if (index >= 1.2) return "busy";
  if (index <= 0.5) return "low";
  return "normal";
}

/** Map slot stress → Denis reply/upsell posture (Prompt 50). */
export function resolveRhythmBehaviorDirectives(
  stress: RhythmSlotStress | null | undefined,
  servicePeriod: VenueServicePeriod | null
): RhythmBehaviorDirectives {
  const period = servicePeriod ?? "dinner";

  if (stress === "rush" || stress === "high") {
    return {
      shortenReplies: true,
      skipUpsell: true,
      upsellLevel: "none",
      conversationalTone: "concise",
    };
  }

  if (stress === "low") {
    return {
      shortenReplies: false,
      skipUpsell: false,
      upsellLevel: "full",
      conversationalTone: "warm_chatty",
    };
  }

  if (stress === "busy") {
    return {
      shortenReplies: true,
      skipUpsell: false,
      upsellLevel: "reduced",
      conversationalTone: "balanced",
    };
  }

  // normal / balanced — brunch lunch etc.
  if (period === "lunch" || period === "breakfast") {
    return {
      shortenReplies: false,
      skipUpsell: false,
      upsellLevel: "full",
      conversationalTone: "balanced",
    };
  }

  return {
    shortenReplies: false,
    skipUpsell: false,
    upsellLevel: "reduced",
    conversationalTone: "balanced",
  };
}

const WEEKDAY_SR: Record<number, string> = {
  0: "Nedelja",
  1: "Ponedeljak",
  2: "Utorak",
  3: "Sreda",
  4: "Četvrtak",
  5: "Petak",
  6: "Subota",
};

/** Aggregate slot sessions in hour range for staffing hint. */
export function buildStaffingSuggestion(input: {
  priors: LocationRhythmPriorsJson;
  dow: number;
  hourFrom: number;
  hourTo: number;
  targetSessionsPerWaiter?: number;
}): string | null {
  const target = input.targetSessionsPerWaiter ?? 12;
  let totalSessions = 0;

  for (let hour = input.hourFrom; hour <= input.hourTo; hour += 1) {
    const slot = input.priors.slots[rhythmSlotKey(input.dow, hour)];
    totalSessions += slot?.sampleSessions ?? 0;
  }

  if (totalSessions <= 0) return null;

  const waiters = Math.max(1, Math.ceil(totalSessions / target));
  const day = WEEKDAY_SR[input.dow] ?? "Danas";
  return `${day} ${input.hourFrom}-${input.hourTo} prosečno ${totalSessions} narudžbina — treba ${waiters} konobara.`;
}

/** Service-period greeting for system prompt / welcome (Prompt 50). */
export function buildServicePeriodGreeting(input: {
  servicePeriod: VenueServicePeriod;
  language?: string | null;
  todaySpecial?: string | null;
  topProductName?: string | null;
  barOpenUntil?: string | null;
}): string {
  const lang = (input.language ?? "sr").toLowerCase().slice(0, 2);
  const special = input.todaySpecial?.trim();
  const top = input.topProductName?.trim();
  const barUntil = input.barOpenUntil?.trim() ?? "01:00";

  if (lang === "de") {
    switch (input.servicePeriod) {
      case "breakfast":
        return "Guten Morgen! Kaffee zum Start?";
      case "lunch":
        return special
          ? `Das Tagesmenü heute ist ${special} — sehr empfehlenswert!`
          : "Mittagsmenü heute — soll ich etwas empfehlen?";
      case "dinner":
        return "Guten Abend! Ein Aperitif vor dem Essen?";
      case "late":
        return `Gerne helfe ich. Unsere Bar ist bis ${barUntil} geöffnet.`;
      default:
        return top
          ? `Beliebt gerade: ${top} — soll ich empfehlen?`
          : "Womit kann ich helfen?";
    }
  }

  if (lang === "en") {
    switch (input.servicePeriod) {
      case "breakfast":
        return "Good morning! Coffee to start?";
      case "lunch":
        return special
          ? `Today's special is ${special} — I'd recommend it!`
          : "Today's lunch special — want a recommendation?";
      case "dinner":
        return "Good evening! An aperitif before dinner?";
      case "late":
        return `Happy to help. Our bar is open until ${barUntil}.`;
      default:
        return top
          ? `Popular right now: ${top} — shall I suggest something?`
          : "How can I help?";
    }
  }

  switch (input.servicePeriod) {
    case "breakfast":
      return "Dobar jutro! Kafa za početak?";
    case "lunch":
      return special
        ? `Dnevni meni je danas ${special} — preporučujem!`
        : top
          ? `Za ručak je ${top} popularan — preporučujem!`
          : "Dnevni meni je spreman — šta vam se jede?";
    case "dinner":
      return "Dobroveče! Aperitiv pre večere?";
    case "late":
      return `Rado ću vam pomoći. Naš bar je otvoren do ${barUntil}.`;
    case "afternoon":
      return top
        ? `Popodne je ${top} favorit — hoćete preporuku?`
        : "Popodnevni meni — kako mogu da pomognem?";
    default:
      return top
        ? `Večeras je ${top} favorit — mogu da preporučim.`
        : "Kako mogu da pomognem?";
  }
}

function resolveSlotStress(
  slot: { sampleSessions: number } | undefined,
  priors: LocationRhythmPriorsJson,
  minSampleSessions: number
): RhythmSlotStress {
  if (!slot || slot.sampleSessions <= 0) return "normal";
  const vsMin = slot.sampleSessions / Math.max(1, minSampleSessions);
  const populatedSlots = Object.values(priors.slots).filter(
    (entry) => entry.sampleSessions > 0
  );
  if (populatedSlots.length <= 1) {
    return slotStressFromRushIndex(vsMin);
  }
  const median = medianSlotSessions(priors);
  const vsMedian = computeRushIndex(
    slot.sampleSessions,
    median || minSampleSessions
  );
  return slotStressFromRushIndex(Math.max(vsMedian, vsMin));
}

export function parseLocationRhythmPriors(
  value: unknown
): LocationRhythmPriorsJson | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || typeof record.slots !== "object" || !record.slots) {
    return null;
  }
  return value as LocationRhythmPriorsJson;
}

export function emptyLocationRhythmPriors(): LocationRhythmPriorsJson {
  return { version: 1, slots: {} };
}

function normalizeTopProducts(
  products: RhythmSlotTopProduct[] | undefined
): RhythmSlotTopProduct[] {
  return (products ?? []).slice(0, 3);
}

function topProductSummaries(
  products: RhythmSlotTopProduct[]
) {
  const total = products.reduce((sum, product) => sum + product.count, 0);
  return products.map((product) => ({
    productId: product.productId,
    name: product.name,
    count: product.count,
    sharePct:
      total > 0 ? Math.round((product.count / total) * 100) : null,
  }));
}

/** Pure resolve — ADR-042 VRP: priors → runtime context at config load / gate audit. */
export function resolveRhythmPriors(input: {
  config: ConciergeConfig;
  priors: LocationRhythmPriorsJson | null;
  now?: Date;
  timezone?: string | null;
}): ResolvedRhythmContext {
  const mode = resolveRhythmMode(input.config);
  const defaultDessertDelayMinutes = input.config.upsell.dessertDelayMinutes;
  const inactive: ResolvedRhythmContext = {
    mode,
    active: false,
    applied: false,
    slotKey: null,
    confidence: 0,
    defaultDessertDelayMinutes,
    wouldOverrideDessertDelayMinutes: null,
    topProducts: [],
    topProductSummaries: [],
    servicePeriod: null,
    behaviorDirectives: null,
    staffSuggestion: null,
    servicePeriodGreeting: null,
  };

  if (mode === "off" || !input.priors) {
    return inactive;
  }

  const timezone = input.timezone?.trim() || "Europe/Berlin";
  const now = input.now ?? new Date();
  const { dow, hour } = localSlotFromDate(now, timezone);
  const slotKey = rhythmSlotKey(dow, hour);
  const slot = input.priors.slots[slotKey];
  if (!slot) {
    const servicePeriod = servicePeriodFromHour(hour);
    return {
      ...inactive,
      active: true,
      slotKey,
      servicePeriod,
      behaviorDirectives: resolveRhythmBehaviorDirectives("normal", servicePeriod),
      servicePeriodGreeting: buildServicePeriodGreeting({ servicePeriod }),
    };
  }

  const confidence = slotConfidence(
    slot.sampleSessions,
    input.config.rhythm.minSampleSessions
  );
  const meetsConfidence = confidence >= input.config.rhythm.minConfidence;
  const wouldOverrideDessertDelayMinutes =
    slot.dessertDelayP50Min != null && Number.isFinite(slot.dessertDelayP50Min)
      ? Math.max(0, Math.round(slot.dessertDelayP50Min))
      : null;

  const applied =
    mode === "enforce" &&
    meetsConfidence &&
    wouldOverrideDessertDelayMinutes != null;

  const topProducts = normalizeTopProducts(slot.topProducts);
  const kitchenPrep = input.priors.prepTime?.byStation.kitchen;
  const servicePeriod = slot.servicePeriod ?? servicePeriodFromHour(hour);
  const currentSlotStress = resolveSlotStress(
    slot,
    input.priors,
    input.config.rhythm.minSampleSessions
  );
  const behaviorDirectives = resolveRhythmBehaviorDirectives(
    currentSlotStress,
    servicePeriod
  );
  const topName = topProducts[0]?.name ?? null;
  const staffSuggestion = buildStaffingSuggestion({
    priors: input.priors,
    dow,
    hourFrom: Math.max(0, hour - 1),
    hourTo: Math.min(23, hour + 1),
    targetSessionsPerWaiter: 12,
  });

  return {
    mode,
    active: true,
    applied,
    slotKey,
    confidence,
    defaultDessertDelayMinutes,
    wouldOverrideDessertDelayMinutes: meetsConfidence
      ? wouldOverrideDessertDelayMinutes
      : null,
    topProducts,
    topProductSummaries: topProductSummaries(topProducts),
    slotSampleSessions: slot.sampleSessions,
    slotLabel: `${servicePeriod} ${hour}:00`,
    currentSlotStress,
    typicalSessionMinutes: slot.sessionDurationP50Min,
    kitchenPrepAvgMinutes: kitchenPrep?.p50 ?? null,
    kitchenPrepRushMinutes: kitchenPrep
      ? Math.round(kitchenPrep.p50 * kitchenPrep.rushMultiplier)
      : null,
    servicePeriod,
    behaviorDirectives,
    staffSuggestion,
    servicePeriodGreeting: buildServicePeriodGreeting({
      servicePeriod,
      topProductName: topName,
    }),
  };
}

/** Effective dessert delay for scheduler — enforce only when applied. */
export function resolveEffectiveDessertDelayMinutes(
  config: ConciergeConfig,
  rhythm: ResolvedRhythmContext
): number {
  if (rhythm.applied && rhythm.wouldOverrideDessertDelayMinutes != null) {
    return rhythm.wouldOverrideDessertDelayMinutes;
  }
  return config.upsell.dessertDelayMinutes;
}
