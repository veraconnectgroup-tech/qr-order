import type { PromoCode } from "@/types";

export type PromoTrigger =
  | "first_visit"
  | "win_back"
  | "high_cart_value"
  | "birthday"
  | "slow_period"
  | "loyalty_reward";

export type PromoEligibility = {
  eligible: boolean;
  code: string;
  discountDisplay: string;
  reason: PromoTrigger;
  message: string;
};

export type PromoGuestMemorySlice = {
  visitCount: number;
  lastVisitAt: string | null;
  /** 1–12 when known from guest profile. */
  birthdayMonth?: number | null;
};

export type PromoRhythmSlice = {
  currentSlotStress: "normal" | "busy" | "rush";
  slotSampleSessions: number;
};

export type ResolvePromoInput = {
  guestMemory: PromoGuestMemorySlice | null;
  activePromos: PromoCode[];
  cartTotal: number;
  venueOccupancy: number;
  rhythmPriors: PromoRhythmSlice | null;
  now: number;
  promoAlreadyOffered: boolean;
  guestAskedAboutPromo: boolean;
  isRush: boolean;
  /** Explicit first-visit signal (visitCount 0 or first session at venue). */
  firstVisit?: boolean;
};

const WIN_BACK_DAYS = 30;
const LOYALTY_MILESTONES = [5, 10, 20] as const;
const HIGH_CART_THRESHOLD = 5000;

export const PROACTIVE_PROMO_TRIGGERS: PromoTrigger[] = [
  "first_visit",
  "win_back",
  "birthday",
  "loyalty_reward",
  "high_cart_value",
  "slow_period",
];

const GUEST_ASKED_PROMO_PATTERN =
  /\b(popust\w*|discount|rabat|promo\w*|promocij\w*|kod|code|gutschein|coupon|voucher)\b/i;

export function guestAskedAboutPromo(message: string): boolean {
  return GUEST_ASKED_PROMO_PATTERN.test(message.trim());
}

export function isProactivePromoTrigger(trigger: PromoTrigger): boolean {
  return PROACTIVE_PROMO_TRIGGERS.includes(trigger);
}

export function isPromoCurrentlyValid(
  promo: PromoCode,
  now: number,
  cartTotal: number
): boolean {
  if (!promo.is_active) return false;

  const fromMs = promo.valid_from
    ? new Date(promo.valid_from).getTime()
    : null;
  if (fromMs != null && Number.isFinite(fromMs) && fromMs > now) return false;

  const untilMs = promo.valid_until
    ? new Date(promo.valid_until).getTime()
    : null;
  if (untilMs != null && Number.isFinite(untilMs) && untilMs < now) return false;

  if (promo.max_uses != null && promo.used_count >= promo.max_uses) return false;

  if (cartTotal > 0 && cartTotal < Number(promo.min_order_amount ?? 0)) {
    return false;
  }

  return true;
}

export function formatPromoDiscountDisplay(promo: PromoCode): string {
  if (promo.discount_type === "percent") {
    return `${promo.discount_value}% popusta`;
  }
  return `${promo.discount_value} popusta`;
}

function inferPromoTrigger(code: string): PromoTrigger | null {
  const upper = code.trim().toUpperCase();
  if (/DOBRODOSLI|WELCOME10|WELCOME|WILLKOMMEN|BIENVENUE/.test(upper)) {
    return "first_visit";
  }
  if (/VRACAMSE|COMEBACK|WINBACK|WILLKOMMEN_ZURUECK/.test(upper)) {
    return "win_back";
  }
  if (/HVALA|THANKS|LOYAL|VIP|NAGRA|VISIT5|VISIT10|VISIT20/.test(upper)) {
    return "loyalty_reward";
  }
  if (/RODJENDAN|BIRTHDAY|GEBURTSTAG/.test(upper)) return "birthday";
  if (/BIGORDER|BIGBASKET|VELIKA/.test(upper)) return "high_cart_value";
  if (/LETO|SUMMER|ZIMA|WINTER|SEASON|SEZON|SLOW/.test(upper)) {
    return "slow_period";
  }
  return null;
}

function daysSince(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor((now - ms) / 86_400_000);
}

function isFirstVisit(
  memory: PromoGuestMemorySlice | null,
  explicit?: boolean
): boolean {
  if (explicit === true) return true;
  if (!memory) return true;
  return memory.visitCount <= 0;
}

function matchesLoyaltyMilestone(visitCount: number): boolean {
  return (LOYALTY_MILESTONES as readonly number[]).includes(visitCount);
}

function matchesTrigger(
  trigger: PromoTrigger,
  input: ResolvePromoInput
): boolean {
  const memory = input.guestMemory;

  switch (trigger) {
    case "first_visit":
      return isFirstVisit(memory, input.firstVisit);
    case "win_back": {
      const days = daysSince(memory?.lastVisitAt ?? null, input.now);
      return days != null && days >= WIN_BACK_DAYS;
    }
    case "loyalty_reward":
      return matchesLoyaltyMilestone(memory?.visitCount ?? 0);
    case "high_cart_value":
      return input.cartTotal >= HIGH_CART_THRESHOLD;
    case "birthday": {
      const month = memory?.birthdayMonth;
      if (month == null) return false;
      return new Date(input.now).getUTCMonth() + 1 === month;
    }
    case "slow_period":
      return shouldOfferSlowPeriodPromo(input);
    default:
      return false;
  }
}

/** Normal slot stress + low occupancy — avoid when rhythm expects traffic. */
export function shouldOfferSlowPeriodPromo(input: ResolvePromoInput): boolean {
  const stress = input.rhythmPriors?.currentSlotStress ?? "normal";
  if (stress !== "normal" || input.isRush) return false;
  if (input.venueOccupancy >= 0.3) return false;
  if (
    (input.rhythmPriors?.slotSampleSessions ?? 0) >= 10 &&
    input.venueOccupancy < 0.3
  ) {
    return false;
  }
  return true;
}

function buildPromoMessage(
  trigger: PromoTrigger,
  code: string,
  discountDisplay: string,
  language = "sr"
): string {
  const lang = language.slice(0, 2).toLowerCase();

  if (trigger === "first_visit") {
    if (lang === "de") {
      return `Willkommen! ${discountDisplay} mit Code ${code}`;
    }
    if (lang === "en") {
      return `Welcome! ${discountDisplay} with code ${code}`;
    }
    return `Dobrodošli! Evo ${discountDisplay}: ${code}`;
  }

  if (trigger === "win_back") {
    if (lang === "de") {
      return `Schön, Sie wiederzusehen! ${discountDisplay}: ${code}`;
    }
    if (lang === "en") {
      return `We missed you! ${discountDisplay}: ${code}`;
    }
    return `Nedostajali ste nam! ${discountDisplay}: ${code}`;
  }

  if (trigger === "birthday") {
    if (lang === "de") {
      return `Alles Gute zum Geburtstag! Dessert gratis — Code ${code}.`;
    }
    if (lang === "en") {
      return `Happy birthday! Free dessert — code ${code}.`;
    }
    return `Sretan rođendan! Desert na poklon! Kod: ${code}`;
  }

  if (trigger === "high_cart_value") {
    if (lang === "de") {
      return `Große Bestellung! ${discountDisplay} ab €50: ${code}`;
    }
    if (lang === "en") {
      return `Big order! ${discountDisplay} on orders over €50: ${code}`;
    }
    return `${discountDisplay} na narudžbine preko €50: ${code}`;
  }

  if (trigger === "loyalty_reward") {
    if (lang === "de") {
      return `Danke für Ihre Treue! ${code} — ${discountDisplay}.`;
    }
    if (lang === "en") {
      return `Thanks for your loyalty! ${code} — ${discountDisplay}.`;
    }
    return `Hvala na lojalnosti! Milestone nagrada ${code} — ${discountDisplay}.`;
  }

  if (lang === "de") {
    return `Aktiver Code: ${code} — ${discountDisplay}.`;
  }
  if (lang === "en") {
    return `Active code: ${code} — ${discountDisplay}.`;
  }
  return `Aktivan kod: ${code} — ${discountDisplay}.`;
}

function canProactivelyOffer(
  trigger: PromoTrigger,
  input: ResolvePromoInput
): boolean {
  if (input.promoAlreadyOffered) return false;
  if (input.isRush) return false;
  if (input.guestAskedAboutPromo) return true;
  return isProactivePromoTrigger(trigger);
}

function promoPriority(trigger: PromoTrigger): number {
  switch (trigger) {
    case "first_visit":
      return 0;
    case "win_back":
      return 1;
    case "birthday":
      return 2;
    case "loyalty_reward":
      return 3;
    case "high_cart_value":
      return 4;
    case "slow_period":
      return 5;
    default:
      return 99;
  }
}

/**
 * Pick at most one promo Denis may mention — never invent codes.
 */
export function resolvePromoForGuest(
  input: ResolvePromoInput
): PromoEligibility | null {
  if (input.isRush && !input.guestAskedAboutPromo) return null;

  const candidates: Array<{
    promo: PromoCode;
    trigger: PromoTrigger;
  }> = [];

  if (input.guestAskedAboutPromo) {
    for (const promo of input.activePromos) {
      if (!isPromoCurrentlyValid(promo, input.now, input.cartTotal)) continue;
      candidates.push({
        promo,
        trigger: inferPromoTrigger(promo.code) ?? "slow_period",
      });
    }
  } else {
    for (const promo of input.activePromos) {
      if (!isPromoCurrentlyValid(promo, input.now, input.cartTotal)) continue;

      const trigger = inferPromoTrigger(promo.code);
      if (!trigger) continue;
      if (!matchesTrigger(trigger, input)) continue;
      if (!canProactivelyOffer(trigger, input)) continue;

      candidates.push({ promo, trigger });
    }
  }

  if (!candidates.length) return null;

  candidates.sort(
    (a, b) => promoPriority(a.trigger) - promoPriority(b.trigger)
  );

  const best = candidates[0]!;
  const discountDisplay = formatPromoDiscountDisplay(best.promo);

  return {
    eligible: true,
    code: best.promo.code,
    discountDisplay,
    reason: best.trigger,
    message: buildPromoMessage(
      best.trigger,
      best.promo.code,
      discountDisplay
    ),
  };
}

export type PromoEvidenceInput = {
  activePromos: PromoCode[];
  resolution: PromoEligibility | null;
  guestAskedAboutPromo: boolean;
  promoAlreadyOffered: boolean;
  isRush: boolean;
  now: number;
  cartTotal: number;
};

/** Situation pack block — verified codes only. */
export function formatPromoEvidenceBlock(input: PromoEvidenceInput): string | null {
  const validPromos = input.activePromos.filter((promo) =>
    isPromoCurrentlyValid(promo, input.now, input.cartTotal)
  );

  if (!validPromos.length && !input.resolution) return null;

  const lines = [
    "PROMO (verified active codes only — NEVER invent a code):",
  ];

  if (input.isRush) {
    lines.push("- Rush mode: do not proactively push promos unless guest asks.");
  }

  if (input.promoAlreadyOffered) {
    lines.push("- Promo already offered this session — do not repeat.");
  }

  for (const promo of validPromos) {
    const trigger = inferPromoTrigger(promo.code) ?? "slow_period";
    const display = formatPromoDiscountDisplay(promo);
    const min = Number(promo.min_order_amount ?? 0);
    lines.push(
      `- ${promo.code}: ${display}${min > 0 ? ` (min ${min})` : ""} [${trigger}]`
    );
  }

  if (input.resolution?.eligible) {
    const proactive =
      !input.guestAskedAboutPromo &&
      !input.promoAlreadyOffered &&
      !input.isRush &&
      isProactivePromoTrigger(input.resolution.reason);

    lines.push(
      `SUGGESTED PROMO: ${input.resolution.code} — ${input.resolution.discountDisplay}`,
      `- trigger: ${input.resolution.reason}`,
      `- guest_line: ${input.resolution.message}`,
      proactive
        ? "- PROACTIVE_OFFER: yes (once, natural tone — not spammy)"
        : input.guestAskedAboutPromo
          ? "- guest asked about discounts: answer with verified code above"
          : "- PROACTIVE_OFFER: no (context only)"
    );
  } else if (input.guestAskedAboutPromo && validPromos.length) {
    lines.push(
      "- Guest asked about discounts: cite a matching verified code if eligible; otherwise say none apply to this order."
    );
  }

  return lines.join("\n");
}

export const PROMO_INTELLIGENCE_CONSTANTS = {
  WIN_BACK_DAYS,
  LOYALTY_MILESTONES,
  HIGH_CART_THRESHOLD,
} as const;
