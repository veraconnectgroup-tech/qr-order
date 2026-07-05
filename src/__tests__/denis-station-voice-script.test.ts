import { describe, expect, it } from "vitest";
import { resolveStationVoiceLine } from "@/components/stations/denis-station-voice-script";

describe("resolveStationVoiceLine", () => {
  const question = "Sto Table 2 · Bon #3 čeka 6 min bez prihvatanja. Kreće li priprema?";

  it("reads the question as-is the first time", () => {
    expect(resolveStationVoiceLine("normal", question)).toBe(question);
  });

  it("apologizes and repeats the question when urgent", () => {
    const line = resolveStationVoiceLine("urgent", question);
    expect(line).toContain("Izvinjavam se");
    expect(line).toContain(question);
  });

  it("asks if anyone is there when critical, without repeating the raw question", () => {
    const line = resolveStationVoiceLine("critical", question);
    expect(line).toContain("Ima li koga");
    expect(line).not.toContain(question);
  });
});
