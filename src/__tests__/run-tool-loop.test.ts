import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runToolLoop } from "@/lib/denis/agentic/run-tool-loop";
import { resetAiCircuitBreakerForTests } from "@/lib/ai/openai-client";
import type { DenisTurnContext } from "@/lib/denis/runtime/turn-types";

function chatResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function finalContentResponse(content: string) {
  return chatResponse({
    model: "gpt-4.1",
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  });
}

function toolCallResponse(name: string, args: string, id = "call_1") {
  return chatResponse({
    model: "gpt-4.1",
    choices: [
      {
        message: {
          content: null,
          tool_calls: [{ id, function: { name, arguments: args } }],
        },
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  });
}

const baseCtx = { locationId: "loc_1" } as unknown as DenisTurnContext;

describe("runToolLoop", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    resetAiCircuitBreakerForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves in one round when no tool call is needed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(finalContentResponse("Kitchen is calm tonight."));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runToolLoop({
      messages: [{ role: "user", content: "hi" }],
      executorInput: { admin: {} as never, ctx: baseCtx },
      maxRounds: 3,
    });

    expect(result.finalContent).toBe("Kitchen is calm tonight.");
    expect(result.hitRoundCap).toBe(false);
    expect(result.rounds).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("executes a known tool and feeds the result back for the next round", async () => {
    const ctx = {
      locationId: "loc_1",
      venueOps: {
        stationStress: [
          { station: "kitchen", stress: "busy", activeCount: 4, avgWaitMinutes: 18 },
        ],
      },
    } as unknown as DenisTurnContext;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(toolCallResponse("check_kitchen_status", "{}"))
      .mockResolvedValueOnce(
        finalContentResponse("Kitchen is busy, about 18 minutes out.")
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await runToolLoop({
      messages: [{ role: "user", content: "where is my food" }],
      executorInput: { admin: {} as never, ctx },
      maxRounds: 3,
    });

    expect(result.hitRoundCap).toBe(false);
    expect(result.finalContent).toBe("Kitchen is busy, about 18 minutes out.");
    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0].toolCalls[0]).toMatchObject({
      name: "check_kitchen_status",
      result: { known: true, stress: "busy", avgWaitMinutes: 18 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Second call's message list must include the tool result fed back.
    const [, secondInit] = fetchMock.mock.calls[1];
    const secondBody = JSON.parse((secondInit as RequestInit).body as string);
    const toolMessage = secondBody.messages.find(
      (m: { role: string }) => m.role === "tool"
    );
    expect(toolMessage.tool_call_id).toBe("call_1");
    expect(JSON.parse(toolMessage.content)).toMatchObject({ stress: "busy" });
  });

  it("hits the round cap and returns an honest empty result instead of guessing", async () => {
    // A fresh Response instance per call — Response.json() can only be
    // read once per instance, and this scenario calls fetch repeatedly.
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(toolCallResponse("check_kitchen_status", "{}"))
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await runToolLoop({
      messages: [{ role: "user", content: "hi" }],
      executorInput: { admin: {} as never, ctx: baseCtx },
      maxRounds: 2,
    });

    expect(result.hitRoundCap).toBe(true);
    expect(result.finalContent).toBe("");
    expect(result.rounds).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("records an unknown tool call as a first-class error, never throws", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(toolCallResponse("delete_the_restaurant", "{}"))
      .mockResolvedValueOnce(finalContentResponse("Let me have staff check that."));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runToolLoop({
      messages: [{ role: "user", content: "hi" }],
      executorInput: { admin: {} as never, ctx: baseCtx },
      maxRounds: 3,
    });

    expect(result.rounds[0].toolCalls[0].error).toBe(
      "unknown_tool:delete_the_restaurant"
    );
    expect(result.finalContent).toBe("Let me have staff check that.");
  });

  it("records a real executor failure as a first-class error, never throws or hallucinates success", async () => {
    const throwingAdmin = {
      from: () => {
        throw new Error("db unavailable");
      },
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(toolCallResponse("check_bill", "{}"))
      .mockResolvedValueOnce(finalContentResponse("I can't check the bill right now."));
    vi.stubGlobal("fetch", fetchMock);

    const ctxWithSession = {
      locationId: "loc_1",
      tableSessionState: { session: { id: "session_1" } },
    } as unknown as DenisTurnContext;

    const result = await runToolLoop({
      messages: [{ role: "user", content: "what's my bill" }],
      executorInput: { admin: throwingAdmin as never, ctx: ctxWithSession },
      maxRounds: 3,
    });

    expect(result.rounds[0].toolCalls[0].error).toBe("db unavailable");
    expect(result.rounds[0].toolCalls[0].result).toEqual({ error: "tool_failed" });
    expect(result.finalContent).toBe("I can't check the bill right now.");
  });
});
