import { CreditCard, QrCode, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { AnimateInView, StaggerInView, StaggerItem } from "@/components/landing/animate-in-view";

const steps = [
  {
    icon: QrCode,
    title: "Scan",
    description: "Guest opens the menu from a table QR — no app install.",
  },
  {
    icon: ShoppingBag,
    title: "Order",
    description: "Browse, customize modifiers, and send to kitchen instantly.",
  },
  {
    icon: CreditCard,
    title: "Pay",
    description: "Card online or pay in person — bar, counter, or table.",
  },
  {
    icon: UtensilsCrossed,
    title: "Serve",
    description: "Staff sees live status from orders board to delivery.",
  },
];

export function LandingWorkflow() {
  return (
    <section className="border-b border-white/[0.06] px-5 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <AnimateInView className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
            How it works
          </p>
          <h2 className="font-display mt-4 text-3xl font-semibold tracking-[-0.02em] text-zinc-50 sm:text-4xl">
            From scan to served — one continuous flow
          </h2>
        </AnimateInView>

        <StaggerInView className="relative mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <div
            aria-hidden
            className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-8 hidden h-px bg-gradient-to-r from-transparent via-white/10 to-transparent lg:block"
          />
          {steps.map((step, i) => (
            <StaggerItem key={step.title} className="relative text-center lg:text-left">
              <div className="mx-auto flex size-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] lg:mx-0">
                <step.icon className="size-5 text-zinc-300" strokeWidth={1.5} />
              </div>
              <p className="mt-4 text-[11px] font-medium tabular-nums text-zinc-600">
                0{i + 1}
              </p>
              <h3 className="mt-1 text-sm font-semibold text-zinc-100">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                {step.description}
              </p>
            </StaggerItem>
          ))}
        </StaggerInView>
      </div>
    </section>
  );
}
