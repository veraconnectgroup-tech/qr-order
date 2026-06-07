import {
  projectNudgeEmittedToCommerce,
  projectNudgeOutcomesToCommerce,
  projectOfferConversionsToCommerce,
} from "@/lib/commerce/projections/project-denis-anticipation";
import type { ProactiveEmittedPayload } from "@/lib/denis/cognition/offer/build-proactive-emitted-payload";
import type { OfferConversionRecord } from "@/lib/denis/cognition/offer/offer-conversion-types";
import type { NudgeOutcomeRecord } from "@/lib/denis/cognition/offer/nudge-outcome-types";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Fire-and-forget Denis → ADR-014 commerce projection (GMM-13 / ADR-039). */
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
    | {
        kind: "nudge_resolved";
        aiSessionId: string;
        tableSessionId?: string;
        traceId?: string;
        outcomes: NudgeOutcomeRecord[];
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

      if (input.kind === "nudge_resolved") {
        if (input.outcomes.length === 0) return;
        await projectNudgeOutcomesToCommerce(admin, {
          aiSessionId: input.aiSessionId,
          tableSessionId: input.tableSessionId,
          traceId: input.traceId,
          outcomes: input.outcomes,
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
