import type { EngagementMenuProduct } from "@/lib/denis/retention/guest-engagement-loop";
import {
  menuSectionDisplayLabel,
  type EngagementChannel,
  type EngagementMessage,
  type EngagementTrigger,
} from "@/lib/denis/retention/guest-engagement-loop";
import type { EventConfig } from "@/lib/denis/venue/ops/event-mode";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";

function favoriteItemLabel(guest: GuestMemoryProjection): string | null {
  return guest.lastVisitItemNames[0]?.trim() ?? null;
}

function matchingNewMenuItem(
  guest: GuestMemoryProjection,
  newMenuItems: EngagementMenuProduct[]
): EngagementMenuProduct | null {
  const favoriteIds = new Set(guest.favoriteProductIds);
  const names = guest.lastVisitItemNames.map((name) => name.toLowerCase());

  for (const product of newMenuItems) {
    if (favoriteIds.has(product.id)) return product;
    const productName = product.name.toLowerCase();
    if (names.some((name) => productName.includes(name) || name.includes(productName))) {
      return product;
    }
  }

  return null;
}

function matchingEvent(
  guest: GuestMemoryProjection,
  upcomingEvents: EventConfig[]
): EventConfig | null {
  for (const event of upcomingEvents) {
    const presetIds = event.presetProductIds ?? [];
    if (presetIds.some((id) => guest.favoriteProductIds.includes(id))) {
      return event;
    }
  }
  return upcomingEvents[0] ?? null;
}

/** Build personalized engagement copy — deterministic, no LLM (Q2). */
export function buildEngagementMessage(input: {
  trigger: EngagementTrigger;
  channel: EngagementChannel;
  guest: GuestMemoryProjection;
  newMenuItems?: EngagementMenuProduct[];
  upcomingEvents?: EventConfig[];
  language?: string;
  sentAt?: string;
}): EngagementMessage {
  const lang = (input.language ?? "sr").slice(0, 2).toLowerCase();
  const favorite = favoriteItemLabel(input.guest);
  const sentAt = input.sentAt ?? new Date().toISOString();
  let message = "";
  let personalizedOffer: string | null = null;

  switch (input.trigger) {
    case "weekly_special": {
      const product = matchingNewMenuItem(
        input.guest,
        input.newMenuItems ?? []
      );
      if (product) {
        personalizedOffer = product.name;
        const category = menuSectionDisplayLabel(
          product.menuSection,
          input.guest,
          lang
        );
        message =
          lang === "en"
            ? `New ${category} item: ${product.name} — we think you'll love it.`
            : `Nova ${category} stavka: ${product.name} — mislimo da bi vam se svidela.`;
      } else {
        message =
          lang === "en"
            ? "Something new on the menu we think you'll love."
            : "Novi specijal na meniju — mislimo da će vam se svideti.";
      }
      break;
    }
    case "birthday":
      personalizedOffer =
        lang === "en" ? "Complimentary dessert" : "Desert na naš račun";
      message =
        lang === "en"
          ? "Happy birthday! Dessert is on us 🎂"
          : "Sretan rođendan! Desert na naš račun 🎂";
      break;
    case "win_back":
      personalizedOffer = favorite;
      message =
        lang === "en"
          ? favorite
            ? `We missed you! -10% off your next visit. Your favorite ${favorite} is waiting.`
            : "We missed you! -10% off your next visit."
          : favorite
            ? `Nedostajete nam! -10% na sledeću posetu. Vaš omiljeni ${favorite} vas čeka.`
            : "Nedostajete nam! -10% na sledeću posetu";
      break;
    case "event_invite": {
      const event = matchingEvent(input.guest, input.upcomingEvents ?? []);
      personalizedOffer = event?.name ?? null;
      message =
        lang === "en"
          ? event
            ? `You're invited: ${event.name} — we'd love to see you there.`
            : "A special event is coming up — we'd love to see you."
          : event
            ? `Pozivamo vas: ${event.name} — radujemo se što ćemo vas videti.`
            : "Specijalan događaj uskoro — radujemo se vašoj poseti.";
      break;
    }
    case "loyalty_milestone":
      personalizedOffer =
        lang === "en" ? "House dessert" : "Desert na račun kuće";
      message =
        lang === "en"
          ? `${input.guest.visitCount}th visit — dessert is on the house!`
          : `${input.guest.visitCount}. poseta — desert na račun kuće!`;
      break;
  }

  return {
    trigger: input.trigger,
    channel: input.channel,
    message,
    personalizedOffer,
    sentAt,
  };
}
