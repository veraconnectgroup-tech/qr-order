import type { SupabaseClient } from "@supabase/supabase-js";
import type { DenisTurnContext } from "@/lib/denis/runtime/turn-types";
import type { RhythmSlotStress } from "@/lib/denis/config/rhythm-prior-types";
import {
  formatPromoEvidenceBlock,
  guestAskedAboutPromo,
  isProactivePromoTrigger,
  loadActivePromoCodesForLocation,
  markPromoOfferedInSession,
  resolvePromoForGuest,
  wasPromoOfferedInSession,
} from "@/lib/denis/commerce";

export type PromoTurnContext = {
  promoBlock: string | null;
  /** Call after turn when proactive promo was included in evidence. */
  sessionIdForOfferMark: string | null;
  promoCodeToMark: string | null;
};

function cartTotalMajor(ctx: DenisTurnContext): number {
  const lines =
    ctx.aiCartState.draft?.items ??
    ctx.tableSessionState?.commerce.cart.visibleLines ??
    [];
  return lines.reduce((sum, line) => {
    if ("lineTotal" in line && line.lineTotal != null) {
      return sum + Number(line.lineTotal);
    }
    const price = Number(
      "unitPrice" in line
        ? (line as { unitPrice?: number }).unitPrice
        : 0
    );
    const qty = Number(line.quantity ?? 1);
    return sum + price * qty;
  }, 0);
}

function promoStressBucket(
  stress: RhythmSlotStress | null | undefined
): "normal" | "busy" | "rush" {
  if (stress === "rush" || stress === "high") return "rush";
  if (stress === "busy") return "busy";
  return "normal";
}

export async function buildPromoTurnContext(
  admin: SupabaseClient,
  input: {
    ctx: DenisTurnContext;
    guestMessage: string;
    aiSessionId?: string | null;
  }
): Promise<PromoTurnContext> {
  const sessionId =
    input.aiSessionId ??
    input.ctx.draftAiSessionId ??
    input.ctx.aiSessionId ??
    null;

  const cartTotal = cartTotalMajor(input.ctx);
  const now = Date.now();
  const activePromos = await loadActivePromoCodesForLocation(
    admin,
    input.ctx.locationId,
    { now, cartTotal }
  );

  if (!activePromos.length) {
    return {
      promoBlock: null,
      sessionIdForOfferMark: null,
      promoCodeToMark: null,
    };
  }

  const guestAsked = guestAskedAboutPromo(input.guestMessage);
  const promoAlreadyOffered = sessionId
    ? await wasPromoOfferedInSession(sessionId)
    : false;
  const isRush =
    input.ctx.venueOps?.operatingMode === "rush" ||
    input.ctx.venueOps?.kdsStress === "high";

  const memory = input.ctx.guestMemory;
  const resolution = resolvePromoForGuest({
    guestMemory: memory
      ? {
          visitCount: memory.visitCount,
          lastVisitAt: memory.lastVisitAt,
          birthdayMonth: memory.birthdayMonth ?? null,
        }
      : null,
    activePromos,
    cartTotal,
    venueOccupancy: 0.5,
    rhythmPriors: input.ctx.rhythmContext
      ? {
          currentSlotStress:
            promoStressBucket(input.ctx.rhythmContext.currentSlotStress),
          slotSampleSessions:
            input.ctx.rhythmContext.slotSampleSessions ?? 0,
        }
      : null,
    now,
    promoAlreadyOffered,
    guestAskedAboutPromo: guestAsked,
    isRush,
    firstVisit: memory ? memory.visitCount <= 0 : true,
  });

  const promoBlock = formatPromoEvidenceBlock({
    activePromos,
    resolution,
    guestAskedAboutPromo: guestAsked,
    promoAlreadyOffered,
    isRush,
    now,
    cartTotal,
  });

  const proactiveOffer =
    resolution?.eligible &&
    !guestAsked &&
    !promoAlreadyOffered &&
    !isRush &&
    isProactivePromoTrigger(resolution.reason);

  return {
    promoBlock,
    sessionIdForOfferMark: proactiveOffer && sessionId ? sessionId : null,
    promoCodeToMark: proactiveOffer && resolution ? resolution.code : null,
  };
}

export async function finalizePromoOfferMark(
  context: PromoTurnContext
): Promise<void> {
  if (!context.sessionIdForOfferMark || !context.promoCodeToMark) return;
  await markPromoOfferedInSession(
    context.sessionIdForOfferMark,
    context.promoCodeToMark
  );
}
