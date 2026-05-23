import Link from "next/link";
import { AnimateInView } from "@/components/landing/animate-in-view";
import { LandingContainer, LandingHeadline, LandingLead } from "@/components/landing/landing-primitives";

const workflows = [
  {
    title: "Session bills",
    description:
      "Guests order across the night on one table session. Pay online or in person — bar, counter, or table.",
    preview: (
      <div className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-left shadow-sm">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Table 8 · Session
        </p>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-white">€47.50</p>
        <p className="mt-1 text-[13px] text-zinc-400">3 items · Pay at table</p>
      </div>
    ),
  },
  {
    title: "QR at every table",
    description:
      "Generate and print QR codes per table. Guests land on your menu in under a second.",
    preview: (
      <div className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-left shadow-sm">
        <div className="mx-auto flex size-16 items-center justify-center rounded-md bg-zinc-800 text-zinc-500">
          QR
        </div>
        <p className="mt-3 text-center font-mono text-sm font-medium text-white">
          Table 12
        </p>
      </div>
    ),
  },
  {
    title: "Kitchen in sync",
    description:
      "Accepted orders hit the prep display instantly. Floor and kitchen share one live state.",
    preview: (
      <div className="w-full rounded-lg border border-orange-500/30 bg-orange-500/10 p-4 text-left">
        <p className="font-mono text-lg font-bold text-white">#1042</p>
        <p className="mt-1 text-[13px] text-orange-200/80">Preparing · 6 min</p>
      </div>
    ),
  },
];

export function LandingWorkflows() {
  return (
    <section className="border-t border-zinc-800 bg-zinc-950 py-20 text-white sm:py-28">
      <LandingContainer wide>
        <AnimateInView className="mx-auto max-w-[560px] text-center">
          <LandingHeadline inverted>Don&apos;t repeat yourself.</LandingHeadline>
          <LandingLead inverted className="mt-4">
            Automate the workflows your team runs every service — session
            billing, QR deployment, and kitchen handoff.
          </LandingLead>
        </AnimateInView>

        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {workflows.map((item) => (
            <AnimateInView key={item.title}>
              <div className="flex h-full flex-col">
                <div className="flex min-h-[140px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                  {item.preview}
                </div>
                <h3 className="mt-5 text-[16px] font-semibold tracking-[-0.02em] text-white">
                  {item.title}
                </h3>
                <p className="mt-2 flex-1 text-[14px] leading-relaxed text-zinc-400">
                  {item.description}
                </p>
              </div>
            </AnimateInView>
          ))}
        </div>

        <AnimateInView className="mt-12 text-center">
          <Link
            href="/signup"
            className="text-[14px] font-medium text-[var(--lp-accent)] hover:underline"
          >
            Request access →
          </Link>
        </AnimateInView>
      </LandingContainer>
    </section>
  );
}
