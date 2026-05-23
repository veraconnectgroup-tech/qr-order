import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimateInView } from "@/components/landing/animate-in-view";
import {
  LandingContainer,
  LandingEyebrow,
  LandingHeadline,
  LandingLead,
} from "@/components/landing/landing-primitives";
import { Button } from "@/components/ui/button";

export function LandingEnterpriseStrip() {
  return (
    <section
      id="enterprise"
      className="scroll-mt-24 border-y border-[var(--lp-border)] bg-[var(--lp-tint)] py-20 sm:py-24"
    >
      <LandingContainer wide>
        <div className="grid items-end gap-10 lg:grid-cols-[1fr_auto] lg:gap-16">
          <AnimateInView className="max-w-[640px]">
            <LandingEyebrow>Enterprise</LandingEyebrow>
            <LandingHeadline className="mt-3">
              Built for hospitality groups
            </LandingHeadline>
            <LandingLead className="mt-4">
              Multi-location governance, structured rollout, volume pricing, and
              dedicated onboarding for hotel F&amp;B, bar groups, and
              high-throughput venues.
            </LandingLead>
          </AnimateInView>
          <AnimateInView>
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-md border-[var(--lp-border)] bg-white px-5 text-sm font-medium"
            >
              <Link href="/enterprise">
                Enterprise overview
                <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
          </AnimateInView>
        </div>
      </LandingContainer>
    </section>
  );
}
