"use client";

import {
  CheckCircle2,
  CreditCard,
  MessageCircle,
  QrCode,
  ShieldCheck,
  UtensilsCrossed,
} from "lucide-react";
import { AnimateInView } from "@/components/landing/animate-in-view";
import { FeatureRow } from "@/components/landing/feature-row";
import { StationVoiceShowcase } from "@/components/landing/station-voice-showcase";
import { AiConciergeShowcase } from "@/components/landing/ai-concierge-showcase";
import { DashboardScreenShowcase } from "@/components/landing/dashboard-screen-showcase";
import { ShowcaseWindow } from "@/components/landing/showcase-frame";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { cn } from "@/lib/utils";
import type { LandingCopy } from "@/lib/landing/landing-copy";

type LandingFeature = LandingCopy["features"][number];

function ProofPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#e7ebf0] bg-white/88 px-3 py-3 shadow-[0_18px_54px_-42px_rgba(22,20,14,0.42)]">
      <div className="flex items-center gap-2 text-[11px] font-medium text-[#6b7280]">
        <span className="flex size-6 items-center justify-center rounded-md bg-white text-[#1f2328] ring-1 ring-[#e7ebf0]">
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-2 text-[13px] font-semibold text-[#1f2328]">{value}</p>
    </div>
  );
}

function FlowCard({
  icon,
  label,
  title,
  children,
  tone = "light",
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  children: React.ReactNode;
  tone?: "light" | "dark" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-[0_24px_70px_-52px_rgba(22,20,14,0.46)]",
        tone === "dark" &&
          "border-[#252a32] bg-[#1f2328] text-white shadow-[0_28px_80px_-48px_rgba(22,20,14,0.7)]",
        tone === "light" && "border-[#e3e7ee] bg-white text-[#1f2328]",
        tone === "success" &&
          "border-emerald-200 bg-emerald-50/80 text-[#1f2328]"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg ring-1",
            tone === "dark"
              ? "bg-white/10 text-white ring-white/15"
              : "bg-white text-[#1f2328] ring-[#e7ebf0]"
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.12em]",
              tone === "dark" ? "text-white/52" : "text-[#8b95a4]"
            )}
          >
            {label}
          </p>
          <p className="mt-0.5 text-[14px] font-semibold">{title}</p>
        </div>
      </div>
      <div
        className={cn(
          "mt-3 text-[13px] leading-relaxed",
          tone === "dark" ? "text-white/72" : "text-[#596273]"
        )}
      >
        {children}
      </div>
    </div>
  );
}

function JourneyStep({
  label,
  active,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
          active
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-[#dfe5ed] bg-white text-[#8b95a4]"
        )}
      >
        <CheckCircle2 className="size-3" />
      </span>
      <span
        className={cn(
          "truncate text-[12px] font-medium",
          active ? "text-[#1f2328]" : "text-[#6b7280]"
        )}
      >
        {label}
      </span>
    </div>
  );
}

function GuestOrderingVisual() {
  return (
    <div className="mx-auto w-full max-w-[780px]">
      <div className="relative w-full overflow-hidden rounded-[2rem] border border-black/10 bg-[#fbfaf7] shadow-[0_36px_100px_-36px_rgba(22,20,14,0.55)]">
        <div className="flex items-center gap-3 border-b border-[#e7ebf0] bg-[#fbfcfd] px-4 py-3">
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-red-400/70" />
            <span className="size-2.5 rounded-full bg-amber-400/70" />
            <span className="size-2.5 rounded-full bg-emerald-400/70" />
          </div>
          <div className="min-w-0 flex-1 rounded-md bg-white px-3 py-1 text-center text-[11px] font-medium text-[#6b7280] ring-1 ring-[#e7ebf0]">
            denis.app/table-8
          </div>
          <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 sm:inline-flex">
            Live
          </span>
        </div>

        <div className="relative min-h-[520px] p-5 sm:p-6 lg:p-7">
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.44)_40%,rgba(243,238,230,0.64)_100%)]"
            aria-hidden
          />

          <div className="relative z-10 flex items-start justify-between gap-5 border-b border-[#e7ebf0] pb-5">
            <div className="max-w-[25rem]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b95a4]">
                Guest flow
              </p>
              <h3 className="mt-2 text-[clamp(1.35rem,2.4vw,2rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-[#1f2328]">
                Denis keeps the guest inside one truth.
              </h3>
            </div>
            <div className="hidden rounded-2xl border border-[#e7ebf0] bg-white/82 px-4 py-3 shadow-[0_18px_60px_-42px_rgba(22,20,14,0.42)] backdrop-blur sm:block">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-[#1f2328]">
                <QrCode className="size-4 text-[#6b7280]" />
                QR opens table 8
              </div>
              <p className="mt-1 text-[11px] font-medium text-[#8b95a4]">
                Browser session · no app
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-5 grid gap-4 lg:grid-cols-[1.04fr_0.96fr]">
            <FlowCard
              icon={<MessageCircle className="size-4" />}
              label="Guest asks"
              title="Can I order gluten-free and pay now?"
              tone="dark"
            >
              Denis does not guess. He checks live menu availability, allergens,
              table session, and payment state before answering.
            </FlowCard>

            <FlowCard
              icon={<ShieldCheck className="size-4" />}
              label="Denis answers"
              title="Only from live operations"
              tone="success"
            >
              Truffle Fries are available, allergens are checked, Stripe checkout
              is ready, and the kitchen sees the order immediately.
            </FlowCard>
          </div>

          <div className="relative z-10 mt-4 grid gap-3 sm:grid-cols-3">
            <ProofPill
              icon={<UtensilsCrossed className="size-3.5" />}
              label="Menu"
              value="Available now"
            />
            <ProofPill
              icon={<ShieldCheck className="size-3.5" />}
              label="Safety"
              value="Allergens checked"
            />
            <ProofPill
              icon={<CreditCard className="size-3.5" />}
              label="Payment"
              value="Stripe ready"
            />
          </div>

          <div className="relative z-10 mt-4 grid gap-4 lg:grid-cols-[0.74fr_1fr]">
            <div className="rounded-2xl border border-[#e3e7ee] bg-white/90 p-4 shadow-[0_24px_70px_-52px_rgba(22,20,14,0.44)]">
              <p className="text-[12px] font-medium text-[#6b7280]">
                Table 8 · QR order
              </p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <div>
                  <p className="text-2xl font-semibold tracking-[-0.03em] text-[#1f2328]">
                    €33.50
                  </p>
                  <p className="mt-1 text-[12px] font-medium text-[#8b95a4]">
                    3 items · ready for checkout
                  </p>
                </div>
                <span className="rounded-xl bg-[#1f2328] px-4 py-2.5 text-[12px] font-semibold text-white shadow-[0_16px_44px_-26px_rgba(22,20,14,0.72)]">
                  Pay now
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e3e7ee] bg-white/78 p-4 shadow-[0_24px_70px_-54px_rgba(22,20,14,0.4)] backdrop-blur">
              <div className="grid gap-3 sm:grid-cols-4">
                <JourneyStep label="Scan QR" active />
                <JourneyStep label="Ask Denis" active />
                <JourneyStep label="Order sent" active />
                <JourneyStep label="Paid" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GuestOrderingFeature({ feature }: { feature: LandingFeature }) {
  return (
    <section
      id={feature.id}
      className="relative scroll-mt-24 overflow-hidden border-t border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] py-[4.5rem] text-[var(--lp-ink)] sm:py-20 lg:py-24"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-white to-transparent"
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px max-w-[240px] bg-gradient-to-r from-transparent via-[var(--lp-ember)]/35 to-transparent"
        aria-hidden
      />

      <LandingContainer wide className="relative">
        <div className="grid items-center gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-14 xl:gap-20">
          <AnimateInView className="max-w-[34rem]">
            <div className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-full border border-[var(--lp-ember)]/25 bg-[var(--lp-ember-muted)] text-[12px] font-semibold tabular-nums text-[var(--lp-ember)]">
                01
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--lp-subtle)]">
                {feature.eyebrow}
              </p>
            </div>

            <h2 className="mt-5 font-display text-[clamp(2.1rem,4.2vw,3.45rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-[var(--lp-ink)]">
              {feature.title}
            </h2>

            <p className="mt-5 max-w-[31rem] text-[15px] font-medium leading-[1.7] text-[#514c43] sm:text-[16px]">
              {feature.lead}
            </p>

            <ul className="mt-8 divide-y divide-[var(--lp-border-subtle)] border-y border-[var(--lp-border-subtle)]">
              {feature.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex gap-3 py-4 text-[15px] leading-relaxed text-[var(--lp-muted)]"
                >
                  <span
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--lp-ember)]"
                    aria-hidden
                  />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </AnimateInView>

          <AnimateInView delay={0.08} className="min-w-0">
            <GuestOrderingVisual />
          </AnimateInView>
        </div>
      </LandingContainer>
    </section>
  );
}

export function LandingFeatures() {
  const { copy } = useLandingCopy();
  const [guest, kitchen, staff, denis] = copy.features;

  return (
    <>
      <GuestOrderingFeature feature={guest} />

      <FeatureRow
        id={kitchen.id}
        index={2}
        eyebrow={kitchen.eyebrow}
        title={kitchen.title}
        lead={kitchen.lead}
        bullets={kitchen.bullets}
        reverse={kitchen.reverse}
        scene="/landing/bg-kitchen-pass.jpg"
        visual={
          <div className="mx-auto w-full max-w-[560px] drop-shadow-[0_36px_70px_rgba(22,20,14,0.28)]">
            <StationVoiceShowcase />
          </div>
        }
      />

      <FeatureRow
        id={staff.id}
        index={3}
        eyebrow={staff.eyebrow}
        title={staff.title}
        lead={staff.lead}
        bullets={staff.bullets}
        scene="/landing/bg-dining-room.jpg"
        visual={
          <ShowcaseWindow
            url="denis.app/dashboard/tables"
            theme="light"
            className="mx-auto w-full max-w-[600px] shadow-[0_36px_90px_-28px_rgba(22,20,14,0.5)]"
          >
            <DashboardScreenShowcase
              screen="tables"
              variant="feature"
              theme="light"
            />
          </ShowcaseWindow>
        }
      />

      <FeatureRow
        id={denis.id}
        index={4}
        eyebrow={denis.eyebrow}
        title={denis.title}
        lead={denis.lead}
        bullets={denis.bullets}
        reverse={denis.reverse}
        scene="/landing/bg-bar-evening.jpg"
        visual={
          <div className="flex justify-center drop-shadow-[0_36px_70px_rgba(22,20,14,0.32)]">
            <AiConciergeShowcase hideLabel />
          </div>
        }
      />
    </>
  );
}
