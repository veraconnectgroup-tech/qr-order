/** S14 — station asked ≥ this many times yesterday → repeating issue in prep briefing. */
export const REPEATING_STATION_ISSUE_THRESHOLD = 3;

export type PrepBriefingStationQuestionRow = {
  station: "kitchen" | "bar";
};

export function aggregateRepeatingStationIssues(
  questions: PrepBriefingStationQuestionRow[]
): string[] {
  const counts = new Map<"kitchen" | "bar", number>();
  for (const row of questions) {
    counts.set(row.station, (counts.get(row.station) ?? 0) + 1);
  }

  const lines: string[] = [];
  for (const station of ["kitchen", "bar"] as const) {
    const count = counts.get(station) ?? 0;
    if (count < REPEATING_STATION_ISSUE_THRESHOLD) continue;
    const label = station === "kitchen" ? "Kuhinja" : "Bar";
    lines.push(
      `${label} juče ${count}× pitanja od Denis-a — večeras treba pomoć oko odgovora.`
    );
  }
  return lines;
}
