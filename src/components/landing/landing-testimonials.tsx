import {
  AnimateInView,
  StaggerInView,
  StaggerItem,
} from "@/components/landing/animate-in-view";
import {
  LandingContainer,
  LandingHeadline,
  LandingLead,
} from "@/components/landing/landing-primitives";

const complianceProof = [
  {
    title: "KassenSichV",
    badge: "✓",
    badgeClass: "bg-green-500 text-white",
    description:
      "TSE-backed transaction signing for German fiscal compliance — receipts and audit trail included.",
  },
  {
    title: "DSGVO",
    badge: "EU",
    badgeClass: "bg-blue-600 text-white",
    description:
      "Guest data minimised by design. EU hosting, consent flows, and privacy-first session handling.",
  },
  {
    title: "DATEV export",
    badge: "↗",
    badgeClass: "bg-emerald-600 text-white",
    description:
      "Finance-ready CSV and DATEV-compatible exports — reconcile card payments without manual rework.",
  },
];

export function LandingTestimonials() {
  return (
    <section className="border-t border-zinc-800 bg-zinc-950 py-16 text-white md:py-20">
      <LandingContainer wide>
        <AnimateInView className="mx-auto max-w-[560px] text-center">
          <LandingHeadline inverted>Compliance built in</LandingHeadline>
          <LandingLead inverted className="mt-4">
            German hospitality operators need more than pretty UI — fiscal and
            data requirements are non-negotiable.
          </LandingLead>
        </AnimateInView>

        <StaggerInView className="mt-14 grid gap-4 md:grid-cols-3">
          {complianceProof.map((item) => (
            <StaggerItem
              key={item.title}
              className="landing-glow-border rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${item.badgeClass}`}
                >
                  {item.badge}
                </span>
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                {item.description}
              </p>
            </StaggerItem>
          ))}
        </StaggerInView>
      </LandingContainer>
    </section>
  );
}
