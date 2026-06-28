import {
  deriveCheckTier,
  staffCopilotTableRevenueHint,
} from "@/lib/denis/config/revenue-intelligence";
import type { FloorTableHint } from "@/lib/denis/venue/floor/types";
import type { StaffRevenueOpportunity } from "@/lib/denis/venue/copilot/types";
import type { VenueOperatingMode } from "@/lib/denis/venue/ops/types";

function formatCheckEuros(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

/** Denis whisper brief for staff — deterministic, no LLM (M15). */
export function buildStaffTableBrief(input: {
  tableName: string;
  guestTopics: string[];
  cartSummary: string | null;
  guestWaitMinutes: number | null;
  sessionCheckEuros: number | null;
  partySize: number | null;
  operatingHint: FloorTableHint;
  staffHintText: string | null;
  frustrationLevel: "none" | "mild" | "high";
}): string | null {
  const label = input.tableName.trim() || "—";

  if (input.staffHintText?.trim()) {
    return `Sto ${label}: ${input.staffHintText.trim()}`;
  }

  const parts: string[] = [];

  if (input.partySize != null && input.partySize >= 2) {
    parts.push(`${input.partySize} osobe`);
  }

  if (input.guestTopics.length > 0) {
    parts.push(`gost pita za ${input.guestTopics.slice(0, 2).join(", ")}`);
  }

  if (input.cartSummary) {
    parts.push(`cart ima ${input.cartSummary}`);
  }

  if (input.frustrationLevel === "high") {
    parts.push("mental:frustrated");
  } else if (input.frustrationLevel === "mild") {
    parts.push("mental:impatient");
  }

  if (input.guestWaitMinutes != null && input.guestWaitMinutes >= 5) {
    parts.push(`čeka ${input.guestWaitMinutes}min`);
  }

  if (input.sessionCheckEuros != null && input.sessionCheckEuros > 0) {
    const tier = deriveCheckTier(input.sessionCheckEuros);
    if (tier === "high_check") {
      parts.push(
        `visok račun (€${formatCheckEuros(input.sessionCheckEuros)}), verovatno traže desert`
      );
    } else if (tier === "low_check") {
      parts.push(
        `niska potrošnja (€${formatCheckEuros(input.sessionCheckEuros)})`
      );
    }
  } else if (input.operatingHint === "ready_for_dessert") {
    parts.push("verovatno traže desert");
  }

  if (parts.length === 0) return null;
  return `Sto ${label}: ${parts.join(", ")}`;
}

/** Per-table revenue nudge for staff copilot sidebar (M15). */
export function resolveTableRevenueOpportunity(input: {
  tableName: string;
  sessionCheckEuros: number | null;
  operatingHint: FloorTableHint;
  hasActiveSession: boolean;
}): StaffRevenueOpportunity {
  if (!input.hasActiveSession) return null;

  const checkEuros = input.sessionCheckEuros ?? 0;
  if (checkEuros > 0) {
    const hint = staffCopilotTableRevenueHint({
      tableName: input.tableName,
      checkTier: deriveCheckTier(checkEuros),
      checkEuros,
    });
    if (hint) {
      const label = input.tableName.trim() || "—";
      if (deriveCheckTier(checkEuros) === "low_check") {
        return {
          title: `Sto ${label}: niska potrošnja (€${formatCheckEuros(checkEuros)}), nudge za additional food`,
          priority: "normal",
        };
      }
      return { title: hint, priority: "normal" };
    }
  }

  if (input.operatingHint === "ready_for_dessert") {
    const label = input.tableName.trim() || "—";
    return {
      title: `Sto ${label}: desert prilika — ponudi slatko`,
      priority: "normal",
    };
  }

  return null;
}

/** Auto-suggest rush when KDS backlog exceeds venue threshold (M15). */
export function buildRushModeSuggestion(input: {
  operatingMode: VenueOperatingMode;
  kdsBacklogMinutes: number | null;
  autoRushEnabled: boolean;
  autoRushBacklogMinutes: number;
}): string | null {
  if (input.operatingMode === "rush") return null;
  if (!input.autoRushEnabled) return null;
  if (input.kdsBacklogMinutes == null) return null;
  if (input.kdsBacklogMinutes < input.autoRushBacklogMinutes) return null;
  return `Predlažem rush mode, backlog je ${input.kdsBacklogMinutes}min`;
}
