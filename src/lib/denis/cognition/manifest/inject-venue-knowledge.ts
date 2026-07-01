import type { VenueKnowledgeSnapshot } from "@/lib/denis/platform/venue-knowledge-types";

const WEEKDAY_LABELS = [
  "Nedelja",
  "Ponedeljak",
  "Utorak",
  "Sreda",
  "Četvrtak",
  "Petak",
  "Subota",
];

function behaviorInstruction(
  behavior: NonNullable<VenueKnowledgeSnapshot["peakHourProfiles"][number]["behavior"]>
): string {
  const parts: string[] = [];
  if (behavior.shortenReplies) parts.push("kratki odgovori");
  if (behavior.skipUpsell) parts.push("bez upsell-a");
  else if (behavior.upsellLevel === "full") parts.push("puni upsell OK");
  else if (behavior.upsellLevel === "reduced") parts.push("blagi upsell max");
  if (behavior.conversationalTone === "warm_chatty") parts.push("topli razgovor");
  if (behavior.conversationalTone === "concise") parts.push("brzo i jasno");
  return parts.join(", ") || "balansirano";
}

/** Inject venue-specific learned knowledge into Denis prompt (L2 accumulation). */
export function formatVenueKnowledgeBlock(
  snapshot: VenueKnowledgeSnapshot | null | undefined
): string {
  if (!snapshot) return "";

  const lines = ["VENUE KNOWLEDGE (learned, GDPR-safe aggregates):"];
  lines.push(`- retention: ${snapshot.retentionTier} (${snapshot.orderSampleCount} order lines sampled)`);

  const mix = snapshot.tasteProfile.drinkMix;
  const drinkTotal = mix.beer + mix.wine + mix.cocktail + mix.other;
  if (drinkTotal > 0) {
    lines.push(
      `- drink mix: ${mix.beer}% pivo, ${mix.wine}% vino, ${mix.cocktail}% cocktail, ${mix.other}% ostalo`
    );
  }

  for (const [dow, name] of Object.entries(snapshot.tasteProfile.topItemByDow)) {
    const day = WEEKDAY_LABELS[Number(dow)] ?? dow;
    lines.push(`- popular ${day}: ${name}`);
  }

  if (
    snapshot.tasteProfile.weekendDessertLiftPct != null &&
    snapshot.tasteProfile.weekendDessertLiftPct > 0
  ) {
    lines.push(
      `- vikend: +${snapshot.tasteProfile.weekendDessertLiftPct}% više deserta nego radnim danom`
    );
  }

  if (snapshot.languageDistribution.length > 0) {
    const langLine = snapshot.languageDistribution
      .slice(0, 4)
      .map((row) => `${row.sharePct}% ${row.code}`)
      .join(", ");
    lines.push(`- guest languages: ${langLine}`);
    lines.push(
      `- default greeting language: ${snapshot.defaultGreetingLanguage} (${snapshot.languageDistribution[0]?.sharePct ?? 0}% share)`
    );
  }

  const currentPeak = snapshot.peakHourProfiles[0];
  if (currentPeak) {
    const waitPart =
      currentPeak.avgWaitMinutes != null
        ? `, avg wait ${currentPeak.avgWaitMinutes} min`
        : "";
    lines.push(
      `- peak slot ${currentPeak.label}: ${currentPeak.stress}${waitPart} → ${behaviorInstruction(currentPeak.behavior)}`
    );
  }

  for (const pair of snapshot.itemPairLearnings.slice(0, 5)) {
    lines.push(
      `- auto-pair: ${pair.anchorProductName} → ${pair.pairedProductName} (${pair.pairRatePct}% sessions)`
    );
  }

  for (const mod of snapshot.modifierLearnings.slice(0, 3)) {
    lines.push(
      `- proactive ask: ${mod.productName} — ${mod.modifierLabel} (${mod.requestRatePct}% orders)`
    );
  }

  lines.push(
    "- instruction: Use venue taste profile for default recommendations; offer learned pairs proactively; ask learned modifiers before submit."
  );

  return lines.join("\n");
}

export function resolveVenueKnowledgeGreetingLanguage(
  snapshot: VenueKnowledgeSnapshot | null | undefined,
  fallback = "sr"
): string {
  return snapshot?.defaultGreetingLanguage?.trim() || fallback;
}
