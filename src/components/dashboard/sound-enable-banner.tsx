"use client";

import { Volume2 } from "lucide-react";
import { useSoundAlert } from "@/hooks/use-sound-alert";
import { Button } from "@/components/ui/button";

export function SoundEnableBanner() {
  const { enabled, enable } = useSoundAlert();

  if (enabled) return null;

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-orange-100">
          Enable alert sounds
        </p>
        <p className="mt-0.5 text-xs text-orange-200/70">
          Hear a chime when a new order or waiter call arrives on this device.
        </p>
      </div>
      <Button
        type="button"
        onClick={enable}
        className="h-9 shrink-0 bg-orange-500 hover:bg-orange-600"
      >
        <Volume2 className="mr-2 size-4" />
        Turn on sounds
      </Button>
    </div>
  );
}
