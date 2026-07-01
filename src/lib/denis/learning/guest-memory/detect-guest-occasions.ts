import type {
  GuestOccasionHint,
  GuestRelationshipSnapshot,
} from "@/lib/denis/platform/guest-memory-types";

const WEEKEND_DOW = [0, 6];
const MILESTONE_VISITS = [3, 5, 10, 25, 50];

export function detectGuestOccasions(input: {
  relationship: GuestRelationshipSnapshot | null | undefined;
  visitCount: number;
  currentPartySize?: number | null;
  currentDayOfWeek?: number;
  now?: Date;
}): GuestOccasionHint[] {
  const occasions: GuestOccasionHint[] = [];
  const relationship = input.relationship;
  const visitCount = input.visitCount;
  const currentDow =
    input.currentDayOfWeek ?? (input.now ?? new Date()).getUTCDay();
  const currentParty = input.currentPartySize ?? null;

  if (MILESTONE_VISITS.includes(visitCount)) {
    occasions.push("visit_milestone");
  }

  if (relationship && currentParty != null && relationship.typicalPartySize != null) {
    if (currentParty >= relationship.typicalPartySize + 2) {
      occasions.push("celebration_larger_party");
    }
  }

  const typicalDays = relationship?.behavioral.typicalVisitDays ?? [];
  if (typicalDays.length > 0) {
    const usuallyWeekend = typicalDays.every((dow) => WEEKEND_DOW.includes(dow));
    const isWeekday = !WEEKEND_DOW.includes(currentDow);
    if (usuallyWeekend && isWeekday) {
      occasions.push("weekday_surprise");
    }
  }

  return occasions;
}

export function formatOccasionHintLine(
  occasion: GuestOccasionHint,
  language = "sr"
): string {
  const lang = language.slice(0, 2);
  switch (occasion) {
    case "celebration_larger_party":
      if (lang === "de") return "Größere Gruppe als üblich — dezent fragen ob Anlass.";
      if (lang === "en") return "Larger party than usual — gently ask if celebrating.";
      return "Više osoba nego obično — pitaj da li slavite nešto 🎉 (jednom, prirodno).";
    case "weekday_surprise":
      if (lang === "de") return "Gast kommt ungewöhnlich unter der Woche — freundlich begrüßen.";
      if (lang === "en") return "Guest usually comes on weekends — nice to see them on a weekday.";
      return "Obično dolazi vikendom — lepo pozdravi i radnim danom.";
    case "visit_milestone":
      if (lang === "de") return "Besuchs-Meilenstein — kurze Wertschätzung, nicht übertreiben.";
      if (lang === "en") return "Visit milestone — brief warm recognition, not over the top.";
      return "Milestone poseta — kratka topla prepoznatljivost, bez preterivanja.";
    default:
      return "";
  }
}
