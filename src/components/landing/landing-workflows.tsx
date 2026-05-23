import {
  AnimateInView,
  StaggerInView,
  StaggerItem,
} from "@/components/landing/animate-in-view";
import {
  LandingContainer,
  LandingHeadline,
} from "@/components/landing/landing-primitives";

const STEPS = [
  {
    title: "Sign up & add your menu",
    description:
      "Create your account, upload your menu with categories, modifiers and photos.",
  },
  {
    title: "Print QR codes for tables",
    description: "Generate and print QR codes. Each table gets its own code.",
  },
  {
    title: "Guests scan, order, pay",
    description:
      "No app download. Guests browse, order and pay from their phone.",
  },
] as const;

export function LandingWorkflows() {
  return (
    <section className="border-t border-zinc-800 bg-zinc-950 py-16 text-white md:py-20">
      <LandingContainer wide>
        <AnimateInView className="mx-auto max-w-[560px] text-center">
          <LandingHeadline inverted>Live in three steps</LandingHeadline>
        </AnimateInView>

        <StaggerInView className="relative mt-14 flex flex-col gap-12 md:flex-row md:gap-0">
          {STEPS.map((step, index) => (
            <StaggerItem
              key={step.title}
              className="relative flex flex-1 flex-col items-center px-4 text-center"
            >
              {index < STEPS.length - 1 && (
                <div
                  aria-hidden
                  className="absolute left-[calc(50%+1.25rem)] top-5 hidden h-0 w-[calc(100%-2.5rem)] border-t-2 border-zinc-700 md:block"
                />
              )}

              <div className="relative z-10 flex size-10 items-center justify-center rounded-full bg-orange-500 text-lg font-bold text-white">
                {index + 1}
              </div>

              <h3 className="mt-5 text-base font-semibold tracking-[-0.02em] text-white">
                {step.title}
              </h3>
              <p className="mt-2 max-w-[280px] text-sm leading-relaxed text-zinc-400">
                {step.description}
              </p>
            </StaggerItem>
          ))}
        </StaggerInView>
      </LandingContainer>
    </section>
  );
}
