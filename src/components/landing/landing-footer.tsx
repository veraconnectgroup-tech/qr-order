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
    payments: "Plaćanja preko Stripe Connect",
  },
};

function FooterWordmark() {
  return (
    <div
      className="font-display flex items-end justify-center gap-2 overflow-hidden text-[3.25rem] font-black uppercase leading-none tracking-normal text-[var(--lp-ink)] sm:gap-4 sm:text-[6rem] md:text-[8rem] lg:text-[10.5rem] xl:text-[12.5rem]"
      aria-label="DENIS AI"
    >
      <span>DENIS</span>
      <span className="mb-[0.14em] inline-flex items-center justify-center" aria-hidden>
        <DenisTableMark size={40} className="size-[0.52em] text-[var(--lp-ink)]" />
      </span>
      <span>AI</span>
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
          <div className="mt-8 pb-2 sm:mt-10">
            <FooterWordmark />
          </div>
        </div>
      </LandingContainer>
    </footer>
  );
}
