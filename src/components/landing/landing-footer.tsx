import Link from "next/link";
import { LandingContainer } from "@/components/landing/landing-primitives";

const columns = [
  {
    title: "Produkt",
    links: [
      { href: "/#product", label: "Plattform" },
      { href: "/#enterprise", label: "Enterprise" },
      { href: "/#pricing", label: "Preise" },
      { href: "/skyline-lounge/demo-table-8", label: "Live Demo" },
    ],
  },
  {
    title: "Unternehmen",
    links: [
      { href: "mailto:kontakt@verait.de", label: "Kontakt" },
      { href: "/faq", label: "FAQ" },
      { href: "/login", label: "Anmelden" },
      { href: "/signup", label: "Zugang anfordern" },
    ],
  },
  {
    title: "Rechtliches",
    links: [
      { href: "/datenschutz", label: "Datenschutz" },
      { href: "/agb", label: "AGB" },
      { href: "/impressum", label: "Impressum" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="relative z-[2] border-t border-[var(--lp-border-subtle)] py-16 sm:py-20">
      <LandingContainer>
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <Link href="/" className="inline-flex items-center">
              <span className="text-[20px] font-bold tracking-[-0.03em] text-[var(--lp-ink)]">
                vera
                <span className="text-[var(--lp-accent)]">.</span>
              </span>
            </Link>
            <p className="mt-3 max-w-[260px] text-[14px] leading-[1.7] text-[var(--lp-subtle)]">
              Die All-in-One Plattform für Gastronomie — Bestellung, Küche, Zahlung,
              Analyse.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--lp-dim)]">
                {col.title}
              </h4>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[14px] text-[var(--lp-subtle)] transition-colors hover:text-[var(--lp-ink)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-[var(--lp-border-subtle)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-[var(--lp-dim)]">
            © 2026 Vera · Hamburg, Deutschland
          </p>
          <p className="text-[13px] text-[var(--lp-dim)]">
            Payments powered by Stripe Connect
          </p>
        </div>
      </LandingContainer>
    </footer>
  );
}
