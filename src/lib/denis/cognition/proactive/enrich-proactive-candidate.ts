import {
  narrateCartRecoveryOffer,
  narrateOffer,
} from "@/lib/denis/cognition/offer/narrate-offer";
import { isCartRecoveryOfferStrategy } from "@/lib/denis/cognition/offer/smart-cart-recovery";
import type { GuestOfferContext } from "@/lib/denis/cognition/offer/offer-types";
import type {
  GuestProactiveNudge,
  GuestProactiveNudgeKind,
} from "@/lib/denis/cognition/proactive/proactive-types";
import type { RankedProactiveCandidate } from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";

function enrichBrowseKindWithOffer(input: {
  offer: GuestOfferContext;
  language?: string | null;
}): { kind: GuestProactiveNudgeKind; message: string } | null {
  if (
    isCartRecoveryOfferStrategy(input.offer.trace.strategy) &&
    input.offer.cartRecovery
  ) {
    const message =
      input.offer.smartRecovery?.message?.trim() ||
      narrateCartRecoveryOffer({
        offer: input.offer,
        language: input.language,
      });
    if (!message) return null;
    return { kind: "cart_recovery", message };
  }

  if (!input.offer.primary || !input.offer.readiness.ready) {
    return null;
  }

  const message = narrateOffer({
    offer: input.offer,
    language: input.language,
  });
  if (!message) return null;

  return { kind: "browse_nudge", message };
}

/** Rank → enrich(offer) — personalized copy or drop generic browse nudge (GMM-10). */
export function enrichProactiveCandidates(input: {
  ranked: RankedProactiveCandidate[];
  offer: GuestOfferContext | null | undefined;
  language?: string | null;
  config: ConciergeConfig;
}): RankedProactiveCandidate[] {
  if (!input.config.proactive.offerEnrich || !input.offer) {
    return input.ranked;
  }

  const enriched: RankedProactiveCandidate[] = [];

  for (const row of input.ranked) {
    if (row.nudge.kind === "cart_recovery") {
      enriched.push(row);
      continue;
    }

    if (row.nudge.kind !== "browse_nudge") {
      enriched.push(row);
      continue;
    }

    const resolved = enrichBrowseKindWithOffer({
      offer: input.offer,
      language: input.language,
    });
    if (!resolved) continue;

    const nudge: GuestProactiveNudge = {
      kind: resolved.kind,
      message: resolved.message,
    };
    enriched.push({ ...row, nudge });
  }

  return enriched;
}
