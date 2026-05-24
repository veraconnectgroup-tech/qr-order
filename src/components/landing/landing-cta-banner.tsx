"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LandingCtaBanner() {
  return (
    <section className="relative overflow-hidden py-16 text-center sm:py-24">
      <div
        className="pointer-events-none absolute inset-x-0 top-[-50%] left-1/2 h-[500px] w-[800px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,var(--lp-accent-glow),transparent_65%)] opacity-50"
        aria-hidden
      />

      <div className="relative z-10 px-6">
        <h2 className="font-display text-[clamp(2rem,4vw,3rem)] leading-[1.1] tracking-[-0.02em]">
          <span className="landing-gradient-text">
            Ihre Gäste sind bereit.
            <br />
            Sind Sie es auch?
          </span>
        </h2>
        <p className="mx-auto mt-4 max-w-[480px] text-[16px] leading-relaxed text-[var(--lp-muted)]">
          Starten Sie unser Pilotprogramm — keine Kreditkarte nötig. In unter 30
          Minuten live.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
          <Button
            size="lg"
            asChild
            className="landing-btn-accent h-[52px] min-w-[200px] rounded-full px-8 text-[15px] font-semibold"
          >
            <Link href="/signup">Kostenlos starten</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="h-[52px] min-w-[200px] rounded-full border-[var(--lp-border)] bg-transparent px-8 text-[15px] font-medium text-[var(--lp-ink)] hover:bg-[var(--lp-surface)]"
          >
            <Link href="/skyline-lounge/demo-table-8">Live-Demo ansehen</Link>
          </Button>
        </div>

        <p className="mt-5 text-[13px] text-[var(--lp-dim)]">🇩🇪 Entwickelt in Hamburg</p>
      </div>
    </section>
  );
}
