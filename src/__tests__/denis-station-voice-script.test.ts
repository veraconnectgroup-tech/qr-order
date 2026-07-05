import { describe, expect, it } from "vitest";
import { resolveStationVoiceLine } from "@/components/stations/denis-station-voice-script";

describe("resolveStationVoiceLine", () => {
  const question =
    "Sto Table 2 · Bon #3 čeka 6 min bez prihvatanja. Kreće li priprema?";

  it("opens with a full conversational line the first time", () => {
    const line = resolveStationVoiceLine("normal", question, "kitchen");
    expect(line).toContain("kuhinju");
    expect(line).toContain(question);
    expect(line).toContain("gde smo");
  });

  it("apologizes and keeps context when urgent", () => {
    const line = resolveStationVoiceLine("urgent", question, "bar");
    expect(line).toContain("Izvinite");
    expect(line).toContain(question);
  });

  it("stays insistent but still includes the question when critical", () => {
    const line = resolveStationVoiceLine("critical", question, "kitchen");
    expect(line).toContain("hitno");
    expect(line).toContain(question);
  });
});
