import { AnimateInView } from "@/components/landing/animate-in-view";

const integrations = [
  { name: "Stripe Connect", detail: "Card payouts & checkout" },
  { name: "Apple Pay", detail: "One-tap guest checkout" },
  { name: "Google Pay", detail: "Mobile wallet support" },
  { name: "Email receipts", detail: "Automated via Resend" },
  { name: "Realtime", detail: "Live order updates" },
  { name: "CSV export", detail: "Finance-ready history" },
];

export function LandingIntegrations() {
  return (
    <section className="border-b border-white/[0.06] px-5 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <AnimateInView className="max-w-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
            Integrations
          </p>
          <h2 className="font-display mt-4 text-2xl font-semibold tracking-[-0.02em] text-zinc-50 sm:text-3xl">
            Works with the stack you already trust
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500 sm:text-base">
            Payments, notifications, and exports wired in — not bolted on as
            afterthoughts.
          </p>
        </AnimateInView>

        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-3">
          {integrations.map((item) => (
            <div
              key={item.name}
              className="bg-[#09090b] px-5 py-4 sm:px-6 sm:py-5"
            >
              <p className="text-sm font-medium text-zinc-200">{item.name}</p>
              <p className="mt-1 text-xs text-zinc-600">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
