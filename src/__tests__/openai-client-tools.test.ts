import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callOpenAiChat,
  resetAiCircuitBreakerForTests,
} from "@/lib/ai/openai-client";
import type { OpenAiToolDefinition } from "@/lib/ai/types";

const CHECK_KITCHEN_TOOL: OpenAiToolDefinition = {
  name: "check_kitchen_status",
  description: "Check current kitchen backlog.",
  parameters: { type: "object", properties: {}, required: [] },
};

function chatResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("callOpenAiChat — ADR-049 tool-calling extension", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    resetAiCircuitBreakerForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("includes tools and tool_choice in the request body when tools are passed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse({
        model: "gpt-4.1",
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await callOpenAiChat([{ role: "user", content: "hi" }], {
      tools: [CHECK_KITCHEN_TOOL],
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.tools).toEqual([
      {
        type: "function",
        function: {
          name: "check_kitchen_status",
          description: "Check current kitchen backlog.",
          parameters: { type: "object", properties: {}, required: [] },
        },
      },
    ]);
    expect(body.tool_choice).toBe("auto");
    expect(body.response_format).toBeUndefined();
  });

  it("omits tools from the request body when none are passed (existing callers unaffected)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse({
        model: "gpt-4.1",
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await callOpenAiChat([{ role: "user", content: "hi" }]);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("parses toolCalls from a tool-call response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse({
        model: "gpt-4.1",
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  function: {
                    name: "check_kitchen_status",
                    arguments: "{}",
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callOpenAiChat([{ role: "user", content: "hi" }], {
      tools: [CHECK_KITCHEN_TOOL],
    });

    expect(result.content).toBe("");
    expect(result.toolCalls).toEqual([
      { id: "call_1", name: "check_kitchen_status", arguments: "{}" },
    ]);
  });

  it("does not throw on empty content when tool_calls are present", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse({
        model: "gpt-4.1",
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                { id: "call_1", function: { name: "check_bill", arguments: "{}" } },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callOpenAiChat([{ role: "user", content: "hi" }], {
        tools: [CHECK_KITCHEN_TOOL],
      })
    ).resolves.not.toThrow();
  });

  it("still throws when both content and tool_calls are empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse({
        model: "gpt-4.1",
        choices: [{ message: { content: "" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callOpenAiChat([{ role: "user", content: "hi" }])
    ).rejects.toThrow("empty response");
  });

  it("serializes a tool-role message with tool_call_id for feeding results back", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse({
        model: "gpt-4.1",
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await callOpenAiChat([
      { role: "user", content: "hi" },
      {
        role: "tool",
        toolCallId: "call_1",
        content: '{"kitchenBacklogMinutes":8}',
      },
    ]);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[1]).toEqual({
      role: "tool",
      tool_call_id: "call_1",
      content: '{"kitchenBacklogMinutes":8}',
    });
  });
});
