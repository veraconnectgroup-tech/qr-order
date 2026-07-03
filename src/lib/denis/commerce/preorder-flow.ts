import type { DenisCartLine } from "@/lib/denis/kernel/cart-projection";
import { isGuestPreorderMessage } from "@/lib/denis/cognition/tde/semantic-intent-router";

export type PreorderCartLine = Pick<
  DenisCartLine,
  "productId" | "productName" | "quantity" | "menuSection" | "notes"
>;

export type PreorderRequest = {
  locationId: string;
  tableId: string | null;
  guestId: string;
  items: PreorderCartLine[];
  scheduledFor: string;
  note: string | null;
  paymentMethod: "online" | "on_arrival";
};

export type PreorderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "cancelled";

export const PREORDER_MIN_ADVANCE_MINUTES = 30;
export const PREORDER_NO_SHOW_GRACE_MINUTES = 30;

/** HH:MM time extraction — format parsing (regex OK). */
const PREORDER_TIME_PATTERN =
  /\b(?:za|u|at|for|um)\s*(\d{1,2})[:.h](\d{2})\b/i;

/** Guest wants food/drinks for a future time — semantic router + time format. */
export function isPreorderIntentMessage(message: string): boolean {
  const text = message.trim();
  if (!text || !PREORDER_TIME_PATTERN.test(text)) return false;
  if (/\b(naru[čc]i|poru[čc]i|ho[ćc]u|[žz]elim)\b/i.test(text)) {
    return true;
  }
  return isGuestPreorderMessage(text);
}

/** Parse HH:MM from guest message into ISO scheduled_for (today or tomorrow). */
export function parsePreorderScheduledTime(
  message: string,
  now = new Date()
): string | null {
  const match = PREORDER_TIME_PATTERN.exec(message.trim());
  if (!match) return null;

  const hours = Number.parseInt(match[1]!, 10);
  const minutes = Number.parseInt(match[2]!, 10);
  if (hours > 23 || minutes > 59) return null;

  const scheduled = new Date(now);
  scheduled.setUTCSeconds(0, 0);
  scheduled.setUTCMilliseconds(0);
  scheduled.setUTCHours(hours, minutes, 0, 0);

  const advanceMs = scheduled.getTime() - now.getTime();
  if (advanceMs < PREORDER_MIN_ADVANCE_MINUTES * 60_000) {
    scheduled.setDate(scheduled.getDate() + 1);
  }

  return scheduled.toISOString();
}

export function shouldCancelPreorderForNoShow(input: {
  status: PreorderStatus;
  sessionId: string | null;
}): boolean {
  if (input.sessionId) return false;
  return input.status === "pending" || input.status === "confirmed";
}

function parseHm(value: string): { hours: number; minutes: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number.parseInt(match[1]!, 10);
  const minutes = Number.parseInt(match[2]!, 10);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

function scheduledLocalMinutes(iso: string): number | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

function venueWindowMinutes(open: string, close: string): {
  openMinutes: number;
  closeMinutes: number;
} | null {
  const openParts = parseHm(open);
  const closeParts = parseHm(close);
  if (!openParts || !closeParts) return null;
  return {
    openMinutes: openParts.hours * 60 + openParts.minutes,
    closeMinutes: closeParts.hours * 60 + closeParts.minutes,
  };
}

/** Kitchen starts prep at scheduledFor − estimated prep minutes (P3 / A2). */
export function computeKitchenReleaseAt(input: {
  scheduledFor: string;
  prepTimeEstimateMinutes: number;
}): string | null {
  const scheduledMs = new Date(input.scheduledFor).getTime();
  if (Number.isNaN(scheduledMs)) return null;
  const prep = Math.max(0, Math.round(input.prepTimeEstimateMinutes));
  return new Date(scheduledMs - prep * 60_000).toISOString();
}

/** Auto-cancel if guest has not arrived by scheduled + grace. */
export function computeNoShowCancelAt(input: {
  scheduledFor: string;
  graceMinutes?: number;
}): string | null {
  const scheduledMs = new Date(input.scheduledFor).getTime();
  if (Number.isNaN(scheduledMs)) return null;
  const grace = input.graceMinutes ?? PREORDER_NO_SHOW_GRACE_MINUTES;
  return new Date(scheduledMs + grace * 60_000).toISOString();
}

export function validatePreorder(input: {
  request: PreorderRequest;
  venueHours: { open: string; close: string };
  unavailableProducts: string[];
  prepTimeEstimate: number;
  now?: number;
}): { valid: boolean; errors: string[]; kitchenReleaseAt?: string; noShowCancelAt?: string } {
  const errors: string[] = [];
  const now = input.now ?? Date.now();
  const scheduledMs = new Date(input.request.scheduledFor).getTime();

  if (Number.isNaN(scheduledMs)) {
    errors.push("invalid_scheduled_for");
  } else {
    const advanceMinutes = (scheduledMs - now) / 60_000;
    if (advanceMinutes < PREORDER_MIN_ADVANCE_MINUTES) {
      errors.push("minimum_30_minutes_advance");
    }

    const window = venueWindowMinutes(
      input.venueHours.open,
      input.venueHours.close
    );
    const localMinutes = scheduledLocalMinutes(input.request.scheduledFor);
    if (window && localMinutes != null) {
      if (localMinutes < window.openMinutes || localMinutes > window.closeMinutes) {
        errors.push("outside_venue_hours");
      }
    }
  }

  if (!input.request.guestId.trim()) {
    errors.push("guest_required");
  }

  if (!input.request.items.length) {
    errors.push("items_required");
  }

  for (const item of input.request.items) {
    if (!item.productId?.trim()) {
      errors.push("invalid_item");
      break;
    }
    if (input.unavailableProducts.includes(item.productId)) {
      errors.push(`unavailable:${item.productName}`);
    }
  }

  if (
    input.request.paymentMethod !== "online" &&
    input.request.paymentMethod !== "on_arrival"
  ) {
    errors.push("invalid_payment_method");
  }

  const kitchenReleaseAt = computeKitchenReleaseAt({
    scheduledFor: input.request.scheduledFor,
    prepTimeEstimateMinutes: input.prepTimeEstimate,
  });
  const noShowCancelAt = computeNoShowCancelAt({
    scheduledFor: input.request.scheduledFor,
  });

  if (!kitchenReleaseAt || !noShowCancelAt) {
    errors.push("invalid_schedule_times");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    kitchenReleaseAt: kitchenReleaseAt!,
    noShowCancelAt: noShowCancelAt!,
  };
}

export function formatPreorderItemsSummary(
  items: PreorderCartLine[],
  language = "sr"
): string {
  const parts = items.map((item) =>
    item.quantity === 1
      ? item.productName
      : `${item.quantity}× ${item.productName}`
  );
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;

  const lang = language.toLowerCase().slice(0, 2);
  if (lang === "de" || lang === "en") {
    return parts.join(", ");
  }

  if (parts.length === 2) {
    return `${parts[0]} i ${parts[1]}`;
  }

  return `${parts.slice(0, -1).join(", ")} i ${parts.at(-1)}`;
}

function formatPreorderClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function buildPreorderConfirmationMessage(input: {
  items: PreorderCartLine[];
  scheduledFor: string;
  prepTimeEstimateMinutes: number;
  language?: string;
}): string {
  const summary = formatPreorderItemsSummary(input.items, input.language);
  const release = computeKitchenReleaseAt({
    scheduledFor: input.scheduledFor,
    prepTimeEstimateMinutes: input.prepTimeEstimateMinutes,
  });
  const scheduledLabel = formatPreorderClock(input.scheduledFor);
  const releaseLabel = release ? formatPreorderClock(release) : "";

  const lang = (input.language ?? "sr").toLowerCase().slice(0, 2);
  if (lang === "de") {
    return `${summary} für ${scheduledLabel}. Küche startet um ${releaseLabel}. Bis gleich!`;
  }
  if (lang === "en") {
    return `${summary} for ${scheduledLabel}. Kitchen starts at ${releaseLabel}. See you soon!`;
  }
  return `${summary} za ${scheduledLabel}. Kuhinja počinje u ${releaseLabel}. Do viđenja!`;
}

export function estimatePreorderPrepMinutes(
  items: PreorderCartLine[],
  prepTimeEstimate: number
): number {
  if (prepTimeEstimate > 0) return prepTimeEstimate;
  const kitchenItems = items.filter((item) => item.menuSection !== "drinks");
  if (kitchenItems.length === 0) return 5;
  return 15;
}
