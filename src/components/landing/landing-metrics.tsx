import { AnimateInView } from "@/components/landing/animate-in-view";

const metrics = [
  { value: "0€", label: "Monthly platform fee" },
  { value: "< 30s", label: "Guest order time" },
  { value: "99.9%", label: "Uptime target" },
  { value: "24/7", label: "Guest ordering" },
];

export function LandingMetrics() {
  return (
    <section className="border-y border-white/[0.06] bg-white/[0.015]">
      <AnimateInView className="mx-auto grid max-w-[1140px] grid-cols-2 divide-white/[0.06] md:grid-cols-4 md:divide-x">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="border-white/[0.06] px-6 py-10 text-center odd:border-r md:border-r-0 [&:nth-child(-n+2)]:border-b md:[&:nth-child(-n+2)]:border-b-0"
          >
            <p className="font-display text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
              {metric.value}
            </p>
            <p className="mt-2 text-xs text-zinc-500 sm:text-sm">{metric.label}</p>
          </div>
        ))}
      </AnimateInView>
    </section>
  );
}
