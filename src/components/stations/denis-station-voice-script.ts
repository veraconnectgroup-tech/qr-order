import type { QuestionUrgency } from "@/components/stations/denis-question-strip";

type StationVoiceTarget = "kitchen" | "bar";

function stationLabel(station: StationVoiceTarget): string {
  return station === "kitchen" ? "kuhinju" : "bar";
}

/**
 * What Denis SAYS when a station question appears — full sentences, not a
 * dry card readout. Escalates tone with urgency but always includes context.
 */
export function resolveStationVoiceLine(
  urgency: QuestionUrgency,
  questionMessage: string,
  station: StationVoiceTarget = "kitchen"
): string | null {
  const target = stationLabel(station);

  switch (urgency) {
    case "normal":
      return `Zdravo, javljam vam se u ${target}. ${questionMessage} Možete li mi reći gde smo?`;
    case "urgent":
      return `Izvinite što uznemiravam, znam da je gužva. Ali gost još čeka — ${questionMessage} Molim vas, možete li mi dati informaciju?`;
    case "critical":
      return `Molim vas hitno — gost već predugo čeka. ${questionMessage} Recite mi molim vas, šta je status?`;
    default:
      return null;
  }
}
