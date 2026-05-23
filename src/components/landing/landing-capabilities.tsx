import { AnimateInView } from "@/components/landing/animate-in-view";
import {
  LandingContainer,
  LandingHeadline,
  LandingLead,
} from "@/components/landing/landing-primitives";

const pillars = [
  {
    title: "Guest ordering",
    description:
      "QR menus in the mobile browser. Modifiers, serve sizes, session billing — no app install, no account.",
  },
  {
    title: "Live operations",
    description:
      "Orders board, kitchen display, table sessions, waiter calls, and payment requests in real time.",
  },
  {
    title: "Payments & reporting",
    description:
      "Stripe Connect per venue, in-person and online checkout, analytics, and CSV export for finance.",
  },
  {
    title: "Multi-location",
    description:
      "Organizations, venues, zones, and role-based access — structured for groups, not spreadsheets.",
  },
];

export function LandingCapabilities() {
  return (
    <section className="border-b border-[var(--lp-border)] py-20 sm:py-24">
      <LandingContainer wide>
        <AnimateInView className="max-w-[560px]">
          <LandingHeadline>
            One platform across the full service cycle
          </LandingHeadline>
          <LandingLead className="mt-4">
            From the guest scan to the settled bill — designed together, not
            stitched from separate vendors.
          </LandingLead>
        </AnimateInView>

        <div className="mt-16 grid gap-px border border-[var(--lp-border)] bg-[var(--lp-border)] sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar) => (
            <AnimateInView
              key={pillar.title}
              className="bg-[var(--lp-surface)] p-8 sm:p-9"
            >
              <h3 className="text-[15px] font-medium tracking-[-0.02em] text-[var(--lp-ink)]">
                {pillar.title}
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--lp-muted)]">
                {pillar.description}
              </p>
            </AnimateInView>
          ))}
        </div>
      </LandingContainer>
    </section>
  );
}
