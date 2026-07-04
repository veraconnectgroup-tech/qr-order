import { CreditCard, QrCode, ShoppingCart } from "lucide-react";
import {
  AnimateInView,
  StaggerInView,
  StaggerItem,
} from "@/components/landing/animate-in-view";
import { cn } from "@/lib/utils";

const steps = [
  {
    num: "01",
    icon: QrCode,
    title: "Scan QR Code",
    description:
      "Guests scan the code at their table — no app download required.",
  },
  {
    num: "02",
    icon: ShoppingCart,
    title: "Browse & Order",
    description:
      "Pick items, customize modifiers, and add to cart in seconds.",
  },
  {
    num: "03",
    icon: CreditCard,
    title: "Pay Instantly",
    description:
      "Apple Pay, Google Pay, or card — paid before the waiter arrives.",
  },
];

export function LandingWorkflow() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 border-y border-[var(--lp-border)] bg-[var(--lp-surface)] px-6 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-[1140px]">
        <AnimateInView className="mb-12 text-center sm:mb-14">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] text-[var(--lp-ink)] md:text-4xl">
            Three steps. Zero friction.
          </h2>
        </AnimateInView>

        <StaggerInView className="grid gap-12 md:grid-cols-3 md:gap-0">
          {steps.map((step, i) => (
            <StaggerItem
              key={step.num}
              className={cn(
                "relative px-4 text-center md:px-8",
                i > 0 &&
                  "border-t border-[var(--lp-border)] pt-12 md:border-t-0 md:border-l md:pt-0"
              )}
            >
              <span
                className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 select-none font-display text-8xl font-bold text-zinc-100"
                aria-hidden
              >
                {step.num}
              </span>
              <div className="relative pt-6">
                <step.icon
                  className="mx-auto size-8 text-[var(--lp-accent)]"
                  strokeWidth={1.75}
                />
                <h3 className="mt-4 text-lg font-semibold text-[var(--lp-ink)]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--lp-muted)]">
                  {step.description}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerInView>
      </div>
    </section>
  );
}
