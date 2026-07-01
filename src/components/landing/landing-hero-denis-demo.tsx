"use client";

import { useCallback, useState } from "react";
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
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import { ScaledPhonePreview } from "@/components/landing/scaled-phone-preview";
import { ShowcasePhone } from "@/components/landing/showcase-frame";
import { formatPrice } from "@/lib/format";

type DemoStep = {
  assistant: string;
  user?: string;
  chips?: string[];
  recommendations?: Array<{ name: string; price: number; reason: string }>;
  cartTotal?: number;
  cartCount?: number;
};

const STEPS: Record<"en" | "de" | "sr", DemoStep[]> = {
  en: [
    {
      assistant: "Welcome! What would you like to order?",
      chips: ["Burger & beer", "Something light", "Allergies: gluten-free"],
    },
    {
      assistant: "Great pick — burger pairs well with a cold pilsner. Add both?",
      user: "Burger and a beer",
      recommendations: [
        { name: "Beef Burger", price: 14, reason: "Chef favorite · 12 min" },
        { name: "Pilsner 0.5L", price: 5.5, reason: "Pairs with burger" },
      ],
      cartCount: 2,
      cartTotal: 19.5,
      chips: ["Add to cart", "Just burger"],
    },
    {
      assistant: "Added. Ready to send to the kitchen?",
      user: "Add to cart",
      cartCount: 2,
      cartTotal: 19.5,
      chips: ["Confirm order"],
    },
  ],
  de: [
    {
      assistant: "Willkommen! Was darf es sein?",
      chips: ["Burger & Bier", "Etwas Leichtes", "Allergie: glutenfrei"],
    },
    {
      assistant: "Gute Wahl — Burger passt zum Pils. Beides hinzufügen?",
      user: "Burger und Bier",
      recommendations: [
        { name: "Beef Burger", price: 14, reason: "Chef-Empfehlung · 12 Min" },
        { name: "Pilsner 0,5L", price: 5.5, reason: "Passt zum Burger" },
      ],
      cartCount: 2,
      cartTotal: 19.5,
      chips: ["In den Warenkorb", "Nur Burger"],
    },
    {
      assistant: "Hinzugefügt. Bereit für die Küche?",
      user: "In den Warenkorb",
      cartCount: 2,
      cartTotal: 19.5,
      chips: ["Bestellung bestätigen"],
    },
  ],
  sr: [
    {
      assistant: "Dobro došli! Šta želite da naručite?",
      chips: ["Burger i pivo", "Nešto lagano", "Alergija: bez glutena"],
    },
    {
      assistant: "Odličan izbor — burger ide uz pilsner. Da dodam oba?",
      user: "Burger i pivo",
      recommendations: [
        { name: "Beef Burger", price: 14, reason: "Omiljeno kod kuće · 12 min" },
        { name: "Pilsner 0.5L", price: 5.5, reason: "Ide uz burger" },
      ],
      cartCount: 2,
      cartTotal: 19.5,
      chips: ["Dodaj u korpu", "Samo burger"],
    },
    {
      assistant: "Dodato. Spremni da pošaljete u kuhinju?",
      user: "Dodaj u korpu",
      cartCount: 2,
      cartTotal: 19.5,
      chips: ["Potvrdi narudžbinu"],
    },
  ],
};

function DenisHeroPanel({
  step,
  onChip,
}: {
  step: DemoStep;
  onChip: (label: string) => void;
}) {
  return (
    <DenisPanel className="max-h-none min-h-[420px] rounded-none bg-[var(--qr-void)]">
      <DenisPanelHeader className="border-b border-[var(--qr-elevated)] px-3 py-2.5">
        <DenisTableMark size={24} state="idle" />
        <span className="text-[11px] font-semibold text-[var(--qr-ivory)]">
          Denis
        </span>
        {step.cartCount != null && step.cartTotal != null && (
          <span className="ms-auto rounded-full border border-[var(--qr-ember)]/30 bg-[var(--qr-ember-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--qr-ivory)]">
            {step.cartCount} · {formatPrice(step.cartTotal, "EUR")}
          </span>
        )}
      </DenisPanelHeader>

      <DenisPanelBody className="space-y-3 px-3 py-3">
        <DenisMessageBlock role="assistant">
          <DenisThreadLabel />
          <p className="text-[11px] leading-relaxed text-[var(--qr-ivory)]">
            {step.assistant}
          </p>
          {step.recommendations && (
            <div className="mt-2 divide-y divide-[var(--qr-elevated)]/80">
              {step.recommendations.map((item) => (
                <GuestProductRow
                  key={item.name}
                  name={item.name}
                  price={item.price}
                  currency="EUR"
                  subtitle={item.reason}
                  density="compact"
                  addStyle="icon"
                  addAriaLabel={`Add ${item.name}`}
                  onAdd={() => undefined}
                  className="pointer-events-none"
                />
              ))}
            </div>
          )}
        </DenisMessageBlock>

        {step.user && (
          <DenisMessageBlock role="user" className="[&_p]:text-[11px]">
            {step.user}
          </DenisMessageBlock>
        )}

        {step.chips && (
          <div className="flex flex-wrap gap-2 pt-1">
            {step.chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => onChip(chip)}
                className="rounded-full border border-[var(--qr-elevated)] bg-[var(--qr-surface)] px-3 py-1.5 text-[10px] font-medium text-[var(--qr-ivory)] transition hover:border-[var(--qr-ember)]/50 hover:bg-[var(--qr-ember-muted)]"
              >
                {chip}
              </button>
            ))}
          </div>
        )}
      </DenisPanelBody>

      <DenisPanelFooter className="border-t border-[var(--qr-elevated)] px-3 py-2">
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

/** Interactive Denis chat preview for landing hero. */
export function LandingHeroDenisDemo() {
  const { locale, copy } = useLandingCopy();
  const steps = STEPS[locale] ?? STEPS.en;
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[Math.min(stepIndex, steps.length - 1)]!;

  const advance = useCallback(() => {
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }, [steps.length]);

  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
        {copy.hero.demoLabel}
      </p>
      <ShowcasePhone hideLabel className="max-w-none shadow-2xl shadow-black/40">
        <ScaledPhonePreview designWidth={280} designHeight={480}>
          <DenisHeroPanel step={step} onChip={() => advance()} />
        </ScaledPhonePreview>
      </ShowcasePhone>
    </div>
  );
}
