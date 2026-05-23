import Link from "next/link";
import { QrCode } from "lucide-react";
import { LandingContainer } from "@/components/landing/landing-primitives";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/#product", label: "Platform" },
      { href: "/enterprise", label: "Enterprise" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/skyline-lounge/demo-table-8", label: "Live demo" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "mailto:hello@qrorder.app", label: "Contact" },
      { href: "/#faq", label: "FAQ" },
      { href: "/login", label: "Sign in" },
      { href: "/signup", label: "Request access" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/datenschutz", label: "Datenschutz" },
      { href: "/agb", label: "AGB" },
      { href: "/impressum", label: "Impressum" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="relative border-t border-zinc-800/60 bg-black py-16 text-zinc-400 sm:py-20">
      <LandingContainer wide>
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2">
              <QrCode className="size-4 text-zinc-500" strokeWidth={1.75} />
              <span className="text-[14px] font-medium text-white">QR Order</span>
            </Link>
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed">
              Guest ordering, live operations, and payments for restaurants,
              bars, and hospitality groups.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-[12px] font-medium uppercase tracking-wider text-zinc-500">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[13px] transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex items-center justify-center gap-1 text-xs text-zinc-600">
          <span>Built with</span>
          <span>Next.js</span>
          <span>·</span>
          <span>Stripe</span>
          <span>·</span>
          <span>Supabase</span>
          <span>·</span>
          <span>Vercel</span>
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-zinc-800 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px]">© 2026 QR Order · Hamburg, Germany</p>
          <p className="text-[12px] text-zinc-500">
            Payments powered by Stripe Connect
          </p>
        </div>
      </LandingContainer>
    </footer>
  );
}
