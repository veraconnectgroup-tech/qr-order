"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { AnimateInView } from "@/components/landing/animate-in-view";
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
    <section id="faq" className="scroll-mt-20 border-t border-white/[0.06] px-5 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
        <AnimateInView>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
            FAQ
          </p>
          <h2 className="font-display mt-4 text-3xl font-semibold tracking-[-0.02em] text-zinc-50 sm:text-4xl">
            Questions operators ask before rollout
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-500">
            Straight answers for owners, GMs, and ops leads evaluating QR
            ordering.
          </p>
          <a
            href="mailto:hello@qrorder.app"
            className="mt-6 inline-block text-sm font-medium text-zinc-300 underline-offset-4 hover:text-zinc-100 hover:underline"
          >
            Talk to our team →
          </a>
        </AnimateInView>

        <AnimateInView className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
          {faqs.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
                >
                  <span className="text-sm font-medium text-zinc-200 sm:text-[15px]">
                    {item.q}
                  </span>
                  <ChevronDown
                    className={cn(
                      "mt-0.5 size-4 shrink-0 text-zinc-500 transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>
                {isOpen && (
                  <p className="px-5 pb-4 text-sm leading-relaxed text-zinc-500 sm:px-6 sm:pb-5">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </AnimateInView>
      </div>
    </section>
  );
}
