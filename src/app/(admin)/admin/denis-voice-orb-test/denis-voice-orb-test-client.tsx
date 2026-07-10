"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useMicAudioLevel } from "@/hooks/use-mic-audio-level";

// WebGL/Canvas is browser-only — never render on the server.
const DenisVoiceOrb = dynamic(
  () => import("@/components/denis-voice-orb").then((m) => m.DenisVoiceOrb),
  { ssr: false }
);

const SIZES = [96, 160, 240, 360];

export function DenisVoiceOrbTestClient() {
  const [size, setSize] = useState(240);
  const mic = useMicAudioLevel();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Denis — glasovna sfera (test)
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Uključi mikrofon i pričaj — krug reaguje na pravu jačinu glasa
          (Web Audio API), ne na izmišljenu animaciju.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {SIZES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSize(s)}
            className={`rounded border px-3 py-1.5 text-sm ${
              size === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-muted"
            }`}
          >
            {s}px
          </button>
        ))}

        <div className="ml-auto">
          {mic.active ? (
            <Button type="button" variant="outline" onClick={mic.stop}>
              Isključi mikrofon
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void mic.start()}
              disabled={!mic.supported}
            >
              Uključi mikrofon
            </Button>
          )}
        </div>
      </div>

      {mic.error && <p className="text-sm text-destructive">{mic.error}</p>}
      {!mic.supported && (
        <p className="text-sm text-muted-foreground">
          Mikrofon nije podržan u ovom browseru/kontekstu.
        </p>
      )}

      <div className="flex items-center justify-center rounded-lg bg-black py-16">
        <DenisVoiceOrb size={size} analyserRef={mic.analyserRef} />
      </div>
    </div>
  );
}
