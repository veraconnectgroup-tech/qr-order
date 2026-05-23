import Link from "next/link";
import { ArrowRight, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingCtaBanner() {
  return (
    <div className="landing-cta-banner relative overflow-hidden rounded-2xl border border-zinc-800 px-6 py-12 text-center sm:px-10 sm:py-16">
      <div className="landing-cta-banner-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="landing-cta-banner-rings pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,rgba(234,88,12,0.14),transparent_70%)]"
        aria-hidden
      />

      <div className="relative z-10">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl border border-orange-500/45 bg-orange-500/10 shadow-[0_0_32px_rgba(234,88,12,0.22)]">
          <ChefHat className="size-7 text-orange-500" strokeWidth={1.75} />
        </div>

        <h2 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-tight tracking-[-0.03em] text-white">
          Your guests are ready. Are you?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed text-zinc-400">
          Join our pilot program — no credit card needed.
        </p>

        <Button
          size="lg"
          asChild
          className="landing-btn-accent mt-8 h-12 rounded-xl px-8 text-[15px] font-semibold"
        >
          <Link href="/signup">
            Request access
            <ArrowRight className="ml-1.5 size-4" />
          </Link>
        </Button>

        <p className="mt-4 text-xs text-zinc-500">🇩🇪 Made in Hamburg</p>
      </div>
    </div>
  );
}
