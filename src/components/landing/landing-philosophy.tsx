import { AnimateInView } from "@/components/landing/animate-in-view";
import { LandingContainer } from "@/components/landing/landing-primitives";

export function LandingPhilosophy() {
  return (
    <section className="border-y border-zinc-800 bg-zinc-950 py-20 sm:py-28">
      <LandingContainer wide>
        <AnimateInView className="mx-auto max-w-[760px] text-center">
          <p className="font-display text-[clamp(1.75rem,4vw,2.65rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-white">
            It&apos;s not about ordering faster.
          </p>
          <p className="mt-3 font-display text-[clamp(1.75rem,4vw,2.65rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-zinc-500">
            It&apos;s about running service without friction.
          </p>
        </AnimateInView>
      </LandingContainer>
    </section>
  );
}
