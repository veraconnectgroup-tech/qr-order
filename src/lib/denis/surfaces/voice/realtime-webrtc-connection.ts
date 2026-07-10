const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export type DenisRealtimeConnection = {
  peerConnection: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  close: () => void;
};

export function isRealtimeWebRTCSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof RTCPeerConnection !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

/**
 * Opens a direct browser-to-OpenAI WebRTC voice session using a
 * server-minted ephemeral client secret (see
 * api/denis/station-voice/realtime-token/route.ts) — the real
 * OPENAI_API_KEY never reaches the browser. Follows OpenAI's documented
 * WebRTC connection steps: local mic track + "oai-events" data channel,
 * SDP offer posted to /v1/realtime/calls, remote answer applied.
 */
export async function connectDenisRealtimeVoice(
  clientSecret: string,
  options?: { onRemoteStream?: (stream: MediaStream) => void }
): Promise<DenisRealtimeConnection> {
  const peerConnection = new RTCPeerConnection();

  const remoteAudio = new Audio();
  remoteAudio.autoplay = true;
  peerConnection.ontrack = (event) => {
    const stream = event.streams[0] ?? null;
    remoteAudio.srcObject = stream;
    if (stream) options?.onRemoteStream?.(stream);
  };

  const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  for (const track of micStream.getTracks()) {
    peerConnection.addTrack(track, micStream);
  }

  const dataChannel = peerConnection.createDataChannel("oai-events");

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  const close = () => {
    for (const track of micStream.getTracks()) track.stop();
    dataChannel.close();
    peerConnection.close();
  };

  const res = await fetch(REALTIME_CALLS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clientSecret}`,
      "Content-Type": "application/sdp",
    },
    body: offer.sdp,
  });

  if (!res.ok) {
    close();
    throw new Error(`realtime_connect_failed (${res.status})`);
  }

  const answerSdp = await res.text();
  await peerConnection.setRemoteDescription({
    type: "answer",
    sdp: answerSdp,
  });

  return { peerConnection, dataChannel, close };
}
