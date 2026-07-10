"use client";

import { useRef, useState } from "react";
import {
  connectDenisRealtimeVoice,
  isRealtimeWebRTCSupported,
  type DenisRealtimeConnection,
} from "@/lib/denis/surfaces/voice/realtime-webrtc-connection";
import { attachRealtimeToolCallRelay } from "@/lib/denis/surfaces/voice/realtime-tool-call-relay";
import { DenisVoicePresenceOrb } from "@/components/design-system/denis-voice-presence-orb";

type CallState = "idle" | "connecting" | "connected" | "error";

/**
 * Staff-initiated call to Denis — the counterpart to DenisQuestionStrip
 * (which is Denis calling staff about one specific open question). This
 * button is always available regardless of whether anything is pending,
 * so staff can ask "how's the kitchen doing" or similar without waiting
 * for Denis to speak up first. Real two-way voice (WebRTC), same
 * transport already proven for the reactive station-voice path — general-
 * purpose read-only tools only, see station-general-voice-tool-catalog.ts.
 */
export function DenisCallButton({
  locationId,
  station,
}: {
  locationId: string;
  station: "kitchen" | "bar";
}) {
  const [state, setState] = useState<CallState>("idle");
  const [statusText, setStatusText] = useState("");
  const connectionRef = useRef<DenisRealtimeConnection | null>(null);
  const relayCleanupRef = useRef<(() => void) | null>(null);

  const supported = isRealtimeWebRTCSupported();

  async function handleCall() {
    setState("connecting");
    setStatusText("Povezujem se sa Denisom…");
    try {
      const tokenRes = await fetch("/api/denis/station-voice/general-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, station }),
      });
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok) {
        setState("error");
        setStatusText(tokenJson.error ?? "Poziv nije uspeo.");
        return;
      }

      const connection = await connectDenisRealtimeVoice(
        tokenJson.data.clientSecret
      );
      connectionRef.current = connection;

      relayCleanupRef.current = attachRealtimeToolCallRelay(connection, {
        executeToolUrl: "/api/denis/station-voice/general-execute-tool",
        extraBody: { locationId },
      });

      connection.dataChannel.addEventListener("open", () => {
        setState("connected");
        setStatusText("Povezan — pričaj sa Denisom.");
      });

      connection.dataChannel.addEventListener("close", () => {
        handleHangUp();
      });
    } catch (error) {
      setState("error");
      setStatusText(
        error instanceof Error ? error.message : "Poziv nije uspeo."
      );
    }
  }

  function handleHangUp() {
    relayCleanupRef.current?.();
    relayCleanupRef.current = null;
    connectionRef.current?.close();
    connectionRef.current = null;
    setState("idle");
    setStatusText("");
  }

  if (!supported) return null;

  if (state === "idle" || state === "error") {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => void handleCall()}
          className="min-h-11 rounded-full border border-orange-500/50 bg-orange-500/15 px-4 text-sm font-semibold text-orange-200 hover:bg-orange-500/25"
        >
          Pozovi Denisa 📞
        </button>
        {state === "error" && statusText ? (
          <p className="text-xs text-red-300">{statusText}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        aria-hidden
      />
      <div className="relative flex h-full flex-col items-center justify-center gap-8 p-4">
        <button
          type="button"
          onClick={handleHangUp}
          aria-label="Prekini poziv"
          className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-xl font-bold text-white/80 hover:bg-white/20"
        >
          ×
        </button>

        <DenisVoicePresenceOrb size={220} moodIntensity={0} speaking={false} />

        <p className="text-sm text-white/80">{statusText}</p>

        <button
          type="button"
          onClick={handleHangUp}
          className="min-h-11 rounded-full border border-red-500/50 bg-red-500/15 px-6 text-sm font-semibold text-red-200 hover:bg-red-500/25"
        >
          Prekini poziv
        </button>
      </div>
    </div>
  );
}
