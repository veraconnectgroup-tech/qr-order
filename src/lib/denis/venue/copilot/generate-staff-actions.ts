import type { FloorTableHint } from "@/lib/denis/venue/floor/types";
import {
  deriveCheckTier,
  staffCopilotTableRevenueHint,
} from "@/lib/denis/config/revenue-intelligence";
import { copilotActionFromStaffHint } from "@/lib/denis/venue/copilot/map-staff-proactive-alert";
import type {
  StaffActionPriority,
  StaffRevenueOpportunity,
} from "@/lib/denis/venue/copilot/types";
import type { VenueOperatingMode } from "@/lib/denis/venue/ops/types";

export type TableWithContext = {
  operatingHint: FloorTableHint;
  openOrderCount: number;
  seatedMinutes: number | null;
  hasActiveSession: boolean;
  operatingMode: VenueOperatingMode;
  guestWaitMinutes: number | null;
  idleMinutes: number | null;
  allOrdersDelivered: boolean;
  minutesSinceLastDelivery: number | null;
  tableName?: string | null;
  staffHintText?: string | null;
  /** Optional venue top dessert for personalized copy. */
  favoriteDessertName?: string | null;
  /** H2 — venue-wide revenue strategy for staff hints. */
  revenueStrategy?: "turnover" | "check_size" | "balanced" | null;
  /** H2 — session check total in EUR for table revenue hints. */
  sessionCheckEuros?: number | null;
};

export type StaffAction = {
  suggestedAction: string;
  actionPriority: StaffActionPriority;
  revenueOpportunity: StaffRevenueOpportunity;
  guestWaitMinutes: number | null;
  estimatedRemainingMinutes: number | null;
};

const DESSERT_ESCALATE_SEATED_MINUTES = 55;

/** Deterministic staff suggestions — 0 LLM (G2). */
export function generateStaffAction(
  table: TableWithContext
): StaffAction | null {
  if (!table.hasActiveSession) return null;

  const frustrationAction = copilotActionFromStaffHint(
    table.tableName?.trim() || "—",
    table.staffHintText
  );
  if (frustrationAction) return frustrationAction;

  const checkEuros = table.sessionCheckEuros ?? 0;
  if (checkEuros > 0) {
    const tableRevenueHint = staffCopilotTableRevenueHint({
      tableName: table.tableName?.trim() || "—",
      checkTier: deriveCheckTier(checkEuros),
      checkEuros,
    });
    if (tableRevenueHint) {
      return {
        suggestedAction: tableRevenueHint,
        actionPriority: "normal",
        revenueOpportunity:
          deriveCheckTier(checkEuros) === "low_check" ? "food" : "dessert",
        guestWaitMinutes: null,
        estimatedRemainingMinutes: null,
      };
    }
  }

  const seated = table.seatedMinutes ?? 0;
  const wait = table.guestWaitMinutes ?? 0;
  const idle = table.idleMinutes ?? 0;
  const sinceDelivery = table.minutesSinceLastDelivery ?? 0;

  if (table.operatingMode === "event") {
    if (table.openOrderCount >= 3) {
      return {
        suggestedAction: "Batch KDS — grupiraj porudžbine za ovaj sto",
        actionPriority: "normal",
        revenueOpportunity: null,
        guestWaitMinutes: null,
        estimatedRemainingMinutes: 15,
      };
    }
    if (table.openOrderCount === 0 && seated >= 5) {
      return {
        suggestedAction: "Event mode — ponudi piće, bez kompleksnog upsella",
        actionPriority: "normal",
        revenueOpportunity: "drinks",
        guestWaitMinutes: null,
        estimatedRemainingMinutes: 20,
      };
    }
  }

  if (
    table.operatingMode === "rush" &&
    seated < 10 &&
    table.openOrderCount === 0
  ) {
    return {
      suggestedAction: "Kratki meni, bez upsell",
      actionPriority: "normal",
      revenueOpportunity: null,
      guestWaitMinutes: null,
      estimatedRemainingMinutes: 20,
    };
  }

  if (table.operatingHint === "needs_attention" && wait >= 15) {
    return {
      suggestedAction: "Ponudi piće dok čekaju kuhinja",
      actionPriority: "urgent",
      revenueOpportunity: "drinks",
      guestWaitMinutes: table.guestWaitMinutes,
      estimatedRemainingMinutes: null,
    };
  }

  if (
    table.revenueStrategy === "check_size" &&
    table.operatingHint === "ready_for_dessert"
  ) {
    const dessert = table.favoriteDessertName?.trim();
    const base = dessert
      ? `Ponudi desert (omiljeni: ${dessert}) — upsell`
      : "Ponudi desert — upsell prioritet";
    return {
      suggestedAction: base,
      actionPriority: "urgent",
      revenueOpportunity: "dessert",
      guestWaitMinutes: null,
      estimatedRemainingMinutes: 15,
    };
  }

  if (table.operatingHint === "ready_for_dessert") {
    const dessert = table.favoriteDessertName?.trim();
    const base = dessert
      ? `Ponudi desert (omiljeni: ${dessert})`
      : "Ponudi desert";
    const escalated = seated >= DESSERT_ESCALATE_SEATED_MINUTES;
    return {
      suggestedAction: escalated ? `${base} — prioritet` : base,
      actionPriority: escalated ? "urgent" : "normal",
      revenueOpportunity: "dessert",
      guestWaitMinutes: null,
      estimatedRemainingMinutes: 15,
    };
  }

  if (
    table.operatingHint === "idle" &&
    idle >= 20 &&
    table.openOrderCount === 0
  ) {
    return {
      suggestedAction: "Provjeri da li trebaju pomoć",
      actionPriority: "normal",
      revenueOpportunity: null,
      guestWaitMinutes: null,
      estimatedRemainingMinutes: null,
    };
  }

  if (table.allOrdersDelivered && table.openOrderCount === 0) {
    if (sinceDelivery >= 30) {
      return {
        suggestedAction: "Ponudi račun",
        actionPriority: "normal",
        revenueOpportunity: null,
        guestWaitMinutes: null,
        estimatedRemainingMinutes: 5,
      };
    }
    if (sinceDelivery >= 10) {
      return {
        suggestedAction: "Pitaj da li je sve OK",
        actionPriority: "fyi",
        revenueOpportunity: null,
        guestWaitMinutes: null,
        estimatedRemainingMinutes: 20,
      };
    }
  }

  return null;
}
