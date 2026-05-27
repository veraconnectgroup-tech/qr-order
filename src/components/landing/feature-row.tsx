"use client";

import { AnimateInView } from "@/components/landing/animate-in-view";
import {
  LandingContainer,
  LandingHeadline,
  LandingLead,
} from "@/components/landing/landing-primitives";
import { cn } from "@/lib/utils";

export function FeatureRow({
  id,
  title,
  lead,
  visual,
  reverse = false,
}: {
  id: string;
  title: string;
  lead: string;
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <section id={id} className="scroll-mt-24 bg-black py-28 text-white md:py-40">
      <LandingContainer wide>
        <div
          className={cn(
            "grid items-center gap-20 lg:grid-cols-2 lg:gap-28",
            reverse && "lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1"
          )}
        >
          <AnimateInView className="max-w-[440px]">
            <LandingHeadline inverted className="text-[clamp(1.75rem,3vw,2.25rem)] leading-[1.15]">
              {title}
            </LandingHeadline>
            <LandingLead inverted className="mt-6 text-[16px] leading-[1.7] text-zinc-500">
              {lead}
            </LandingLead>
          </AnimateInView>

          <AnimateInView delay={0.06} className="min-w-0">
            {visual}
          </AnimateInView>
        </div>
      </LandingContainer>
    </section>
  );
}
