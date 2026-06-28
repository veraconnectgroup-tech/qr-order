import type {
  GuestPreferencePhase,
  GuestRelationshipVisit,
} from "@/lib/denis/platform/guest-memory-types";

const MIN_VISITS_PER_PHASE = 2;

function dominantItemForVisits(visits: GuestRelationshipVisit[]): string | null {
  const counts = new Map<string, number>();
  for (const visit of visits) {
    for (const name of visit.itemNames) {
      const key = name.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top?.[0] ?? null;
}

/** Detect taste evolution across visit phases (e.g. Burger → Salad). */
export function detectPreferenceEvolution(
  timeline: GuestRelationshipVisit[]
): GuestPreferencePhase[] {
  if (timeline.length < MIN_VISITS_PER_PHASE * 2) return [];

  const phases: GuestPreferencePhase[] = [];
  const chunkSize = Math.max(MIN_VISITS_PER_PHASE, Math.floor(timeline.length / 2));
  let start = 0;

  while (start < timeline.length) {
    const end = Math.min(timeline.length, start + chunkSize);
    const slice = timeline.slice(start, end);
    const dominant = dominantItemForVisits(slice);
    if (dominant) {
      phases.push({
        fromVisit: slice[0]!.visitNumber,
        toVisit: slice[slice.length - 1]!.visitNumber,
        dominantItems: [dominant],
      });
    }
    if (end >= timeline.length) break;
    start = end;
  }

  return phases.slice(0, 4);
}

export function preferenceEvolutionChanged(
  phases: GuestPreferencePhase[]
): boolean {
  if (phases.length < 2) return false;
  const first = phases[0]?.dominantItems[0]?.toLowerCase();
  const last = phases[phases.length - 1]?.dominantItems[0]?.toLowerCase();
  return Boolean(first && last && first !== last);
}

export function formatPreferenceEvolutionHint(
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
    return `Geschmackswandel: früher ${previous}, jetzt eher ${current} — neues passendes Gericht vorschlagen, altes nicht pushen.`;
  }
  if (lang === "en") {
    return `Taste evolved: used to order ${previous}, now leaning ${current} — suggest new fits, don't push old favorite.`;
  }
  return `Primijetio sam prelazak sa ${previous} na ${current} — predloži novo (npr. Quinoa Bowl), ne guraj stari favorit.`;
}
