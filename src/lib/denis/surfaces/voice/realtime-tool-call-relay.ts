import type { DenisRealtimeConnection } from "@/lib/denis/surfaces/voice/realtime-webrtc-connection";

/**
 * A Realtime session running over WebRTC talks directly browser<->OpenAI —
 * our server is never in that loop by default. When the model wants to
 * call a tool, it tells the browser over the data channel; the browser
 * must fetch the real result from our server and hand it back. This is
 * that relay, shared by every Realtime surface (owner-voice, station-voice)
 * instead of each one reimplementing the same OpenAI event protocol.
 */

type RealtimeServerEvent = {
  type?: string;
  response?: {
    output?: Array<{
      type?: string;
      call_id?: string;
      name?: string;
      arguments?: string;
    }>;
  };
};

export type ToolCallRelayOptions = {
  /** POST endpoint that executes the tool server-side and returns { data: { result } } or { error }. */
  executeToolUrl: string;
  /** Extra fields merged into every execute-tool POST body alongside toolName/args. */
  extraBody?: Record<string, unknown>;
  onToolCall?: (name: string, args: unknown) => void;
  onToolResult?: (name: string, result: unknown) => void;
  onError?: (error: unknown) => void;
};

/**
 * Attaches a data-channel listener that resolves function_call items from
 * response.done events: executes the tool via executeToolUrl, sends
 * conversation.item.create (function_call_output) + response.create back
 * over the same channel. Returns a cleanup function.
 */
export function attachRealtimeToolCallRelay(
  connection: DenisRealtimeConnection,
  options: ToolCallRelayOptions
): () => void {
  async function handleFunctionCall(call: {
    call_id?: string;
    name?: string;
    arguments?: string;
  }) {
    if (!call.call_id || !call.name) return;

    let args: unknown = {};
    try {
      args = call.arguments ? JSON.parse(call.arguments) : {};
    } catch {
      args = {};
    }

    options.onToolCall?.(call.name, args);

    let output: unknown;
    try {
      const res = await fetch(options.executeToolUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolName: call.name,
          args,
          ...(options.extraBody ?? {}),
        }),
      });
      const body = await res.json().catch(() => null);
      output = res.ok ? (body?.data?.result ?? body?.data ?? null) : { ok: false, error: body?.error ?? `http_${res.status}` };
    } catch (error) {
      options.onError?.(error);
      output = { ok: false, error: "tool_execution_failed" };
    }

    options.onToolResult?.(call.name, output);

    connection.dataChannel.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(output),
        },
      })
    );
    connection.dataChannel.send(JSON.stringify({ type: "response.create" }));
  }

  function onMessage(event: MessageEvent) {
    let data: RealtimeServerEvent;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    if (data.type !== "response.done") return;

    const functionCalls = (data.response?.output ?? []).filter(
      (item) => item.type === "function_call"
    );
    for (const call of functionCalls) {
      void handleFunctionCall(call);
    }
  }

  connection.dataChannel.addEventListener("message", onMessage);
  return () => connection.dataChannel.removeEventListener("message", onMessage);
}
