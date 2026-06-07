import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type {
  LocationRhythmPriorsJson,
  ResolvedRhythmContext,
  RhythmSlotTopProduct,
  VenueServicePeriod,
} from "@/lib/denis/config/rhythm-prior-types";
import { resolveRhythmMode } from "@/lib/denis/config/resolve-rhythm-mode";

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
    servicePeriod: null,
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
    return {
      ...inactive,
      active: true,
      slotKey,
      servicePeriod: servicePeriodFromHour(hour),
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
    topProducts: normalizeTopProducts(slot.topProducts),
    servicePeriod: slot.servicePeriod ?? servicePeriodFromHour(hour),
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
