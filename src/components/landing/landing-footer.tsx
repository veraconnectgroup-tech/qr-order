"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DenisBrandMark } from "@/components/design-system/denis-brand-mark";
import { DenisTableMark } from "@/components/design-system/denis-table-mark";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import { LandingContainer } from "@/components/landing/landing-primitives";

const columns = [
  {
    titleKey: "product" as const,
    links: [
      { href: "/#features-guest", labelKey: "platform" as const },
      { href: "/#enterprise", labelKey: "enterprise" as const },
      { href: "/#pricing", labelKey: "pricing" as const },
      { href: "/skyline-lounge/demo-table-8", labelKey: "demo" as const },
    ],
  },
  {
    titleKey: "company" as const,
    links: [
      { href: "mailto:kontakt@verait.de", labelKey: "contact" as const },
      { href: "/#faq", labelKey: "faq" as const },
      { href: "/login", labelKey: "signIn" as const },
      { href: "/signup", labelKey: "cta" as const },
    ],
  },
  {
    titleKey: "legal" as const,
    links: [
      { href: "/datenschutz", labelKey: "privacy" as const },
      { href: "/agb", labelKey: "terms" as const },
      { href: "/impressum", labelKey: "imprint" as const },
    ],
  },
];

const footerLabels = {
  de: {
    product: "Produkt",
    company: "Unternehmen",
    legal: "Rechtliches",
    platform: "Plattform",
    enterprise: "Enterprise",
    pricing: "Preise",
    demo: "Live-Demo",
    contact: "Kontakt",
    faq: "FAQ",
    signIn: "Anmelden",
    cta: "Kostenlos starten",
    privacy: "Datenschutz",
    terms: "AGB",
    imprint: "Impressum",
    brandLine: "Denis AI. Ihr Restaurant Co-worker für echte Schichten.",
    creditsCta: "30.000 Credits kostenlos starten",
    pulseLabel: "Live shift",
    pulseItems: ["18 open tables", "42 orders watched", "0 forgotten tickets", "Stripe ready"],
    payments: "Payments powered by Stripe Connect",
  },
  en: {
    product: "Product",
    company: "Company",
    legal: "Legal",
    platform: "Platform",
    enterprise: "Enterprise",
    pricing: "Pricing",
    demo: "Live demo",
    contact: "Contact",
    faq: "FAQ",
    signIn: "Sign in",
    cta: "Try for free",
    privacy: "Privacy",
    terms: "Terms",
    imprint: "Imprint",
    brandLine: "Denis AI. Your restaurant co-worker for real shifts.",
    creditsCta: "Get 30,000 free credits",
    pulseLabel: "Live shift",
    pulseItems: ["18 open tables", "42 orders watched", "0 forgotten tickets", "Stripe ready"],
    payments: "Payments powered by Stripe Connect",
  },
  sr: {
    product: "Proizvod",
    company: "Kompanija",
    legal: "Pravno",
    platform: "Platforma",
    enterprise: "Enterprise",
    pricing: "Cene",
    demo: "Live demo",
    contact: "Kontakt",
    faq: "FAQ",
    signIn: "Prijava",
    cta: "Probaj besplatno",
    privacy: "Privatnost",
    terms: "Uslovi",
    imprint: "Impresum",
    brandLine: "Denis AI. Tvoj restaurant co-worker za prave smene.",
    creditsCta: "Uzmi 30.000 besplatnih kredita",
    pulseLabel: "Live shift",
    pulseItems: ["18 otvorenih stolova", "42 praćene porudžbine", "0 zaboravljenih tiketa", "Stripe spreman"],
    payments: "Plaćanja preko Stripe Connect",
  },
};

const DENIS_WORDMARK_LETTERS = ["D", "E", "N", "I", "S"] as const;

function DenisWordmarkLetter({ letter }: { letter: string }) {
  return (
    <span className="relative isolate flex h-20 items-end justify-center overflow-hidden border-r border-[var(--lp-ink)]/8 last:border-r-0 sm:h-28 md:h-36 lg:h-48 xl:h-56">
      <span
        className="absolute bottom-0 translate-x-[0.035em] translate-y-[0.035em] font-display text-[4.25rem] font-extrabold uppercase leading-[0.74] tracking-normal text-[var(--lp-ember)] opacity-95 sm:text-[6rem] md:text-[8.5rem] lg:text-[11rem] xl:text-[12.5rem]"
        aria-hidden
      >
        {letter}
      </span>
      <span className="relative font-display text-[4.25rem] font-extrabold uppercase leading-[0.74] tracking-normal text-[var(--lp-ink)] [-webkit-text-stroke:1px_rgba(232,93,4,0.22)] sm:text-[6rem] md:text-[8.5rem] lg:text-[11rem] xl:text-[12.5rem]">
        {letter}
      </span>
      <span
        className="absolute inset-x-[18%] bottom-1 h-px bg-[var(--lp-ember)]/65 sm:bottom-2"
        aria-hidden
      />
    </span>
  );
}

function FooterWordmark() {
  return (
    <div
      className="relative overflow-hidden border-y border-[var(--lp-border-subtle)] bg-[linear-gradient(180deg,#fff_0%,rgba(232,93,4,0.045)_100%)] py-6 sm:py-8"
      aria-label="Denis AI"
    >
      <div className="flex items-end justify-between gap-4 sm:gap-6">
        <span
          className="grid min-w-0 flex-1 grid-cols-5 items-end gap-0 border-y border-[var(--lp-ember)]/22"
          aria-hidden
        >
          {DENIS_WORDMARK_LETTERS.map((letter) => (
            <DenisWordmarkLetter key={letter} letter={letter} />
          ))}
        </span>
        <span className="mb-[0.62em] flex shrink-0 flex-col items-end gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--lp-ink)] px-3.5 py-2 text-[12px] font-bold uppercase tracking-normal text-white shadow-[0_18px_42px_-30px_rgba(22,20,14,0.9)] sm:px-4 sm:py-2.5 sm:text-[13px]">
            <DenisTableMark size={24} className="size-4 text-white" />
            AI
          </span>
          <span className="hidden text-right text-[11px] font-semibold uppercase tracking-normal text-[var(--lp-subtle)] sm:block">
            Restaurant co-worker
          </span>
        </span>
      </div>
    </div>
  );
}

function FooterShiftPulse({
  label,
  items,
}: {
  label: string;
  items: string[];
}) {
  return (
    <div className="mt-6 grid overflow-hidden border-y border-[var(--lp-border-subtle)] text-[11px] font-semibold uppercase tracking-normal text-[var(--lp-muted)] sm:grid-cols-[1.05fr_repeat(4,1fr)]">
      <div className="flex items-center gap-2 border-b border-[var(--lp-border-subtle)] px-4 py-3 text-[var(--lp-ink)] sm:border-b-0 sm:border-r">
        <span className="relative flex size-2.5" aria-hidden>
          <span className="absolute inline-flex size-full rounded-full bg-[var(--lp-ember)] opacity-30" />
          <span className="relative inline-flex size-2.5 rounded-full bg-[var(--lp-ember)]" />
        </span>
        {label}
      </div>
      {items.map((item) => (
        <div
          key={item}
          className="flex min-h-11 items-center border-b border-[var(--lp-border-subtle)] px-4 py-3 sm:border-b-0 sm:border-r last:border-b-0 sm:last:border-r-0"
        >
          {item}
        </div>
      ))}
    </div>
  );
}

export function LandingFooter() {
  const { locale, copy } = useLandingCopy();
  const labels = footerLabels[locale];

  return (
    <footer className="relative z-[2] border-t border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] pt-16 text-[var(--lp-muted)] sm:pt-20">
      <LandingContainer wide>
        <div className="grid gap-12 pb-14 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <DenisBrandMark className="[&_.text-dash-text-muted]:text-[var(--lp-subtle)] [&_.text-dash-text]:text-[var(--lp-ink)]" />
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed">
              {labels.brandLine}
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-[var(--lp-ink)] px-4 text-[13px] font-semibold text-white shadow-[0_14px_34px_rgba(15,15,14,0.12)] transition hover:bg-black"
            >
              {labels.creditsCta}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          {columns.map((col) => (
            <div key={col.titleKey}>
              <h4 className="text-[12px] font-medium uppercase tracking-wider text-[var(--lp-subtle)]">
                {labels[col.titleKey]}
              </h4>
              <ul className="mt-4 space-y-2">
                {col.links.map((link) => (
                  <li key={link.labelKey}>
                    <Link
                      href={link.href}
                      className="text-[13px] transition-colors hover:text-[var(--lp-ink)]"
                    >
                      {labels[link.labelKey]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-[var(--lp-border-subtle)] pt-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px]">{copy.footer.copyright}</p>
            <p className="text-[12px] text-[var(--lp-subtle)]">{labels.payments}</p>
          </div>
          <div className="mt-8 pb-8 sm:mt-10 sm:pb-10">
            <FooterWordmark />
            <FooterShiftPulse label={labels.pulseLabel} items={labels.pulseItems} />
          </div>
        </div>
      </LandingContainer>
    </footer>
  );
}
