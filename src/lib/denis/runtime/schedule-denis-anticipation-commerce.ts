import {
  projectNudgeEmittedToCommerce,
  projectOfferConversionsToCommerce,
} from "@/lib/commerce/projections/project-denis-anticipation";
import type { ProactiveEmittedPayload } from "@/lib/denis/cognition/offer/build-proactive-emitted-payload";
import type { OfferConversionRecord } from "@/lib/denis/cognition/offer/offer-conversion-types";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Fire-and-forget Denis → ADR-014 commerce projection (GMM-13). */
export function scheduleDenisAnticipationCommerceProjection(
  admin: SupabaseClient,
  input:
    | {
        kind: "nudge";
        aiSessionId: string;
        tableSessionId?: string;
        traceId?: string;
        payload: ProactiveEmittedPayload;
      }
    | {
        kind: "offer_converted";
        aiSessionId: string;
        tableSessionId?: string;
        traceId?: string;
        conversions: OfferConversionRecord[];
      }
): void {
  void (async () => {
    try {
      if (input.kind === "nudge") {
        await projectNudgeEmittedToCommerce(admin, {
          aiSessionId: input.aiSessionId,
          tableSessionId: input.tableSessionId,
          traceId: input.traceId,
          payload: input.payload,
        });
        return;
      }

      if (input.conversions.length === 0) return;

      await projectOfferConversionsToCommerce(admin, {
        aiSessionId: input.aiSessionId,
        tableSessionId: input.tableSessionId,
        traceId: input.traceId,
        conversions: input.conversions,
      });
    } catch (error) {
      logger.warn("scheduleDenisAnticipationCommerceProjection failed", {
        kind: input.kind,
        aiSessionId: input.aiSessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
}
