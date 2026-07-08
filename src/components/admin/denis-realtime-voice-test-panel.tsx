"use client";

import { useRef, useState } from "react";
import { AdminPanel, AdminPanelSection } from "@/components/admin/admin-panel";
import { Button } from "@/components/ui/button";
import {
  connectDenisRealtimeVoice,
  isRealtimeWebRTCSupported,
  type DenisRealtimeConnection,
} from "@/lib/denis/surfaces/voice/realtime-webrtc-connection";
import { attachRealtimeToolCallRelay } from "@/lib/denis/surfaces/voice/realtime-tool-call-relay";

/**
 * Phase 2.3+ real station-voice Realtime conversation (kitchen/bar staff
 * <-> Denis, two-way, tool-calling wired to answerStationQuestion). Phase
 * 2.8 step 1 was a one-line connectivity smoke test; this is the first
 * real slice. Still admin-only/manual-question-id for now — not yet on
 * the actual kitchen/bar station screens (that's the rollout step, gated
 * behind an eval pass per the architecture plan, not done here).
 */
export function DenisRealtimeVoiceTestPanel() {
  const [questionId, setQuestionId] = useState("");
  const [status, setStatus] = useState("idle");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const connectionRef = useRef<DenisRealtimeConnection | null>(null);
  const relayCleanupRef = useRef<(() => void) | null>(null);

  function appendLog(line: string) {
    setLog((prev) => [...prev.slice(-19), line]);
  }

  async function handleConnect() {
    if (!isRealtimeWebRTCSupported()) {
      setStatus("WebRTC not supported in this browser.");
      return;
    }
    if (!questionId.trim()) {
      setStatus("Paste an open station_questions.id first.");
      return;
    }

    setBusy(true);
    setLog([]);
    setStatus("Requesting ephemeral token...");
    try {
      const tokenRes = await fetch("/api/denis/station-voice/realtime-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: questionId.trim() }),
      });
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok) {
        setStatus(`Token request failed: ${tokenJson.error ?? tokenRes.status}`);
        return;
      }

      setStatus("Connecting WebRTC...");
      const connection = await connectDenisRealtimeVoice(
        tokenJson.data.clientSecret
      );
      connectionRef.current = connection;

      relayCleanupRef.current = attachRealtimeToolCallRelay(connection, {
        executeToolUrl: "/api/denis/station-voice/execute-tool",
        extraBody: { questionId: tokenJson.data.questionId },
        onToolCall: (name, args) =>
          appendLog(`→ Denis called ${name}(${JSON.stringify(args)})`),
        onToolResult: (name, result) =>
          appendLog(`← ${name} result: ${JSON.stringify(result)}`),
        onError: (error) =>
          appendLog(
            `⚠ tool relay error: ${error instanceof Error ? error.message : String(error)}`
          ),
      });

      connection.dataChannel.addEventListener("open", () => {
        setStatus("Connected — listening. Speak to Denis.");
        connection.dataChannel.send(JSON.stringify({ type: "response.create" }));
      });

      connection.dataChannel.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data) as {
            type?: string;
            response?: { output?: Array<{ type?: string }> };
          };
          if (data.type === "response.done") {
            const resolved = (data.response?.output ?? []).some(
              (item) => item.type === "function_call"
            );
            setStatus(
              resolved
                ? "Denis resolved the question — call should be wrapping up."
                : "Denis replied — still listening."
            );
          }
          if (data.type === "error") {
            appendLog(`⚠ server error event: ${event.data}`);
          }
        } catch {
          // ignore — non-JSON or unrelated event
        }
      });
    } catch (error) {
      setStatus(
        `Connection failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setBusy(false);
    }
  }

  function handleDisconnect() {
    relayCleanupRef.current?.();
    relayCleanupRef.current = null;
    connectionRef.current?.close();
    connectionRef.current = null;
    setStatus("Disconnected.");
  }

  return (
    <AdminPanel
      title="Denis Realtime voice — station conversation"
      description="Two-way test: connect, speak naturally, Denis calls resolve_station_question when your answer is clear. Requires a real open station question at this location and a configured OPENAI_API_KEY."
    >
      <AdminPanelSection>
        <div className="space-y-3">
          <input
            className="w-full rounded border border-input bg-transparent px-3 py-2 text-sm"
            placeholder="station_questions.id (open, this location)"
            value={questionId}
            onChange={(event) => setQuestionId(event.target.value)}
          />
          <div className="flex gap-2">
            <Button type="button" onClick={handleConnect} disabled={busy}>
              Connect
            </Button>
            <Button type="button" variant="outline" onClick={handleDisconnect}>
              Disconnect
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{status}</p>
          {log.length > 0 && (
            <pre className="max-h-48 overflow-y-auto rounded bg-muted p-2 text-xs">
              {log.join("\n")}
            </pre>
          )}
        </div>
      </AdminPanelSection>
    </AdminPanel>
  );
}
