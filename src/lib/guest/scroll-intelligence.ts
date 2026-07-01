import type { BrowseEvent, BrowseMenuSection } from "@/lib/denis/cognition/browse/browse-types";
import type { MenuSection } from "@/lib/menu-section";

export type ScrollIntentKind = "fast_search" | "slow_category" | "reached_bottom";

export type ScrollSignal = {
  intent: ScrollIntentKind;
  categoryId?: string;
  categoryLabel?: string;
  menuSection?: BrowseMenuSection | null;
  velocityPxPerSec?: number;
  dwellMs?: number;
  at: number;
};

export type ClientNudgeBudget = {
  max: number;
  shown: number;
  dismissed: number;
  remaining: number;
  stopped: boolean;
};

export type SmartNudgeKind =
  | "browse_nudge"
  | "timed_nudge"
  | "category_nudge"
  | "cart_nudge"
  | "exit_intent"
  | "scroll_search"
  | "scroll_category"
  | "scroll_bottom"
  | "drink_pairing"
  | "dessert_nudge"
  | "slow_kitchen";

export type NudgeAbVariant = "A" | "B";

export const FAST_SCROLL_PX_PER_SEC = 900;
export const SLOW_CATEGORY_DWELL_MS = 4_000;
export const SCROLL_BOTTOM_THRESHOLD_PX = 48;
export const TIMED_NUDGE_MINUTES = 2;
export const CART_NUDGE_MINUTES = 5;
export const CATEGORY_NUDGE_ITEM_THRESHOLD = 3;
export const CLIENT_NUDGE_BUDGET_MAX = 3;
export const CLIENT_NUDGE_DISMISS_STOP = 3;

const NUDGE_AB_MESSAGES: Record<
  SmartNudgeKind,
  { A: string; B: string }
> = {
  browse_nudge: {
    A: "Tražite nešto? Mogu pomoći!",
    B: "Treba vam preporuka? Pitajte Denis-a.",
  },
  timed_nudge: {
    A: "Treba vam preporuka? Pitajte Denis-a.",
    B: "Još uvek birate? Mogu predložiti nešto posebno.",
  },
  category_nudge: {
    A: "Naši burgeri su hit danas!",
    B: "Ova kategorija je popularna večeras — probajte nešto odavde.",
  },
  cart_nudge: {
    A: "Spremni za checkout? Vaša korpa čeka.",
    B: "Imate stvari u korpi — završite porudžbinu kad budete spremni.",
  },
  exit_intent: {
    A: "Imate nešto u korpi!",
    B: "Ne zaboravite korpu — završite porudžbinu pre odlaska.",
  },
  scroll_search: {
    A: "Tražite nešto? Mogu pomoći!",
    B: "Brzo listate meni — recite mi šta tražite.",
  },
  scroll_category: {
    A: "Naši burgeri su hit danas!",
    B: "Ova kategorija je popularna — mogu preporučiti nešto.",
  },
  scroll_bottom: {
    A: "Nešto vas zanima? Pitajte me!",
    B: "Pregledali ste meni — šta vam se sviđa?",
  },
  drink_pairing: { A: "", B: "" },
  dessert_nudge: { A: "", B: "" },
  slow_kitchen: { A: "", B: "" },
};

export function classifyScrollVelocity(
  velocityPxPerSec: number
): "fast" | "slow" | "normal" {
  if (velocityPxPerSec >= FAST_SCROLL_PX_PER_SEC) return "fast";
  if (velocityPxPerSec <= 120) return "slow";
  return "normal";
}

export function detectScrollIntentFromSample(input: {
  velocityPxPerSec: number;
  categoryDwellMs: number;
  atBottom: boolean;
  categoryId?: string;
  categoryLabel?: string;
  menuSection?: MenuSection | null;
  now?: number;
}): ScrollSignal | null {
  const now = input.now ?? Date.now();

  if (input.atBottom) {
    return {
      intent: "reached_bottom",
      categoryId: input.categoryId,
      categoryLabel: input.categoryLabel,
      menuSection: toBrowseMenuSection(input.menuSection),
      at: now,
    };
  }

  if (classifyScrollVelocity(input.velocityPxPerSec) === "fast") {
    return {
      intent: "fast_search",
      velocityPxPerSec: input.velocityPxPerSec,
      at: now,
    };
  }

  if (
    input.categoryDwellMs >= SLOW_CATEGORY_DWELL_MS &&
    input.categoryId &&
    input.categoryLabel
  ) {
    return {
      intent: "slow_category",
      categoryId: input.categoryId,
      categoryLabel: input.categoryLabel,
      menuSection: toBrowseMenuSection(input.menuSection),
      dwellMs: input.categoryDwellMs,
      at: now,
    };
  }

  return null;
}

export function scrollSignalToNudgeKind(
  intent: ScrollIntentKind
): Extract<SmartNudgeKind, "scroll_search" | "scroll_category" | "scroll_bottom"> {
  switch (intent) {
    case "fast_search":
      return "scroll_search";
    case "slow_category":
      return "scroll_category";
    case "reached_bottom":
      return "scroll_bottom";
  }
}

export function deriveClientNudgeBudget(input: {
  shown: number;
  dismissed: number;
  max?: number;
}): ClientNudgeBudget {
  const max = input.max ?? CLIENT_NUDGE_BUDGET_MAX;
  const stopped = input.dismissed >= CLIENT_NUDGE_DISMISS_STOP;
  const spent = Math.max(input.shown, input.dismissed);
  const remaining = stopped ? 0 : Math.max(0, max - spent);

  return {
    max,
    shown: input.shown,
    dismissed: input.dismissed,
    remaining,
    stopped,
  };
}

export function shouldStopClientNudges(dismissedCount: number): boolean {
  return dismissedCount >= CLIENT_NUDGE_DISMISS_STOP;
}

export function canShowClientNudge(input: {
  budget: ClientNudgeBudget;
  dismissKey: string;
  dismissedKeys: Set<string>;
}): boolean {
  if (input.budget.stopped || input.budget.remaining <= 0) return false;
  if (input.dismissedKeys.has(input.dismissKey)) return false;
  return true;
}

/** Stable A/B bucket from session token + nudge kind. */
export function resolveNudgeAbVariant(
  sessionKey: string,
  kind: SmartNudgeKind
): NudgeAbVariant {
  let hash = 2166136261;
  const input = `${sessionKey}:${kind}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2 === 0 ? "A" : "B";
}

export function resolveNudgeMessage(input: {
  kind: SmartNudgeKind;
  sessionKey: string;
  override?: string;
  categoryLabel?: string;
}): { message: string; variant: NudgeAbVariant } {
  if (input.override?.trim()) {
    return { message: input.override, variant: "A" };
  }

  const variant = resolveNudgeAbVariant(input.sessionKey, input.kind);
  const template = NUDGE_AB_MESSAGES[input.kind][variant];
  const message =
    input.kind === "category_nudge" || input.kind === "scroll_category"
      ? input.categoryLabel
        ? template.replace(/burgeri/gi, input.categoryLabel)
        : template
      : template;

  return { message, variant };
}

export type NudgeClickThroughEvent = {
  kind: SmartNudgeKind;
  variant: NudgeAbVariant;
  action: "shown" | "click" | "dismiss";
  at: string;
};

export function buildNudgeClickThroughEvent(input: {
  kind: SmartNudgeKind;
  variant: NudgeAbVariant;
  action: NudgeClickThroughEvent["action"];
  now?: Date;
}): NudgeClickThroughEvent {
  return {
    kind: input.kind,
    variant: input.variant,
    action: input.action,
    at: (input.now ?? new Date()).toISOString(),
  };
}

/** Nudge A/B click-through → Denis browse telemetry. */
export function buildNudgeBrowseTelemetryEvent(
  event: NudgeClickThroughEvent
): BrowseEvent {
  return {
    action: "nudge_interaction",
    nudgeKind: event.kind,
    nudgeVariant: event.variant,
    nudgeAction: event.action,
    categoryPath: [event.kind, event.variant, event.action],
    timestamp: event.at,
  };
}

function toBrowseMenuSection(
  section: MenuSection | null | undefined
): BrowseMenuSection | null {
  if (section === "food" || section === "drinks" || section === "desserts") {
    return section;
  }
  return null;
}

/** Map scroll signal → Denis browse telemetry event. */
export function buildScrollBrowseEvent(input: {
  signal: ScrollSignal;
  now?: Date;
}): BrowseEvent {
  const menuSection = input.signal.menuSection ?? "food";
  const categoryLabel =
    input.signal.categoryLabel ??
    (input.signal.intent === "fast_search"
      ? "search"
      : input.signal.intent === "reached_bottom"
        ? "bottom"
        : "browse");

  return {
    action: "scroll_menu",
    categoryId: input.signal.categoryId,
    categoryPath: [menuSection, categoryLabel],
    menuSection,
    dwellMs: input.signal.dwellMs,
    scrollIntent: input.signal.intent,
    scrollVelocityPxPerSec: input.signal.velocityPxPerSec,
    timestamp: (input.now ?? new Date()).toISOString(),
  };
}

export function categoryViewCountById(
  viewCounts: Map<string, number>,
  productContext: Map<string, { categoryId: string }>
): Map<string, number> {
  const byCategory = new Map<string, number>();
  for (const [productId, count] of viewCounts) {
    const ctx = productContext.get(productId);
    if (!ctx) continue;
    byCategory.set(
      ctx.categoryId,
      (byCategory.get(ctx.categoryId) ?? 0) + count
    );
  }
  return byCategory;
}
