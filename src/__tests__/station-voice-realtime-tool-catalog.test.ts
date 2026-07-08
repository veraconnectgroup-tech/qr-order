import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  executeStationVoiceTool,
  isStationVoiceToolName,
  listStationVoiceToolDefinitions,
} from "@/lib/denis/agentic/station-voice-realtime-tool-catalog";

const { answerStationQuestionMock } = vi.hoisted(() => ({
  answerStationQuestionMock: vi.fn(),
}));

vi.mock("@/lib/denis/stations/station-questions", () => ({
  answerStationQuestion: answerStationQuestionMock,
}));

describe("station-voice-realtime-tool-catalog", () => {
  it("lists resolve_station_question as the only tool", () => {
    const tools = listStationVoiceToolDefinitions();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("resolve_station_question");
  });

  it("recognizes only the real tool name", () => {
    expect(isStationVoiceToolName("resolve_station_question")).toBe(true);
    expect(isStationVoiceToolName("delete_all_orders")).toBe(false);
  });

  it("rejects an invalid answer value without calling answerStationQuestion", async () => {
    const result = await executeStationVoiceTool({} as SupabaseClient, {
      questionId: "q1",
      staffId: "staff1",
      args: { answer: "definitely_not_valid" },
    });

    expect(result).toEqual({ ok: false, error: "invalid_answer" });
    expect(answerStationQuestionMock).not.toHaveBeenCalled();
  });

  it("calls answerStationQuestion with a valid eta answer", async () => {
    answerStationQuestionMock.mockResolvedValue({
      ok: true,
      question: { id: "q1", status: "answered" },
    });

    const result = await executeStationVoiceTool({} as SupabaseClient, {
      questionId: "q1",
      staffId: "staff1",
      args: { answer: "eta", etaMinutes: 12 },
    });

    expect(answerStationQuestionMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        questionId: "q1",
        answer: "eta",
        etaMinutes: 12,
        staffId: "staff1",
      }
    );
    expect(result).toEqual({
      ok: true,
      question: { id: "q1", status: "answered" },
    });
  });

  it("passes null etaMinutes when the answer doesn't include one", async () => {
    answerStationQuestionMock.mockResolvedValue({ ok: true, question: {} });

    await executeStationVoiceTool({} as SupabaseClient, {
      questionId: "q1",
      staffId: "staff1",
      args: { answer: "ready" },
    });

    expect(answerStationQuestionMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ answer: "ready", etaMinutes: null })
    );
  });
});
