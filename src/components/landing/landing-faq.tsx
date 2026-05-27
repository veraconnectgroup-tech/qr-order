"use client";

import { ChevronDown } from "lucide-react";
import { AnimateInView } from "@/components/landing/animate-in-view";
import {
  LandingContainer,
  LandingHeadline,
  LandingLead,
} from "@/components/landing/landing-primitives";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Is Denis KassenSichV compliant?",
    a: "Yes. Every transaction is signed via a certified TSE. DATEV export is included.",
  },
  {
    q: "Do guests need an app?",
    a: "No. Guests scan a QR code and order in the mobile browser. No download required.",
  },
  {
    q: "How does split bill work?",
    a: "Guests can split by items or evenly. Each person pays their share separately.",
  },
  {
    q: "What does Denis cost?",
    a: "€0 per month. We charge a small fee per online card payment only.",
  },
  {
    q: "How fast can I go live?",
    a: "Under 30 minutes. Create an account, upload your menu, print QR codes — done.",
  },
  {
    q: "Can I connect Denis to my POS?",
    a: "Yes. Denis supports POS integrations via Deliverect, Orderbird, Lightspeed, and ready2order. Contact us for your setup.",
  },
];

export function LandingFaq() {
  return (
    <section
      id="faq"
      className="scroll-mt-24 border-t border-white/[0.06] bg-black py-16 text-white md:py-20"
    >
      <LandingContainer wide>
        <AnimateInView className="max-w-[480px]">
          <LandingHeadline inverted>FAQ</LandingHeadline>
          <LandingLead inverted className="mt-4">
            Common questions from restaurant operators in DACH.
          </LandingLead>
        </AnimateInView>

        <div className="mt-12 divide-y divide-white/[0.06] border-y border-white/[0.06]">
          {faqs.map((faq) => (
            <AnimateInView key={faq.q}>
              <details className="group py-5 md:py-6">
                <summary
                  className={cn(
                    "flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-zinc-100",
                    "[&::-webkit-details-marker]:hidden"
                  )}
                >
                  {faq.q}
                  <ChevronDown className="size-4 shrink-0 text-zinc-500 transition group-open:rotate-180" />
                </summary>
                <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
                  {faq.a}
                </p>
              </details>
            </AnimateInView>
          ))}
        </div>
      </LandingContainer>
    </section>
  );
}
