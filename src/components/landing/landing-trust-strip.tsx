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

const INTEGRATION_TILES = [
  {
    label: "Stripe",
    node: <StripeLogo className="text-[18px]" />,
    className: "left-[13%] top-[42%]",
  },
  {
    label: "Apple Pay",
    node: <ApplePayLogo className="text-[17px] [&_svg]:size-5 [&_span]:text-[15px]" />,
    className: "left-[24%] top-[18%]",
  },
  {
    label: "Google Pay",
    node: <GooglePayLogo className="[&_svg]:size-5 [&_span]:text-[15px]" />,
    className: "right-[24%] top-[22%]",
  },
  {
    label: "DATEV",
    node: <DatevLogo />,
    className: "right-[16%] top-[46%]",
  },
  {
    label: "KassenSichV",
    node: <KassenSichVSeal />,
    className: "left-[31%] bottom-[18%]",
  },
  {
    label: "DSGVO",
    node: <DsgvoBadge />,
    className: "right-[31%] bottom-[20%]",
  },
  {
    label: "QR ordering",
    node: (
      <span className="text-[14px] font-bold text-[var(--lp-ink)]">
        QR ordering
      </span>
    ),
    className: "left-[43%] top-[34%]",
  },
  {
    label: "Denis AI",
    node: (
      <span className="text-[14px] font-bold text-[var(--lp-ink)]">
        Denis AI
      </span>
    ),
    className: "right-[38%] bottom-[35%]",
  },
];

function IntegrationTile({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div
      className={cn(
        "absolute hidden min-h-[66px] min-w-[92px] items-center justify-center rounded-xl border border-[var(--lp-border-subtle)] bg-white/92 px-4 py-3 text-center shadow-[0_22px_54px_-42px_rgba(22,20,14,0.56)] ring-1 ring-white/80 backdrop-blur md:flex",
        className
      )}
      aria-label={label}
    >
      {children}
    </div>
  );
}

function GhostTile({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "absolute hidden size-16 rounded-xl border border-[var(--lp-border-subtle)] bg-white/38 shadow-[0_18px_48px_-44px_rgba(22,20,14,0.5)] md:block",
        className
      )}
      aria-hidden
    />
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
          <div className="relative min-h-[620px] overflow-hidden border-b border-[var(--lp-border-subtle)] bg-white">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[360px] opacity-[0.62]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(22,20,14,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(22,20,14,0.045) 1px, transparent 1px)",
                backgroundSize: "88px 88px",
              }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.05),rgba(255,255,255,0.72)_64%,#fff_100%)]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-[250px] h-40 bg-[linear-gradient(to_bottom,transparent,#fff)]"
              aria-hidden
            />

            <GhostTile className="left-[8%] top-[25%]" />
            <GhostTile className="right-[8%] top-[30%]" />
            <GhostTile className="left-[48%] top-[19%] opacity-55" />
            <GhostTile className="right-[43%] bottom-[33%] opacity-55" />

            {INTEGRATION_TILES.map((item) => (
              <IntegrationTile
                key={item.label}
                label={item.label}
                className={item.className}
              >
                {item.node}
              </IntegrationTile>
            ))}

            <div className="absolute inset-x-6 top-[270px] z-10 mx-auto flex w-fit items-center gap-2 rounded-full border border-[var(--lp-border-subtle)] bg-white/92 px-5 py-3 text-[14px] font-semibold text-[var(--lp-ink)] shadow-[0_16px_46px_-36px_rgba(22,20,14,0.62)] backdrop-blur">
              <span className="size-1.5 rounded-full bg-[var(--lp-ember)]" aria-hidden />
              Stripe · Apple Pay · Google Pay · DATEV
            </div>

            <div className="relative z-10 mx-auto flex min-h-[620px] max-w-[690px] flex-col items-center justify-end px-8 pb-20 pt-[360px] text-center sm:px-10">
              <p className="text-[11px] font-semibold uppercase tracking-normal text-[var(--lp-subtle)]">
                {copy.trust.eyebrow}
              </p>
              <h2 className="mt-5 font-display text-[clamp(2.15rem,5vw,3.7rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-[var(--lp-ink)]">
                {copy.trust.headline}
                <span className="landing-serif-accent block pt-1 font-normal text-[var(--lp-ember)] [font-size:0.92em]">
                  {copy.trust.headlineAccent}
                </span>
              </h2>
              <p className="mt-5 max-w-[620px] text-[17px] font-medium leading-[1.72] text-[var(--lp-muted)]">
                {copy.trust.lead}
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-2 md:hidden">
                {INTEGRATION_TILES.map((item) => (
                  <span
                    key={item.label}
                    className="inline-flex min-h-10 items-center rounded-full border border-[var(--lp-border-subtle)] bg-white px-3.5 py-2 shadow-[0_1px_2px_rgba(22,20,14,0.04)]"
                    aria-label={item.label}
                  >
                    {item.node}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <ComplianceSpine groups={copy.trust.groups} />
        </div>
      </LandingContainer>
    </section>
  );
}
