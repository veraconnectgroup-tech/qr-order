import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { buildGuestStatusSection } from "@/lib/denis/cognition/context/build-guest-status-section";
import type { OrderFact } from "@/lib/denis/loop/types";
import {
  createStationQuestion,
  getFreshStationAnswer,
} from "@/lib/denis/stations/station-questions";
import { buildStationQuestionMessage } from "@/lib/denis/stations/question-triggers";
import {
  resolveGuestStatusIntel,
  type GuestStatusIntel,
} from "@/lib/denis/stations/resolve-guest-status-intel";
import type { VenueOpsBeliefs } from "@/lib/denis/venue/ops/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GuestStatusInquiryResult = {
  intel: GuestStatusIntel;
  section: string | null;
  stationTicketOpened: boolean;
};

/**
 * Phase 1: resolve order + bar/kitchen load.
 * Phase 2: open station ticket only when Denis cannot answer alone.
 * Guest copy always comes from LLM using `section` — never robotic templates here.
 */
export async function processGuestStatusInquiry(
  admin: SupabaseClient,
  input: {
    locationId: string;
    tableId: string;
    tableName: string | null;
    orders: OrderFact[];
    venueOps?: VenueOpsBeliefs | null;
    config: ConciergeConfig;
  }
): Promise<GuestStatusInquiryResult> {
  const settings = input.config.ops.stationQuestions;
  const primary =
    input.orders.find((order) =>
      ["pending", "pending_approval", "accepted", "preparing", "ready"].includes(
        order.status
      )
    ) ?? null;

  const fresh =
    settings.enabled && primary
      ? await getFreshStationAnswer(admin, {
          orderId: primary.id,
          maxAgeMinutes: settings.cooldownMinutes,
        })
      : null;

  const intel = resolveGuestStatusIntel({
    orders: input.orders,
    venueOps: input.venueOps,
    config: input.config,
    freshStationAnswer: fresh,
  });

  let stationTicketOpened = false;

  if (
    settings.enabled &&
    intel.needsStationTicket &&
    intel.primaryOrder &&
    intel.targetStation
  ) {
    const result = await createStationQuestion(admin, {
      locationId: input.locationId,
      orderId: intel.primaryOrder.id,
      tableId: input.tableId,
      station: intel.targetStation,
      questionType: "eta",
      message: buildStationQuestionMessage({
        questionType: "eta",
        station: intel.targetStation,
        tableName: input.tableName ?? "—",
        orderNumber: intel.primaryOrder.orderNumber,
        waitMinutes: intel.waitMinutes,
      }),
      askedBy: "guest_trigger",
      sourceEvent: "guest_ask",
      config: settings,
    });
    stationTicketOpened =
      result.created ||
      (!result.created && result.reason === "already_open");
  }

  return {
    intel,
    section: buildGuestStatusSection(intel),
    stationTicketOpened,
  };
}
