import type {
  GuestOccasionHint,
  GuestRelationshipSnapshot,
} from "@/lib/denis/platform/guest-memory-types";

const WEEKEND_DOW = [0, 6];
const MILESTONE_VISITS = [3, 5, 10, 25, 50];

function resolveHour(now: Date): number {
  return now.getUTCHours();
}

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
  const now = input.now ?? new Date();
  const currentDow =
    input.currentDayOfWeek ?? now.getUTCDay();
  const currentParty = input.currentPartySize ?? null;
  const hour = resolveHour(now);
  const isEvening = hour >= 17 || hour < 1;
  const isWeekday = !WEEKEND_DOW.includes(currentDow);
  const isLunchWindow = hour >= 11 && hour < 15;

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
    if (usuallyWeekend && isWeekday) {
      occasions.push("weekday_surprise");
    }
  }

  if (currentParty != null && currentParty >= 4) {
    occasions.push("family_dining");
  } else if (currentParty === 2 && isEvening) {
    occasions.push("date_night");
  } else if (
    currentParty != null &&
    currentParty >= 2 &&
    currentParty <= 6 &&
    isWeekday &&
    isLunchWindow
  ) {
    occasions.push("business_meal");
  }

  return occasions;
}

/** Staff / situation-pack hint — how Denis should adapt tone. */
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
    case "date_night":
      if (lang === "de") return "Zweier-Tisch am Abend — ruhiger, eleganter, Wein statt Push.";
      if (lang === "en") return "Date-night table — quieter, elegant tone; wine over hard upsell.";
      return "Dejt večeras — tiši ton, elegantnije, vino umesto agresivnog upsell-a.";
    case "family_dining":
      if (lang === "de") return "Familie / größere Gruppe — schnelle Optionen, kein langer Smalltalk.";
      if (lang === "en") return "Family table — fast options, kid-friendly, minimal upsell noise.";
      return "Porodica / veća grupa — brza hrana, dečji meni, bez gnjavisanja.";
    case "business_meal":
      if (lang === "de") return "Business-Mittag — effizient, keine Upsell-Schleife.";
      if (lang === "en") return "Business lunch — efficient service, no upsell loop.";
      return "Poslovni ručak — efikasno, bez upsell petlje.";
    default:
      return "";
  }
}

/** Guest-visible opener for proactive / return welcome (one line max). */
export function formatOccasionWelcomeOpener(
  occasions: GuestOccasionHint[],
  language = "sr"
): string | null {
  if (occasions.length === 0) return null;

  const lang = language.slice(0, 2);
  const primary =
    occasions.find((row) => row === "celebration_larger_party") ??
    occasions.find((row) => row === "visit_milestone") ??
    occasions[0];

  switch (primary) {
    case "celebration_larger_party":
      if (lang === "de") return "Feiern Sie heute etwas Besonderes?";
      if (lang === "en") return "Are you celebrating something special tonight?";
      return "Slavite nešto posebno večeras?";
    case "visit_milestone":
      if (lang === "de") return "Schön, Sie wiederzusehen!";
      if (lang === "en") return "So good to see you again!";
      return "Drago nam je što ste opet kod nas!";
    case "weekday_surprise":
      if (lang === "de") return "Schön, Sie unter der Woche zu sehen!";
      if (lang === "en") return "Nice to see you on a weekday!";
      return "Lepo vas je videti i radnim danom!";
    case "date_night":
      if (lang === "de") return "Willkommen — ein schöner Abend zu zweit?";
      if (lang === "en") return "Welcome — lovely evening for two?";
      return "Dobro veče — lep večer za dvoje?";
    case "family_dining":
      if (lang === "de") return "Willkommen — wir helfen schnell für die ganze Gruppe.";
      if (lang === "en") return "Welcome — we'll keep things easy for the whole table.";
      return "Dobrodošli — brzo ćemo sve srediti za celu ekipu.";
    case "business_meal":
      if (lang === "de") return "Willkommen — ich halte es kurz und effizient.";
      if (lang === "en") return "Welcome — I'll keep this quick and efficient.";
      return "Dobrodošli — držaću se kratko i efikasno.";
    default:
      return null;
  }
}
