"use client";

import { AnimateInView } from "@/components/landing/animate-in-view";
import {
  LandingContainer,
  LandingHeadline,
  LandingLead,
} from "@/components/landing/landing-primitives";

const faqs = [
  {
    q: "Is Denis KassenSichV compliant?",
    a: "Yes. Every transaction is signed via a certified TSE. DATEV export is included.",
  },
  {
    q: "Do guests need an app?",
    a: "No. Guests scan a QR code and order in the mobile browser.",
  },
  {
    q: "What does Denis cost?",
    a: "€0 per month. We charge a small fee per online card payment only.",
  },
  {
    q: "How fast can I go live?",
    a: "Under 30 minutes. Create an account, upload your menu, print QR codes.",
  },
];

export function LandingFaq() {
  return (
    <section id="faq" className="scroll-mt-24 bg-black py-24 text-white md:py-36">
      <LandingContainer wide>
        <AnimateInView className="max-w-[440px]">
          <LandingHeadline inverted className="text-[clamp(1.75rem,3vw,2.25rem)]">
            FAQ
          </LandingHeadline>
          <LandingLead inverted className="mt-6 text-[16px] leading-[1.7] text-zinc-500">
            Common questions from restaurant operators.
          </LandingLead>
        </AnimateInView>

        <dl className="mt-16 max-w-2xl space-y-10">
          {faqs.map((faq) => (
            <AnimateInView key={faq.q}>
              <div>
                <dt className="text-[15px] font-medium text-zinc-200">{faq.q}</dt>
                <dd className="mt-3 text-[15px] leading-[1.7] text-zinc-500">{faq.a}</dd>
              </div>
            </AnimateInView>
          ))}
        </dl>
      </LandingContainer>
    </section>
  );
}
