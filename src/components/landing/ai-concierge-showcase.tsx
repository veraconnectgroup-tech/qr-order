"use client";

import { Check } from "lucide-react";
import {
  DenisMessageBlock,
  DenisThreadLabel,
} from "@/components/design-system/denis-message-block";
import {
  DenisPanel,
  DenisPanelBody,
  DenisPanelFooter,
  DenisPanelHeader,
} from "@/components/design-system/denis-panel";
import { GuestProductRow } from "@/components/design-system/guest-product-row";
import { DenisTableMark } from "@/components/design-system/denis-table-mark";
import { ShowcasePhone } from "@/components/landing/showcase-frame";
import { formatPrice } from "@/lib/format";

const DEMO_RECOMMENDATIONS = [
  {
    name: "Caesar Salad",
    price: 12.5,
    reason: "Allergen-safe for your selection",
  },
  {
    name: "Grilled Sea Bass",
    price: 24.0,
    reason: "Light option · 18 min prep",
  },
] as const;

/** Static demo row — same primitive as guest menu + Denis chat (DE-04). */
function DenisShowcaseRecommendRow({
  name,
  price,
  reason,
}: {
  name: string;
  price: number;
  reason: string;
}) {
  return (
    <GuestProductRow
      name={name}
      price={price}
      currency="EUR"
      subtitle={reason}
      density="compact"
      addStyle="icon"
      addAriaLabel={`Add ${name}`}
      onAdd={() => undefined}
      className="pointer-events-none"
    />
  );
}

/** Static Denis thread for landing — same panel gramat as guest `ai-concierge-chat` (DE-08). */
function DenisPanelPreview() {
  return (
    <DenisPanel className="max-h-none min-h-[420px] rounded-none bg-[var(--qr-void)]">
      <DenisPanelHeader className="border-b border-[var(--qr-elevated)] px-3 py-2.5 sm:px-3">
        <DenisTableMark size={24} state="idle" />
        <span className="text-[11px] font-semibold text-[var(--qr-ivory)]">
          Denis
        </span>
        <span className="ms-auto rounded-full border border-[var(--qr-ember)]/30 bg-[var(--qr-ember-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--qr-ivory)]">
          2 · {formatPrice(36.5, "EUR")}
        </span>
      </DenisPanelHeader>

      <DenisPanelBody className="space-y-4 px-3 py-3 sm:px-3">
        <DenisMessageBlock role="assistant">
          <DenisThreadLabel />
          <p className="text-[11px] leading-relaxed text-[var(--qr-ivory)]">
            Based on your preferences, here are two options that fit your table.
          </p>
          <div className="mt-2 divide-y divide-[var(--qr-elevated)]/80">
            {DEMO_RECOMMENDATIONS.map((item) => (
              <DenisShowcaseRecommendRow
                key={item.name}
                name={item.name}
                price={item.price}
                reason={item.reason}
              />
            ))}
          </div>
        </DenisMessageBlock>

        <DenisMessageBlock role="user" className="[&_p]:text-[11px]">
          Add the salad and a still water
        </DenisMessageBlock>
      </DenisPanelBody>

      <DenisPanelFooter className="border-t border-[var(--qr-elevated)] px-3 py-2 sm:px-3">
        <div className="flex items-center gap-2 rounded-full border border-[var(--qr-elevated)] bg-[var(--qr-surface)] px-3 py-2">
          <span className="flex-1 text-[10px] text-[var(--qr-muted)]">
            Ask Denis…
          </span>
          <span className="flex size-6 items-center justify-center rounded-full bg-[var(--qr-ember)]">
            <Check className="size-3 text-white" />
          </span>
        </div>
      </DenisPanelFooter>
    </DenisPanel>
  );
}

export function AiConciergeShowcase({
  hideLabel = false,
}: {
  hideLabel?: boolean;
}) {
  return (
    <ShowcasePhone
      label="Guest phone — Denis panel"
      shortLabel="Guest — Denis"
      hideLabel={hideLabel}
    >
      <DenisPanelPreview />
    </ShowcasePhone>
  );
}
