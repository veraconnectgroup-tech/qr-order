"use client";

import type { ReactNode } from "react";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import {
  ApplePayLogo,
  DatevLogo,
  DsgvoBadge,
  GooglePayLogo,
  KassenSichVSeal,
  StripeLogo,
  TRUST_GROUP_ITEMS,
  TRUST_GROUP_ORDER,
  TrustItemBadge,
  type TrustGroupId,
} from "@/components/landing/trust-logos";
import { cn } from "@/lib/utils";

const TRUST_GRID_ITEMS = [
  { label: "Stripe", node: <StripeLogo /> },
  { label: "Apple Pay", node: <ApplePayLogo /> },
  { label: "Google Pay", node: <GooglePayLogo /> },
  { label: "KassenSichV", node: <KassenSichVSeal /> },
  { label: "DSGVO", node: <DsgvoBadge /> },
  { label: "DATEV", node: <DatevLogo /> },
  {
    label: "QR ordering",
    node: (
      <span className="text-[14px] font-bold text-[var(--lp-ink)]">
        QR ordering
      </span>
    ),
  },
  {
    label: "Denis AI",
    node: (
      <span className="text-[14px] font-bold text-[var(--lp-ink)]">
        Denis AI
      </span>
    ),
  },
];

function TrustGridCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[76px] items-center justify-center border-t border-[var(--lp-border-subtle)] px-5 py-4 text-center sm:min-h-[88px]",
        className
      )}
    >
      {children}
    </div>
  );
}

function ComplianceSpineNode({
  groupId,
  label,
  isLast,
}: {
  groupId: TrustGroupId;
  label: string;
  isLast: boolean;
}) {
  const items = TRUST_GROUP_ITEMS[groupId];

  return (
    <div className="relative min-w-0 border-t border-[var(--lp-border-subtle)] px-6 py-5 sm:px-8 lg:border-t-0 lg:border-l">
      {!isLast && (
        <div
          className="pointer-events-none absolute top-[32px] left-[calc(50%+14px)] hidden h-px w-[calc(100%-28px)] bg-gradient-to-r from-[var(--lp-ember)]/30 via-[var(--lp-ember)]/12 to-transparent lg:block"
          aria-hidden
        />
      )}

      <div className="flex items-center gap-2.5">
        <span className="relative flex size-[22px] shrink-0 items-center justify-center rounded-full border border-[var(--lp-ember)]/25 bg-[var(--lp-ember-muted)]">
          <span
            className="size-2 rounded-full bg-[var(--lp-ember)]"
            aria-hidden
          />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-normal text-[var(--lp-subtle)]">
          {label}
        </span>
      </div>

      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((id) => (
          <TrustItemBadge key={id} id={id} />
        ))}
      </ul>
    </div>
  );
}

function ComplianceSpine({
  groups,
}: {
  groups: Record<TrustGroupId, string>;
}) {
  return (
    <div className="border-t border-[var(--lp-border-subtle)] bg-[var(--lp-surface)]">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4">
        {TRUST_GROUP_ORDER.map((groupId, index) => (
          <ComplianceSpineNode
            key={groupId}
            groupId={groupId}
            label={groups[groupId]}
            isLast={index === TRUST_GROUP_ORDER.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

export function LandingTrustStrip() {
  const { copy } = useLandingCopy();

  return (
    <section
      aria-label="Integrations and compliance"
      className="relative border-y border-[var(--lp-border-subtle)] bg-[var(--lp-bg)]"
    >
      <LandingContainer wide className="px-0 sm:px-6">
        <div className="mx-auto max-w-[1140px] border-x border-[var(--lp-border-subtle)] bg-[var(--lp-surface)]">
          <div className="grid sm:grid-cols-2 lg:grid-cols-[1.45fr_repeat(4,minmax(0,1fr))]">
            <div className="flex min-h-[152px] items-center border-t border-[var(--lp-border-subtle)] px-8 py-8 sm:col-span-2 lg:col-span-1 lg:row-span-2 lg:border-r">
              <p className="max-w-[15rem] text-[14px] font-medium leading-[1.55] text-[var(--lp-muted)]">
                Trusted by hospitality teams that need QR ordering, payments,
                service truth, and compliance in one operating system.
              </p>
            </div>

            {TRUST_GRID_ITEMS.map((item, index) => (
              <TrustGridCell
                key={item.label}
                className={cn(
                  "sm:border-l",
                  index % 4 !== 0 && "lg:border-l"
                )}
              >
                <div aria-label={item.label}>{item.node}</div>
              </TrustGridCell>
            ))}
          </div>

          <div className="grid border-t border-[var(--lp-border-subtle)] lg:grid-cols-[1.02fr_0.98fr]">
            <div className="px-8 py-12 sm:px-10 lg:px-12 lg:py-16">
              <p className="text-[11px] font-semibold uppercase tracking-normal text-[var(--lp-subtle)]">
                {copy.trust.eyebrow}
              </p>
              <h2 className="mt-6 max-w-[28rem] font-display text-3xl font-semibold leading-[1.1] tracking-normal text-[var(--lp-ink)] sm:text-4xl">
                {copy.trust.headline}
                <span className="landing-serif-accent block pt-1 font-normal text-[var(--lp-ember)] [font-size:1.02em]">
                  {copy.trust.headlineAccent}
                </span>
              </h2>
            </div>

            <div className="border-t border-[var(--lp-border-subtle)] px-8 py-12 sm:px-10 lg:border-t-0 lg:border-l lg:px-12 lg:py-16">
              <p className="max-w-[33rem] text-[15px] font-medium leading-[1.75] text-[var(--lp-muted)]">
                {copy.trust.lead}
              </p>
            </div>
          </div>

          <ComplianceSpine groups={copy.trust.groups} />
        </div>
      </LandingContainer>
    </section>
  );
}
