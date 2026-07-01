"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimateInView } from "@/components/landing/animate-in-view";
import { LandingDenisCreditsNote } from "@/components/landing/landing-denis-credits-note";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import {
  LandingContainer,
  LandingEyebrow,
  LandingHeadline,
  LandingLead,
} from "@/components/landing/landing-primitives";
import { FeatureCheck } from "@/components/landing/product-showcases";
import {
  computeLandingRoiEstimate,
  formatLandingEuros,
} from "@/lib/landing/landing-roi-calculator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingPricing() {
  const { locale, copy } = useLandingCopy();
  const { pricing } = copy;
  const [covers, setCovers] = useState(80);
  const [ticket, setTicket] = useState(28);
  const [uplift, setUplift] = useState(8);

  const roi = useMemo(
    () =>
      computeLandingRoiEstimate({
        coversPerDay: covers,
        averageTicketEuros: ticket,
        upsellUpliftPercent: uplift,
        planCostEuros: 49,
      }),
    [covers, ticket, uplift]
  );

  return (
    <section
      id="pricing"
      className="scroll-mt-24 border-t border-white/[0.06] bg-black py-20 text-white md:py-28"
    >
      <LandingContainer wide>
        <AnimateInView className="max-w-[480px]">
          <LandingEyebrow inverted>{pricing.eyebrow}</LandingEyebrow>
          <LandingHeadline inverted className="mt-3">
            {pricing.title}
          </LandingHeadline>
          <LandingLead inverted className="mt-4">
            {pricing.lead}
          </LandingLead>
        </AnimateInView>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {pricing.plans.map((plan) => (
            <AnimateInView key={plan.name}>
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-2xl border p-8",
                  plan.primary
                    ? "border-white/[0.12] bg-white/[0.03] ring-1 ring-white/[0.08]"
                    : "border-white/[0.06] bg-white/[0.02]"
                )}
              >
                {plan.primary && (
                  <span className="absolute -top-3 left-8 rounded-full bg-[var(--qr-ember)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
                    {pricing.popular}
                  </span>
                )}
                <p className="text-[13px] font-medium uppercase tracking-wider text-zinc-500">
                  {plan.name}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-medium tracking-[-0.03em] text-white">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-[14px] text-zinc-400">{plan.period}</span>
                  )}
                </div>
                <p className="mt-2 text-[14px] font-medium text-[var(--qr-ember)]">
                  {plan.fee}
                </p>
                <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">
                  {plan.description}
                </p>
                <ul className="mt-8 flex-1 space-y-2.5 border-t border-white/[0.06] pt-8">
                  {plan.features.map((feat) => (
                    <FeatureCheck key={feat} accent>
                      {feat}
                    </FeatureCheck>
                  ))}
                </ul>
                {plan.complianceNote && (
                  <p className="mt-6 text-[12px] font-medium tracking-wide text-zinc-500">
                    {plan.complianceNote}
                  </p>
                )}
                <Button
                  asChild
                  className={cn(
                    "mt-8 h-12 w-full rounded-full text-sm font-semibold",
                    plan.primary
                      ? "bg-[var(--qr-ember)] text-white hover:bg-[var(--qr-ember-hover)]"
                      : "border border-white/[0.12] bg-transparent text-zinc-200 hover:bg-white/[0.04] hover:text-white"
                  )}
                  variant={plan.primary ? "default" : "outline"}
                >
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </div>
            </AnimateInView>
          ))}
        </div>

        <AnimateInView className="mt-16 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 md:p-10">
          <h3 className="font-display text-xl font-medium text-white">
            {pricing.compareTitle}
          </h3>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-white/[0.08] text-zinc-500">
                  <th className="pb-3 pr-4 font-medium">Feature</th>
                  {pricing.featureMatrix.headers.map((header) => (
                    <th key={header} className="px-3 pb-3 text-center font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pricing.featureMatrix.rows.map((row) => (
                  <tr key={row.label} className="border-b border-white/[0.04]">
                    <td className="py-3 pr-4 text-zinc-300">{row.label}</td>
                    {row.values.map((value, index) => (
                      <td key={index} className="px-3 py-3 text-center text-zinc-400">
                        {value ? "✓" : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AnimateInView>

        <AnimateInView className="mt-10 rounded-2xl border border-[var(--qr-ember)]/20 bg-[var(--qr-ember)]/5 p-8 md:p-10">
          <h3 className="font-display text-xl font-medium text-white">
            {pricing.roiTitle}
          </h3>
          <p className="mt-2 text-[15px] text-zinc-400">{pricing.roiLead}</p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <label className="block">
              <span className="text-[13px] text-zinc-500">{pricing.roiCovers}</span>
              <input
                type="range"
                min={20}
                max={300}
                value={covers}
                onChange={(e) => setCovers(Number(e.target.value))}
                className="mt-2 w-full accent-[var(--qr-ember)]"
              />
              <span className="mt-1 block text-[15px] font-medium text-white">
                {covers}
              </span>
            </label>
            <label className="block">
              <span className="text-[13px] text-zinc-500">{pricing.roiTicket}</span>
              <input
                type="range"
                min={12}
                max={80}
                value={ticket}
                onChange={(e) => setTicket(Number(e.target.value))}
                className="mt-2 w-full accent-[var(--qr-ember)]"
              />
              <span className="mt-1 block text-[15px] font-medium text-white">
                €{ticket}
              </span>
            </label>
            <label className="block">
              <span className="text-[13px] text-zinc-500">{pricing.roiUplift}</span>
              <input
                type="range"
                min={2}
                max={20}
                value={uplift}
                onChange={(e) => setUplift(Number(e.target.value))}
                className="mt-2 w-full accent-[var(--qr-ember)]"
              />
              <span className="mt-1 block text-[15px] font-medium text-white">
                {uplift}%
              </span>
            </label>
          </div>
          <p className="mt-8 text-[18px] font-medium text-white">
            {pricing.roiResult}:{" "}
            <span className="text-[var(--qr-ember)]">
              {formatLandingEuros(roi.monthlyUpliftEuros, locale)}
            </span>
            {Number.isFinite(roi.roiMultiplier) && roi.roiMultiplier > 0 && (
              <span className="ml-2 text-[14px] text-zinc-400">
                ({roi.roiMultiplier}x vs Growth plan)
              </span>
            )}
          </p>
        </AnimateInView>

        <LandingDenisCreditsNote />
      </LandingContainer>
    </section>
  );
}
