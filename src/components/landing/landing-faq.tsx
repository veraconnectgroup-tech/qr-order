"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { AnimateInView } from "@/components/landing/animate-in-view";
import {
  LandingContainer,
  LandingEyebrow,
  LandingHeadline,
  LandingLead,
} from "@/components/landing/landing-primitives";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Do guests need to download an app?",
    a: "No. Guests scan a QR code and order in the mobile browser. No account required for ordering.",
  },
  {
    q: "How do you handle payments?",
    a: "Stripe Connect routes card payments to your account. You can also offer pay-in-person options at the bar, counter, or table — configured in settings.",
  },
  {
    q: "Can we run multiple locations?",
    a: "Yes. Organizations support multiple locations, each with zones, tables, menus, and staff roles.",
  },
  {
    q: "What does pricing look like?",
    a: "Standard has no monthly platform fee. You pay a small per-order fee on card payments via Stripe. Enterprise plans include volume pricing and dedicated onboarding.",
  },
  {
    q: "How fast can we go live?",
    a: "Most venues configure menu, tables, and QR codes in a few hours. Stripe Connect onboarding depends on your business verification timeline.",
  },
];

export function LandingFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="scroll-mt-24 border-t border-zinc-800 bg-zinc-950 py-20 text-white sm:py-28"
    >
      <LandingContainer wide>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
          <AnimateInView>
            <LandingEyebrow inverted>FAQ</LandingEyebrow>
            <LandingHeadline inverted className="mt-4">
              Questions operators ask before rollout
            </LandingHeadline>
            <LandingLead inverted className="mt-4">
              Straight answers for owners, GMs, and ops leads evaluating QR
              ordering.
            </LandingLead>
            <a
              href="mailto:hello@qrorder.app"
              className="mt-6 inline-block text-[14px] font-medium text-[var(--lp-accent)] hover:underline"
            >
              Talk to our team →
            </a>
          </AnimateInView>

          <div className="divide-y divide-zinc-800 border-y border-zinc-800">
            {faqs.map((faq, i) => (
              <AnimateInView key={faq.q}>
                <button
                  type="button"
                  onClick={() => setOpen(open === i ? null : i)}
                  className="flex w-full items-start justify-between gap-4 py-5 text-left"
                >
                  <span className="text-[15px] font-medium text-zinc-100">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={cn(
                      "mt-0.5 size-5 shrink-0 text-zinc-500 transition-transform",
                      open === i && "rotate-180"
                    )}
                  />
                </button>
                {open === i && (
                  <p className="pb-5 text-[15px] leading-relaxed text-zinc-400">
                    {faq.a}
                  </p>
                )}
              </AnimateInView>
            ))}
          </div>
        </div>
      </LandingContainer>
    </section>
  );
}
