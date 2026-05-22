"use client";

import { ShowcasePhone } from "@/components/landing/showcase-frame";
import { GuestMenuContent } from "@/components/landing/showcase-content";

export function GuestMenuShowcase({ hideLabel = false }: { hideLabel?: boolean }) {
  return (
    <ShowcasePhone
      label="Guest phone — scan & order"
      shortLabel="Guest — menu"
      hideLabel={hideLabel}
    >
      <GuestMenuContent variant="feature" />
    </ShowcasePhone>
  );
}
