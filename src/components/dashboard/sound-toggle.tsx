"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useSoundAlert } from "@/hooks/use-sound-alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SoundToggle({ className }: { className?: string }) {
  const { enabled, toggle } = useSoundAlert();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "size-9 text-dash-text-muted hover:bg-dash-surface-raised hover:text-dash-text",
        className
      )}
      onClick={toggle}
      aria-label={enabled ? "Mute sounds" : "Enable sounds"}
    >
      {enabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
    </Button>
  );
}
