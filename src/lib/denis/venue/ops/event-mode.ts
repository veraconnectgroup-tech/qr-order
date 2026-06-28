import { z } from "zod";

export type EventPhase = "before" | "during" | "winding_down";

export type EventConfig = {
  name: string;
  expectedGuests: number;
  presetMenu: boolean;
  presetProductIds?: string[];
  startTime: string;
  endTime: string;
  specialInstructions: string;
  /** Optional HH:mm or ISO — used for staff copilot + pre-cake nudge pause. */
  cakeAt?: string | null;
};

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

export type EventGatheringDetection = {
  isGathering: boolean;
  scanCount: number;
  windowMinutes: number;
  reason: string;
};

export type EventCopilotStats = {
  orderedGuestCount: number;
  activeSessionCount: number;
  tablesWithoutOrder: number;
  topProducts: Array<{ name: string; count: number }>;
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
  ref.setUTCSeconds(0, 0);
  ref.setUTCHours(Number(match[1]), Number(match[2]), 0, 0);
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

const SERVICE_NUDGE_KINDS = [
  "attention_handoff",
  "drink_refill",
  "drink_with_food",
  "order_ready_notify",
  "order_ready",
  "order_eta_update",
  "slow_kitchen",
  "order_delay",
  "kitchen_busy",
  "kitchen_busy_preorder",
] as const;

function isServiceNudgeKind(kind: string): boolean {
  return (SERVICE_NUDGE_KINDS as readonly string[]).includes(kind);
}

/** Map event profile + phase → Denis runtime effects (N3). */
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

/** Filter proactive nudges during event mode — service-only unless pre-cake pause. */
export function shouldAllowEventProactiveNudge(
  kind: string,
  effects: Pick<EventModeEffects, "suppressProactiveNudges" | "drinkPromptOnly">
): boolean {
  if (!effects.suppressProactiveNudges) return true;
  if (!effects.drinkPromptOnly) return false;
  return isServiceNudgeKind(kind);
}

export function isProductOnEventPresetMenu(
  productId: string,
  effects: Pick<EventModeEffects, "presetMenuOnly">,
  presetProductIds: string[] | undefined
): boolean {
  if (!effects.presetMenuOnly) return true;
  if (!presetProductIds?.length) return true;
  return presetProductIds.includes(productId);
}

/** Guest-safe decline — never mentions event name or occasion (N3 rule). */
export function formatPresetMenuDecline(input: {
  productName: string;
  language?: string | null;
}): string {
  const english = (input.language?.trim().toLowerCase() ?? "sr").startsWith("en");
  const german = (input.language?.trim().toLowerCase() ?? "sr").startsWith("de");
  const name = input.productName.trim();

  if (english) {
    return `Tonight we are serving a special fixed menu — ${name} is not on it. Can I suggest something from tonight's menu?`;
  }
  if (german) {
    return `Heute Abend servieren wir ein festes Menü — ${name} ist nicht dabei. Darf ich etwas vom Abendmenü empfehlen?`;
  }
  return `Večeras imamo poseban meni — ${name} nije na njemu. Mogu da predložim nešto sa večerašnjeg menija?`;
}

export function presetMenuBlockedProductNames(input: {
  draftItems: Array<{ productId: string; productName: string }>;
  presetMenuOnly: boolean;
  presetProductIds?: string[];
}): string[] {
  if (!input.presetMenuOnly || !input.presetProductIds?.length) return [];

  const allowed = input.presetProductIds ?? [];
  const names: string[] = [];
  for (const line of input.draftItems) {
    if (allowed.includes(line.productId)) continue;
    const name = line.productName.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/** ≥ 5 session opens in 10 minutes → staff confirm hint (N3). */
export function detectEventGathering(input: {
  recentSessionOpens: Array<{ at: string }>;
  threshold?: number;
  windowMs?: number;
  nowMs?: number;
}): EventGatheringDetection {
  const threshold = input.threshold ?? 5;
  const windowMs = input.windowMs ?? 10 * 60_000;
  const nowMs = input.nowMs ?? Date.now();
  const windowStart = nowMs - windowMs;

  const scanCount = input.recentSessionOpens.filter((row) => {
    const ms = Date.parse(row.at);
    return Number.isFinite(ms) && ms >= windowStart;
  }).length;

  const windowMinutes = Math.round(windowMs / 60_000);
  const isGathering = scanCount >= threshold;

  return {
    isGathering,
    scanCount,
    windowMinutes,
    reason: isGathering
      ? `${scanCount} QR skenova u ${windowMinutes} min`
      : `${scanCount} skenova (prag ${threshold}+)`,
  };
}

export function shouldBatchTableOrders(
  openOrderCount: number,
  effects: Pick<EventModeEffects, "batchOrderEnabled">
): boolean {
  return effects.batchOrderEnabled && openOrderCount >= 3;
}

export function buildEventCopilotLines(input: {
  event: EventConfig;
  effects: EventModeEffects;
  stats: EventCopilotStats;
  nowMs?: number;
}): string[] {
  const nowMs = input.nowMs ?? Date.now();
  const lines: string[] = [
    `EVENT MODE: ${input.event.name} (${input.event.expectedGuests} gostiju)`,
  ];

  const cakeMinutes = minutesUntil(input.event.cakeAt, nowMs);
  if (cakeMinutes != null && cakeMinutes > 0) {
    lines.push(
      `⏰ Torta: ${input.event.cakeAt} (za ${cakeMinutes} min)`
    );
  } else if (input.event.cakeAt?.trim()) {
    lines.push(`⏰ Torta: ${input.event.cakeAt}`);
  }

  lines.push(
    `📊 Naručeno: ${input.stats.orderedGuestCount}/${input.stats.activeSessionCount} stolova`
  );

  if (input.stats.topProducts.length > 0) {
    const top = input.stats.topProducts
      .slice(0, 3)
      .map((row) => `${row.name} (${row.count})`)
      .join(", ");
    lines.push(`🍻 Top: ${top}`);
  }

  if (input.stats.tablesWithoutOrder > 0) {
    lines.push(
      `💡 Hint: ${input.stats.tablesWithoutOrder} stolova bez narudžbe — ponudi piće`
    );
  }

  if (input.effects.specialAnnouncement) {
    lines.push(`📣 ${input.effects.specialAnnouncement}`);
  }

  if (input.event.specialInstructions.trim()) {
    lines.push(`ℹ️ ${input.event.specialInstructions.trim()}`);
  }

  return lines;
}

export function formatEventGatheringConfirmHint(
  detection: EventGatheringDetection
): string {
  return `Izgleda da je grupno okupljanje (${detection.reason}). Želite uključiti event mode?`;
}
