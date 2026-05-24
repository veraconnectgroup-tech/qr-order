"use client";

import { useAppLocale } from "@/components/guest/app-locale-provider";
import { Button } from "@/components/ui/button";

export function TablePinReveal({
  tablePin,
  onContinue,
}: {
  tablePin: string;
  onContinue: () => void;
}) {
  const { tUI } = useAppLocale();

  return (
    <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-5 text-center">
      <p className="text-sm font-medium text-orange-200">
        {tUI("session.pinRevealTitle")}
      </p>
      <p className="mt-3 text-4xl font-bold tabular-nums tracking-widest text-orange-50">
        {tablePin}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-orange-200/80">
        {tUI("session.pinRevealHint")}
      </p>
      <Button
        type="button"
        onClick={onContinue}
        className="mt-5 h-12 w-full rounded-xl bg-orange-500 font-bold hover:bg-orange-600"
      >
        {tUI("session.pinRevealContinue")}
      </Button>
    </div>
  );
}
