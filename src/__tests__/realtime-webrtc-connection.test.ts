import { afterEach, describe, expect, it, vi } from "vitest";
import { isRealtimeWebRTCSupported } from "@/lib/denis/surfaces/voice/realtime-webrtc-connection";

describe("isRealtimeWebRTCSupported", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is false when RTCPeerConnection is unavailable", () => {
    vi.stubGlobal("RTCPeerConnection", undefined);
    expect(isRealtimeWebRTCSupported()).toBe(false);
  });

  it("is true when RTCPeerConnection and getUserMedia are both available", () => {
    vi.stubGlobal("RTCPeerConnection", class {});
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: () => Promise.resolve() },
    });
    expect(isRealtimeWebRTCSupported()).toBe(true);
  });

  it("is false when getUserMedia is missing even if RTCPeerConnection exists", () => {
    vi.stubGlobal("RTCPeerConnection", class {});
    vi.stubGlobal("navigator", { mediaDevices: {} });
    expect(isRealtimeWebRTCSupported()).toBe(false);
  });
});
