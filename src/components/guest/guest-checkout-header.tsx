"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { LanguageSelector } from "@/components/guest/language-selector";

export function GuestCheckoutHeader({
  slug,
  token,
}: {
  slug: string;
  token: string;
}) {
  const { tUI } = useAppLocale();

  return (
    <header className="mb-4 flex items-center gap-3 sm:mb-6">
      <Link
        href={`/${slug}/${token}/cart`}
        className="touch-target inline-flex items-center text-zinc-400"
      >
        <ArrowLeft className="size-5" />
      </Link>
      <h1 className="min-w-0 flex-1 text-heading text-zinc-50">
        {tUI("checkout.title")}
      </h1>
      <LanguageSelector compact />
    </header>
  );
}
