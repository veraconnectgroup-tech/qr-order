"use client";

import { useAppLocale } from "@/components/guest/app-locale-provider";

export function GuestSkipLink() {
  const { tUI } = useAppLocale();

  return (
    <a
      href="#main-content"
      className="fixed start-4 top-4 z-[100] -translate-y-16 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white opacity-0 transition focus:translate-y-0 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white"
    >
      {tUI("a11y.skipToContent")}
    </a>
  );
}
