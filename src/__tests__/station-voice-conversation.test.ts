import { describe, expect, it } from "vitest";
import { parseStationQuestionContext } from "@/lib/denis/stations/station-voice-context";
import {
  buildStationVoiceClarifyLine,
  resolveStationVoiceConversationTurn,
} from "@/lib/denis/stations/station-voice-conversation";

describe("station voice conversation", () => {
  const context = parseStationQuestionContext(
    "Sto Table 2 · Bon #3 čeka 394 min bez prihvatanja. Kreće li priprema?",
    "pending_accept",
    "bar"
  );

  it("answers which table when staff asks", () => {
    const turn = resolveStationVoiceConversationTurn({
      context,
      staffTranscript: "koji sto?",
      priorTurns: [],
    });

    expect(turn?.speak).toContain("Sto Table 2");
    expect(turn?.speak).toContain("bon broj 3");
    expect(turn?.continueListening).toBe(true);
    expect(turn?.resolved).toBeNull();
  });

  it("answers which order when staff asks", () => {
    const turn = resolveStationVoiceConversationTurn({
      context,
      staffTranscript: "koji bon",
      priorTurns: [],
    });

    expect(turn?.speak).toMatch(/bon broj 3/i);
    expect(turn?.speak).toMatch(/sto table 2/i);
  });

  it("clarifies with context instead of rigid menu", () => {
    const line = buildStationVoiceClarifyLine(context);
    expect(line).toContain("Sto Table 2");
    expect(line).toContain("bon broj 3");
    expect(line).not.toMatch(/recite samo broj minuta/i);
  });
});
