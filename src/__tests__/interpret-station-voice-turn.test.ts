import { describe, expect, it } from "vitest";
import { classifyStationVoiceReply } from "@/lib/denis/stations/classify-station-voice-reply";
import { interpretStationVoiceTurn } from "@/lib/denis/stations/interpret-station-voice-turn";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";

describe("interpretStationVoiceTurn", () => {
  it("resolves immediately when keywords match", async () => {
    const result = await interpretStationVoiceTurn(
      {
        questionMessage: "Sto 5 · Bon #3 — gost čeka 12 min. Kada je gotovo?",
        questionType: "eta",
        station: "kitchen",
        staffTranscript: "još pet minuta",
        priorTurns: [],
        locationId: "loc-1",
      },
      CONCIERGE_PLATFORM_DEFAULTS
    );

    expect(result.resolved).toEqual({ answer: "eta", etaMinutes: 5 });
    expect(result.continueListening).toBe(false);
    expect(result.speak).toContain("5");
  });

  it("asks for clarification when speech is unclear and LLM is unavailable", async () => {
    const result = await interpretStationVoiceTurn(
      {
        questionMessage: "Sto 5 · Bon #3 čeka 6 min bez prihvatanja. Kreće li priprema?",
        questionType: "pending_accept",
        station: "kitchen",
        staffTranscript: "ne znam sta da kazem mozda sutra",
        priorTurns: [],
        locationId: "loc-1",
      },
      CONCIERGE_PLATFORM_DEFAULTS
    );

    expect(result.resolved).toBeNull();
    expect(result.continueListening).toBe(true);
    expect(result.speak).toContain("Sto 5");
    expect(result.speak).toContain("krećete");
    expect(classifyStationVoiceReply("ne znam sta da kazem", "pending_accept")).toBeNull();
  });

  it("answers staff table question without LLM", async () => {
    const result = await interpretStationVoiceTurn(
      {
        questionMessage:
          "Sto Table 2 · Bon #3 čeka 394 min bez prihvatanja. Kreće li priprema?",
        questionType: "pending_accept",
        station: "bar",
        staffTranscript: "koji sto pricas",
        priorTurns: [],
        locationId: "loc-1",
      },
      CONCIERGE_PLATFORM_DEFAULTS
    );

    expect(result.resolved).toBeNull();
    expect(result.speak).toContain("Sto Table 2");
    expect(result.speak).toContain("bon broj 3");
  });
});
