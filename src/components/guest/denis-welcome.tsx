"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type WelcomeChip = {
  text: string;
  input: string;
};

export type DenisWelcomeCopy = {
  greeting: string;
  subtitle: string;
  returningGreeting?: string;
  placeholder: string;
};

const WELCOME_COPY: Record<string, DenisWelcomeCopy> = {
  sr: {
    greeting: "Bok! Ja sam Denis.",
    subtitle: "Tvoj AI konobar za večeras. Reci mi šta želiš — naručujem za tebe.",
    returningGreeting: "Denis te pamti 👋",
    placeholder: "Piši slobodno...",
  },
  hr: {
    greeting: "Bok! Ja sam Denis.",
    subtitle: "Tvoj AI konobar za večeras. Reci mi što želiš — naručujem za tebe.",
    returningGreeting: "Denis te pamti 👋",
    placeholder: "Piši slobodno...",
  },
  de: {
    greeting: "Hallo! Ich bin Denis.",
    subtitle: "Dein AI-Kellner für heute Abend. Sag mir, was du möchtest.",
    returningGreeting: "Denis erinnert sich an dich 👋",
    placeholder: "Schreib einfach...",
  },
  en: {
    greeting: "Hi! I'm Denis.",
    subtitle: "Your AI waiter for tonight. Tell me what you'd like — I'll order for you.",
    returningGreeting: "Denis remembers you 👋",
    placeholder: "Type freely...",
  },
};

export const DEFAULT_WELCOME_CHIPS: WelcomeChip[] = [
  { text: "🍺 Dva piva, molim", input: "Dva piva" },
  { text: "📋 Pokaži mi meni", input: "Pokaži meni" },
  { text: "🍽️ Šta preporučuješ?", input: "Šta preporučuješ?" },
];

export function resolveWelcomeCopy(
  locale: string,
  options?: { guestName?: string | null; isReturning?: boolean }
): DenisWelcomeCopy {
  const base = WELCOME_COPY[locale] ?? WELCOME_COPY.en;
  if (options?.isReturning) {
    const name = options.guestName?.trim();
    return {
      ...base,
      greeting: name
        ? `${base.returningGreeting ?? base.greeting}, ${name}`
        : (base.returningGreeting ?? base.greeting),
    };
  }
  return base;
}

export function DenisWelcome({
  locale,
  guestName,
  isReturning,
  chips = DEFAULT_WELCOME_CHIPS,
  onChipSelect,
  className,
}: {
  locale: string;
  guestName?: string | null;
  isReturning?: boolean;
  chips?: WelcomeChip[];
  onChipSelect: (input: string) => void;
  className?: string;
}) {
  const copy = useMemo(
    () => resolveWelcomeCopy(locale, { guestName, isReturning }),
    [guestName, isReturning, locale]
  );

  return (
    <div
      className={cn(
        "animate-in fade-in slide-in-from-bottom-2 space-y-4 duration-200",
        className
      )}
    >
      <div className="text-center">
        <p className="text-lg font-semibold text-guest-text">{copy.greeting}</p>
        <p className="mt-2 text-sm text-guest-text-muted">{copy.subtitle}</p>
      </div>
      <div className="space-y-2">
        {chips.map((chip, index) => (
          <button
            key={chip.text}
            type="button"
            onClick={() => onChipSelect(chip.input)}
            className="animate-in fade-in slide-in-from-bottom-1 w-full rounded-xl border border-guest-border bg-guest-surface px-4 py-3 text-left text-sm text-guest-text transition hover:border-guest-accent/40 hover:bg-guest-surface-raised"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            {chip.text}
          </button>
        ))}
      </div>
    </div>
  );
}
