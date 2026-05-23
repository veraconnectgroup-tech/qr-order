"use client";

import Image from "next/image";
import { LOCALE_LABELS, type MenuLocale } from "@/lib/i18n/translations";

export function LanguageSplash({
  menuLocale,
  orgName,
  logoUrl,
  onChoose,
}: {
  menuLocale: MenuLocale;
  orgName: string;
  logoUrl?: string | null;
  onChoose: (english: boolean) => void;
}) {
  const primaryLabel = LOCALE_LABELS[menuLocale];

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#0a0a0a] px-6 text-zinc-50">
      <div className="mb-10 text-center">
        {logoUrl ? (
          <div className="relative mx-auto mb-5 size-20 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <Image
              src={logoUrl}
              alt={orgName}
              fill
              className="object-cover"
              sizes="80px"
            />
          </div>
        ) : (
          <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-3xl font-bold text-orange-500">
            {orgName.charAt(0).toUpperCase()}
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{orgName}</h1>
        <p className="mt-2 text-sm text-zinc-500">Choose your language</p>
      </div>

      <div className="grid w-full max-w-md grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onChoose(false)}
          className="min-h-[4.5rem] rounded-2xl border-2 border-orange-500/60 bg-orange-500/10 px-4 text-xl font-bold text-orange-300 transition hover:border-orange-500 hover:bg-orange-500/20 touch-manipulation"
        >
          {primaryLabel}
        </button>
        <button
          type="button"
          onClick={() => onChoose(true)}
          className="min-h-[4.5rem] rounded-2xl border-2 border-zinc-700 bg-zinc-900 px-4 text-xl font-bold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 touch-manipulation"
        >
          English
        </button>
      </div>
    </div>
  );
}
