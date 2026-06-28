import type { ResolvedRhythmContext } from "@/lib/denis/config/rhythm-prior-types";

function stressLabel(stress: ResolvedRhythmContext["currentSlotStress"]): string {
  switch (stress) {
    case "rush":
    case "high":
      return "typically rush — keep replies short, no upsell";
    case "busy":
      return "typically busy — concise, light upsell only";
    case "low":
      return "typically slow — warm chat, full upsell OK";
    default:
      return "typically normal — balanced tone";
  }
}

function behaviorInstruction(
  directives: NonNullable<ResolvedRhythmContext["behaviorDirectives"]>
): string {
  const parts: string[] = [];
  if (directives.shortenReplies) {
    parts.push("keep replies short");
  }
  if (directives.skipUpsell) {
    parts.push("no upsell");
  } else if (directives.upsellLevel === "full") {
    parts.push("full upsell OK");
  } else if (directives.upsellLevel === "reduced") {
    parts.push("one gentle upsell max");
  }
  if (directives.conversationalTone === "warm_chatty") {
    parts.push("warm conversational tone");
  }
  return parts.join("; ");
}

/** VENUE RHYTHM block for Situation Pack (C1 — shadow-safe context). */
export function retrieveVenueRhythmEvidence(
  rhythm: ResolvedRhythmContext | null | undefined
): string {
  if (!rhythm?.active) return "";

  const lines = ["VENUE RHYTHM:"];

  if (rhythm.slotLabel) {
    const sessionsPart =
      (rhythm.slotSampleSessions ?? 0) > 0
        ? ` (${rhythm.slotSampleSessions ?? 0} sessions/week in this slot)`
        : "";
    lines.push(
      `- Current slot: ${rhythm.slotLabel} — ${stressLabel(rhythm.currentSlotStress)}${sessionsPart}`
    );
  }

  if (rhythm.typicalSessionMinutes != null) {
    lines.push(`- Avg session: ${rhythm.typicalSessionMinutes} min`);
  }

  if (rhythm.kitchenPrepAvgMinutes != null) {
    const rushPart =
      rhythm.kitchenPrepRushMinutes != null
        ? ` (rush: ${rhythm.kitchenPrepRushMinutes} min)`
        : "";
    lines.push(
      `- Kitchen prep avg: ${rhythm.kitchenPrepAvgMinutes} min${rushPart}`
    );
  }

  if (rhythm.topProductSummaries.length > 0) {
    const popular = rhythm.topProductSummaries
      .map((product) => `${product.name} (${product.sharePct}%)`)
      .join(", ");
    lines.push(`- Popular now: ${popular}`);
    lines.push(
      "- instruction: Use slot top products for personalized recommendations when guest asks what to order."
    );
  }

  if (rhythm.servicePeriod) {
    lines.push(`- Service period: ${rhythm.servicePeriod}`);
  }

  if (rhythm.servicePeriodGreeting) {
    lines.push(`- Period greeting (use once at welcome): ${rhythm.servicePeriodGreeting}`);
  }

  if (rhythm.behaviorDirectives) {
    lines.push(`- Rhythm behavior: ${behaviorInstruction(rhythm.behaviorDirectives)}`);
  }

  if (rhythm.staffSuggestion) {
    lines.push(`- Staffing hint (ops only, do not tell guest): ${rhythm.staffSuggestion}`);
  }

  if (rhythm.mode === "shadow") {
    lines.push("- Rhythm mode: shadow (context only — do not change upsell timing)");
  }

  return lines.length > 1 ? lines.join("\n") : "";
}
