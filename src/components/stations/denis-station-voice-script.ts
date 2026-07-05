import type { QuestionUrgency } from "@/components/stations/denis-question-strip";

/**
 * What Denis actually SAYS out loud at each urgency tier, once per tier per
 * question. Never rude — increasingly hard to ignore because a guest is
 * genuinely waiting.
 */
export function resolveStationVoiceLine(
  urgency: QuestionUrgency,
  questionMessage: string
): string | null {
  switch (urgency) {
    case "normal":
      return questionMessage;
    case "urgent":
      return `Izvinjavam se, verovatno ste u gužvi. ${questionMessage}`;
    case "critical":
      return "Zdravo? Ima li koga? Gost čeka, molim vas požurite.";
    default:
      return null;
  }
}
