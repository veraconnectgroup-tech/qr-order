"use client";

import {
  LandingContainer,
  LandingEyebrow,
  LandingLead,
} from "@/components/landing/landing-primitives";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import {
  TRUST_GROUP_ITEMS,
  TRUST_GROUP_ORDER,
  TrustItemBadge,
  type TrustGroupId,
} from "@/components/landing/trust-logos";
import { cn } from "@/lib/utils";

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
    <div className="relative lg:min-w-0 lg:flex-1">
      {!isLast && (
        <div
          className="pointer-events-none absolute top-[11px] left-[calc(50%+14px)] hidden h-px w-[calc(100%-28px)] bg-gradient-to-r from-[var(--lp-ember)]/45 via-[var(--lp-ember)]/20 to-transparent lg:block"
          aria-hidden
        />
      )}

      <div className="flex items-center gap-2.5">
        <span className="relative flex size-[22px] shrink-0 items-center justify-center rounded-full border border-[var(--lp-ember)]/25 bg-[var(--lp-ember-muted)]">
          <span
            className="size-2 rounded-full bg-[var(--lp-ember)] shadow-[0_0_8px_rgba(232,93,4,0.55)]"
            aria-hidden
          />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--lp-subtle)]">
          {label}
        </span>
      </div>

      <ul className="mt-3 flex flex-wrap gap-2 pl-[30px] lg:pl-0">
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
    <div className="relative overflow-hidden rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-surface)] p-5 shadow-[0_18px_48px_-28px_rgba(22,20,14,0.18)] sm:p-6">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(232,93,4,0.07),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--lp-ember)]/35 to-transparent"
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-y-3 left-[10px] w-px bg-gradient-to-b from-[var(--lp-ember)]/40 via-[var(--lp-ember)]/15 to-transparent lg:hidden"
        aria-hidden
      />

      <div className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3">
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
      className={cn(
        "relative border-y border-[var(--lp-border-subtle)] bg-[var(--lp-tint)] py-12 md:py-16"
      )}
    >
      <LandingContainer wide>
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-14 xl:gap-16">
          <div className="max-w-md lg:max-w-none">
            <LandingEyebrow inverted>{copy.trust.eyebrow}</LandingEyebrow>
            <h2 className="mt-4 font-display text-[clamp(1.625rem,3vw,2.125rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-[var(--lp-ink)]">
              {copy.trust.headline}
              <span className="landing-serif-accent block pt-0.5 font-normal text-[var(--lp-ember)] [font-size:1.02em]">
                {copy.trust.headlineAccent}
              </span>
            </h2>
            <LandingLead className="mt-4 max-w-[34rem]">{copy.trust.lead}</LandingLead>
          </div>

          <ComplianceSpine groups={copy.trust.groups} />
        </div>
      </LandingContainer>
    </section>
  );
}
