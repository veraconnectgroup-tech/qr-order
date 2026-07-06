"use client";

import { useRef, useState } from "react";
import { AdminPanel, AdminPanelSection } from "@/components/admin/admin-panel";
import { Button } from "@/components/ui/button";
import {
  connectDenisRealtimeVoice,
  isRealtimeWebRTCSupported,
  type DenisRealtimeConnection,
} from "@/lib/denis/surfaces/voice/realtime-webrtc-connection";

/**
 * Phase 2.8 step 1 connectivity smoke test — NOT the real station-voice
 * flow (that stays on classify/interpret/TTS until the eval gate passes,
 * see the architecture plan). This just proves the WebRTC transport works
 * end to end: mint a token, connect, hear Denis speak one line.
 */
export function DenisRealtimeVoiceTestPanel() {
  const [questionId, setQuestionId] = useState("");
  const [status, setStatus] = useState("idle");
  const [busy, setBusy] = useState(false);
  const connectionRef = useRef<DenisRealtimeConnection | null>(null);

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

      connection.dataChannel.addEventListener("open", () => {
        setStatus("Connected — asking Denis to speak a test line...");
        connection.dataChannel.send(
          JSON.stringify({
            type: "response.create",
            response: {
              output_modalities: ["audio"],
              instructions:
                "Say exactly, in Serbian: 'Zdravo, ja sam Denis. Ovo je test glasa uživo.'",
            },
          })
        );
      });

      connection.dataChannel.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data) as { type?: string };
          if (data.type === "response.done") {
            setStatus("response.done received — did you hear Denis speak?");
          }
          if (data.type === "error") {
            setStatus(`Server error event: ${event.data}`);
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
    connectionRef.current?.close();
    connectionRef.current = null;
    setStatus("Disconnected.");
  }

  return (
    <AdminPanel
      title="Denis Realtime voice — connectivity test"
      description="Phase 2.8 step 1 smoke test only. Requires a real open station question at this location and a configured OPENAI_API_KEY."
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
        </div>
      </AdminPanelSection>
    </AdminPanel>
  );
}
