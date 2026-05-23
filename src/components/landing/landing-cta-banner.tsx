"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingCtaBanner() {
  return (
    <section className="landing-cta-banner relative w-full overflow-hidden border-y border-zinc-800 py-16 text-center sm:py-20">
      <div className="landing-cta-banner-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
        {[0, 1, 2].map((ring) => (
          <div
            key={ring}
            className="landing-cta-ripple absolute size-64 rounded-full border border-orange-500/25"
            style={{ animationDelay: `${ring * 1.2}s` }}
          />
        ))}
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,rgba(234,88,12,0.18),transparent_70%)]"
        aria-hidden
      />

      <div className="relative z-10 px-6">
        <h2 className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-tight tracking-[-0.03em]">
          <span className="landing-gradient-text">
            Your guests are ready. Are you?
          </span>
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed text-zinc-400">
          Join our pilot program — no credit card needed. Go live in under 30
          minutes.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            size="lg"
            asChild
            className="landing-btn-accent h-12 min-w-[200px] rounded-full px-8 text-[15px] font-semibold"
          >
            <Link href="/signup">
              Request access
              <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="h-12 min-w-[200px] rounded-full border-zinc-700 bg-transparent px-8 text-[15px] font-medium text-zinc-200 hover:bg-zinc-900 hover:text-white"
          >
            <Link href="/skyline-lounge/demo-table-8">See live demo</Link>
          </Button>
        </div>

        <p className="mt-5 text-xs text-zinc-500">🇩🇪 Made in Hamburg</p>
      </div>
    </section>
  );
}
