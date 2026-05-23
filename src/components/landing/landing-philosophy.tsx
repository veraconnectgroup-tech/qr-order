import { ArrowDown } from "lucide-react";
import {
  AnimateInView,
  StaggerInView,
  StaggerItem,
} from "@/components/landing/animate-in-view";
import { FeatureCheck } from "@/components/landing/feature-visuals";
import {
  LandingContainer,
  LandingEyebrow,
  LandingHeadline,
} from "@/components/landing/landing-primitives";

const problems = [
  "4 tools for orders, kitchen, payments, analytics",
  "Paper tickets lost between bar and kitchen",
  "Guests waiting 10 min just to pay",
];

const solutions = [
  "Unified dashboard — QR scan to DATEV export",
  "Real-time kitchen display with sound alerts",
  "Guests pay at table in 15 seconds",
];

export function LandingPhilosophy() {
  return (
    <section className="border-b border-zinc-800 bg-zinc-950 py-20 sm:py-28">
      <LandingContainer wide>
        <AnimateInView className="mx-auto max-w-[640px] text-center">
          <LandingEyebrow inverted>Why QR Order</LandingEyebrow>
          <LandingHeadline inverted className="mt-4">
            From duct tape to one platform
          </LandingHeadline>
        </AnimateInView>

        <div className="relative mt-14 grid gap-8 lg:grid-cols-[1fr_auto_1fr] lg:items-start lg:gap-6">
          <StaggerInView>
            <StaggerItem className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 sm:p-10">
              <p className="font-display text-xl font-semibold tracking-[-0.02em] text-zinc-300 sm:text-2xl">
                Hospitality runs on duct tape.
              </p>
              <ul className="mt-6 space-y-3">
                {problems.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-[15px] leading-relaxed text-zinc-500"
                  >
                    <span
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-red-500/70"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </StaggerItem>
          </StaggerInView>

          <AnimateInView
            className="flex items-center justify-center py-2 lg:py-16"
            delay={0.1}
          >
            <div className="flex size-12 items-center justify-center rounded-full border border-orange-500/30 bg-orange-500/10 shadow-[0_0_24px_rgba(234,88,12,0.2)]">
              <ArrowDown className="size-5 text-orange-400 lg:rotate-[-90deg]" />
            </div>
          </AnimateInView>

          <StaggerInView>
            <StaggerItem className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/[0.08] to-zinc-900/60 p-8 sm:p-10">
              <p className="font-display text-xl font-semibold tracking-[-0.02em] text-white sm:text-2xl">
                One platform. Zero friction.
              </p>
              <ul className="mt-6 space-y-3">
                {solutions.map((item) => (
                  <FeatureCheck key={item} accent>
                    {item}
                  </FeatureCheck>
                ))}
              </ul>
            </StaggerItem>
          </StaggerInView>
        </div>
      </LandingContainer>
    </section>
  );
}
