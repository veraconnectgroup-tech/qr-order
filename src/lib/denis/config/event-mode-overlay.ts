import { z } from "zod";

/** Minimal venue ops slice for config overlay — keeps config layer venue-free. */
export type EventModeVenueOpsSlice = {
  operatingMode?: "normal" | "rush" | "kitchen_closed" | "event";
  eventConfig?: unknown;
};

export type EventPhase = "before" | "during" | "winding_down";

export type EventConfig = {
  name: string;
  expectedGuests: number;
  presetMenu: boolean;
  presetProductIds?: string[];
  startTime: string;
  endTime: string;
  specialInstructions: string;
  cakeAt?: string | null;
};

const eventConfigSchema = z.object({
  name: z.string().trim().min(1).max(120),
  expectedGuests: z.number().int().min(1).max(500),
  presetMenu: z.boolean(),
  presetProductIds: z.array(z.string().uuid()).max(200).optional(),
  startTime: z.string().trim().min(1).max(40),
  endTime: z.string().trim().min(1).max(40),
  specialInstructions: z.string().trim().max(500),
  cakeAt: z.string().trim().max(40).nullable().optional(),
});

export function parseEventConfig(raw: unknown): EventConfig | null {
  const parsed = eventConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function parseClockToMs(clock: string, referenceMs: number): number {
  const trimmed = clock.trim();
  if (trimmed.includes("T")) {
    const ms = Date.parse(trimmed);
    return Number.isFinite(ms) ? ms : referenceMs;
  }

  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return referenceMs;

  const ref = new Date(referenceMs);
  ref.setSeconds(0, 0);
  ref.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return ref.getTime();
}

export function resolveEventPhase(
  event: Pick<EventConfig, "startTime" | "endTime">,
  nowMs: number = Date.now()
): EventPhase {
  const startMs = parseClockToMs(event.startTime, nowMs);
  let endMs = parseClockToMs(event.endTime, nowMs);
  if (endMs <= startMs) {
    endMs += 24 * 60 * 60 * 1000;
  }

  if (nowMs < startMs) return "before";
  if (nowMs > endMs) return "winding_down";
  return "during";
}

function minutesUntil(clock: string | null | undefined, nowMs: number): number | null {
  if (!clock?.trim()) return null;
  const targetMs = parseClockToMs(clock, nowMs);
  const diffMin = (targetMs - nowMs) / 60_000;
  return Number.isFinite(diffMin) ? Math.round(diffMin) : null;
}

function formatCakeAnnouncement(minutes: number): string {
  if (minutes <= 0) return "Torta — odmah!";
  return `Torta stiže za ${minutes} min`;
}

export type EventModeEffects = {
  skipUpsell: boolean;
  batchOrderEnabled: boolean;
  shortenReplies: boolean;
  presetMenuOnly: boolean;
  specialAnnouncement: string | null;
  groupBillEnabled: boolean;
  suppressProactiveNudges: boolean;
  drinkPromptOnly: boolean;
};

/** Map event profile + phase → config overlay effects (N3). */
export function resolveEventEffects(
  event: EventConfig,
  currentPhase: EventPhase,
  nowMs: number = Date.now()
): EventModeEffects {
  const cakeMinutes = minutesUntil(event.cakeAt, nowMs);
  const suppressBeforeCake =
    cakeMinutes != null && cakeMinutes >= 0 && cakeMinutes <= 10;

  if (currentPhase === "before") {
    return {
      skipUpsell: true,
      batchOrderEnabled: false,
      shortenReplies: false,
      presetMenuOnly: false,
      specialAnnouncement: null,
      groupBillEnabled: false,
      suppressProactiveNudges: false,
      drinkPromptOnly: false,
    };
  }

  if (currentPhase === "winding_down") {
    return {
      skipUpsell: true,
      batchOrderEnabled: false,
      shortenReplies: true,
      presetMenuOnly: event.presetMenu,
      specialAnnouncement: null,
      groupBillEnabled: true,
      suppressProactiveNudges: true,
      drinkPromptOnly: false,
    };
  }

  return {
    skipUpsell: true,
    batchOrderEnabled: true,
    shortenReplies: true,
    presetMenuOnly: event.presetMenu,
    specialAnnouncement:
      cakeMinutes != null && cakeMinutes > 0 && cakeMinutes <= 30
        ? formatCakeAnnouncement(cakeMinutes)
        : null,
    groupBillEnabled: true,
    suppressProactiveNudges: true,
    drinkPromptOnly: !suppressBeforeCake,
  };
}
