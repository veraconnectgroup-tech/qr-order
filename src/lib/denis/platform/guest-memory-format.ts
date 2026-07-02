import type {
  GuestMemoryProjection,
  GuestOccasionHint,
  GuestPreferencePhase,
  PreferredMealPattern,
} from "@/lib/denis/platform/guest-memory-types";

const MEAL_PATTERN_LABELS: Record<PreferredMealPattern, string> = {
  unknown: "unknown",
  drinks_only: "drinks only",
  main_only: "main only (no starters, no desserts)",
  main_drinks: "main + drinks (no starters, no desserts)",
  main_dessert: "main + dessert",
  starter_main_dessert: "starter + main + dessert",
};

/** Privacy gate — Denis never personalizes without explicit consent. */
export function guestMemoryPersonalizationAllowed(
  memory: GuestMemoryProjection | null | undefined
): boolean {
  return Boolean(memory?.hasMemoryConsent);
}

export function shouldOfferStarter(
  memory: GuestMemoryProjection | null | undefined
): boolean {
  if (!guestMemoryPersonalizationAllowed(memory)) return true;
  const pattern = memory?.preferredMealPattern ?? memory?.relationship?.behavioral.preferredMealPattern;
  if (pattern === "main_only" || pattern === "main_drinks" || pattern === "main_dessert") {
    return false;
  }
  if (memory?.relationship?.behavioral.neverOrdersStarter) return false;
  return true;
}

export function shouldOfferDessert(
  memory: GuestMemoryProjection | null | undefined
): boolean {
  if (!guestMemoryPersonalizationAllowed(memory)) return true;
  const pattern = memory?.preferredMealPattern ?? memory?.relationship?.behavioral.preferredMealPattern;
  if (pattern === "drinks_only" || pattern === "main_only" || pattern === "main_drinks") {
    return false;
  }
  if (memory?.relationship?.behavioral.alwaysOrdersDessert) return true;
  if (pattern === "main_dessert" || pattern === "starter_main_dessert") return true;
  return true;
}

export function formatMealPatternLabel(
  pattern: PreferredMealPattern | null | undefined
): string | null {
  if (!pattern) return null;
  return MEAL_PATTERN_LABELS[pattern] ?? pattern;
}

/** Format avg spend cents for situation pack (major units, rounded). */
export function formatAvgSpendForEvidence(
  avgSpendCents: number | null | undefined
): string | null {
  if (avgSpendCents == null || avgSpendCents <= 0) return null;
  const major = Math.round(avgSpendCents / 100);
  return `~${major.toLocaleString("sr-RS")}`;
}

export function formatAvgSpendEuros(
  avgSpend: number | null | undefined
): string | null {
  if (avgSpend == null || avgSpend <= 0) return null;
  return `€${avgSpend.toFixed(2)}`;
}

function formatOccasionHintLine(
  occasion: GuestOccasionHint,
  language = "sr"
): string {
  const lang = language.slice(0, 2);
  switch (occasion) {
    case "celebration_larger_party":
      if (lang === "de") return "Größere Gruppe — dezent fragen ob Anlass.";
      if (lang === "en") return "Larger party — gently ask if celebrating.";
      return "Više osoba nego obično — pitaj da li slavite nešto (jednom).";
    case "weekday_surprise":
      if (lang === "de") return "Ungewöhnlich unter der Woche — freundlich begrüßen.";
      if (lang === "en") return "Weekday visit (usually weekend) — warm welcome.";
      return "Obično vikendom — lepo pozdravi i radnim danom.";
    case "visit_milestone":
      if (lang === "de") return "Besuchs-Meilenstein — kurze Wertschätzung.";
      if (lang === "en") return "Visit milestone — brief warm recognition.";
      return "Milestone poseta — kratka topla prepoznatljivost.";
    case "date_night":
      if (lang === "de") return "Date night — quieter, elegant; wine over push.";
      if (lang === "en") return "Date night — quieter tone; wine over hard upsell.";
      return "Dejt — tiši ton, elegantnije, vino umesto agresivnog upsell-a.";
    case "family_dining":
      if (lang === "de") return "Family table — fast options, minimal upsell.";
      if (lang === "en") return "Family table — kid-friendly, keep it quick.";
      return "Porodica — brza hrana, dečji meni, bez gnjavisanja.";
    case "business_meal":
      if (lang === "de") return "Business lunch — efficient, no upsell loop.";
      if (lang === "en") return "Business meal — efficient, no upsell loop.";
      return "Poslovni ručak — efikasno, bez upsell petlje.";
    default:
      return "";
  }
}

function preferenceEvolutionChanged(phases: GuestPreferencePhase[]): boolean {
  if (phases.length < 2) return false;
  const first = phases[0]?.dominantItems[0]?.toLowerCase();
  const last = phases[phases.length - 1]?.dominantItems[0]?.toLowerCase();
  return Boolean(first && last && first !== last);
}

function formatPreferenceEvolutionHint(
  phases: GuestPreferencePhase[],
  currentItems: string[],
  language = "sr"
): string | null {
  if (!preferenceEvolutionChanged(phases)) return null;
  const previous = phases[phases.length - 2]?.dominantItems[0];
  const current = currentItems[0] ?? phases[phases.length - 1]?.dominantItems[0];
  if (!previous || !current) return null;

  const lang = language.slice(0, 2);
  if (lang === "de") {
    return `Geschmackswandel: früher ${previous}, jetzt ${current} — neues vorschlagen.`;
  }
  if (lang === "en") {
    return `Taste evolved: ${previous} → ${current} — suggest new fits, don't push old favorite.`;
  }
  return `Prelazak sa ${previous} na ${current} — predloži novo, ne guraj stari favorit.`;
}

export function formatRelativeLastVisit(
  lastVisitAt: string | null | undefined,
  nowMs = Date.now()
): string | null {
  if (!lastVisitAt) return null;
  const ts = new Date(lastVisitAt).getTime();
  if (!Number.isFinite(ts)) return null;

  const days = Math.floor((nowMs - ts) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

function formatBehavioralPatternsBlock(
  memory: GuestMemoryProjection
): string[] {
  const lines: string[] = [];
  const behavioral = memory.relationship?.behavioral;
  if (!behavioral) return lines;

  if (behavioral.typicalVisitDayLabels.length > 0) {
    lines.push(
      `- pattern: usually visits ${behavioral.typicalVisitDayLabels.join(" / ")}`
    );
  }

  const meal = formatMealPatternLabel(behavioral.preferredMealPattern);
  if (meal) {
    lines.push(`- meal_pattern: ${meal}`);
  }

  if (behavioral.neverOrdersStarter) {
    lines.push("- never_offers_starter: guest never orders appetizers — do NOT suggest starters");
  }

  if (behavioral.alwaysOrdersDessert) {
    lines.push("- always_offer_dessert: guest always orders dessert — proactively suggest dessert");
  }

  const avg = formatAvgSpendEuros(behavioral.avgSpendEuros ?? memory.avgSpend);
  if (avg) {
    lines.push(`- avg_spend: ${avg} per visit`);
  }

  return lines;
}

function formatRelationshipTimelineBlock(
  memory: GuestMemoryProjection
): string[] {
  const timeline = memory.relationship?.timeline ?? [];
  if (timeline.length === 0) return [];

  const lines = ["- relationship_timeline:"];
  for (const visit of timeline.slice(-4)) {
    const items = visit.itemNames.join(", ") || "—";
    const gap =
      visit.daysSincePrevious != null
        ? ` (+${visit.daysSincePrevious}d)`
        : "";
    const feedback = visit.feedbackSentiment
      ? `, feedback:${visit.feedbackSentiment}`
      : "";
    lines.push(
      `  visit ${visit.visitNumber}${gap}: ${items}${feedback}`
    );
  }
  return lines;
}

/** GUEST RELATIONSHIP block for situation pack (L2 — consented only). */
export function formatGuestRelationshipBlock(
  memory: GuestMemoryProjection,
  language = "sr"
): string {
  if (!guestMemoryPersonalizationAllowed(memory)) return "";

  const lines = ["GUEST RELATIONSHIP:"];
  lines.push(`- visits: ${memory.visitCount}`);

  if (memory.allergies.length > 0) {
    lines.push(`- allergy: ${memory.allergies.join(", ")}`);
  }

  lines.push(...formatRelationshipTimelineBlock(memory));
  lines.push(...formatBehavioralPatternsBlock(memory));

  const evolution = formatPreferenceEvolutionHint(
    memory.relationship?.preferenceEvolution ?? [],
    memory.relationship?.currentPreferenceItems ?? memory.favoriteItems,
    language
  );
  if (evolution) {
    lines.push(`- taste_evolution: ${evolution}`);
  }

  for (const occasion of memory.occasions ?? []) {
    const hint = formatOccasionHintLine(occasion, language);
    if (hint) lines.push(`- occasion: ${hint}`);
  }

  lines.push(
    "- instruction: Use relationship context naturally once — NEVER say 'I know you like X' unless consented facts are listed above."
  );

  return lines.join("\n");
}

/** GUEST HISTORY block for situation pack (return guests). */
export function formatGuestHistoryBlock(
  memory: GuestMemoryProjection,
  nowMs = Date.now()
): string {
  if (!guestMemoryPersonalizationAllowed(memory)) return "";

  if (memory.relationship) {
    const relationship = formatGuestRelationshipBlock(
      memory,
      memory.language ?? "sr"
    );
    if (relationship) return relationship;
  }

  const lines = ["GUEST HISTORY:"];

  if (memory.visitCount > 0) {
    lines.push(`visits: ${memory.visitCount}`);
  }

  if (memory.favoriteItems.length > 0) {
    lines.push(`favorite: ${memory.favoriteItems.join(", ")}`);
  }

  if (memory.allergies.length > 0) {
    lines.push(`allergy: ${memory.allergies.join(", ")}`);
  }

  const avgSpend = formatAvgSpendEuros(memory.avgSpend);
  if (avgSpend) {
    lines.push(`avg_spend: ${avgSpend}`);
  }

  if (memory.language) {
    lines.push(`language: ${memory.language}`);
  }

  const lastVisit = formatRelativeLastVisit(memory.lastVisit, nowMs);
  if (lastVisit) {
    lines.push(`last_visit: ${lastVisit}`);
  }

  if (memory.mood) {
    lines.push(`mood: ${memory.mood}`);
  }

  if (memory.visitCount > 1 && memory.favoriteItems.length > 0) {
    lines.push(
      `- welcome_back: offer usual (${memory.favoriteItems[0]}) OR something new`
    );
  }

  return lines.join("\n");
}
