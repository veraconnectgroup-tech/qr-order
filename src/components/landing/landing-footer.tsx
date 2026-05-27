import Link from "next/link";
import { DenisBrandMark } from "@/components/design-system/denis-brand-mark";
import { LandingContainer } from "@/components/landing/landing-primitives";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/#system", label: "Overview" },
      { href: "/#operations", label: "Operations" },
      { href: "/enterprise", label: "Enterprise" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/skyline-lounge/demo-table-8", label: "Live demo" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "mailto:kontakt@verait.de", label: "Contact" },
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

function NextJsLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="currentColor">
      <path d="M11.6 2.1h.8l7.5 19.8h-2.3l-1.6-4.2H7.7L6.1 21.9H3.8L11.6 2.1Zm-.8 12.2 2.5-6.8 2.5 6.8H10.8Z" />
    </svg>
  );
}

function StripeMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-auto" aria-hidden>
      <path
        fill="#635BFF"
        d="M13.5 10.2c0-.9-.7-1.2-1.9-1.4-1.6-.2-1.9-.5-1.9-.9 0-.5.4-.8 1.2-.8.7 0 1.2.2 1.6.6l1-1.2c-.6-.5-1.4-.8-2.6-.8-1.8 0-3 1-3 2.4 0 1.5 1.1 2 2.8 2.2 1.5.2 1.8.5 1.8.9 0 .6-.5.9-1.5.9-1 0-1.7-.3-2.2-.8l-1 1.2c.7.7 1.7 1.1 3.2 1.1 2 0 3.2-1 3.2-2.6Z"
      />
      <path fill="#635BFF" d="M4 6.5h2.2V17H4V6.5Zm4.2 0H10v10.5H8.2V6.5Z" />
    </svg>
  );
}

function SupabaseLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#3ECF8E"
        d="M11.9 2.2c-.4 0-.8.3-.9.8L8.1 18.1c-.1.5.3 1 .8 1h6.2c.4 0 .8-.3.9-.8l2.9-15.1c.1-.5-.3-1-.8-1H11.9Z"
      />
      <path
        fill="#3ECF8E"
        fillOpacity=".5"
        d="M8.1 18.1 6.2 8.5c-.1-.5.3-1 .8-1h4.9l-3.8 10.6Z"
      />
    </svg>
  );
}

function VercelLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden fill="currentColor">
      <path d="m12 2.5 10 17.5H2L12 2.5Z" />
    </svg>
  );
}

const builtWith = [
  { name: "Next.js", Logo: NextJsLogo },
  { name: "Stripe", Logo: StripeMark },
  { name: "Supabase", Logo: SupabaseLogo },
  { name: "Vercel", Logo: VercelLogo },
] as const;

export function LandingFooter() {
  return (
    <footer className="relative z-[2] border-t border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] py-16 text-[var(--lp-muted)] sm:py-20">
      <LandingContainer wide>
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <DenisBrandMark className="[&_.text-dash-text-muted]:text-zinc-500 [&_.text-dash-text]:text-white" />
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed">
              Denis — hospitality operating system for ordering, kitchen,
              payments, and compliance. Part of Vera Group.
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

        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-zinc-600">
          <span>Built with</span>
          {builtWith.map(({ name, Logo }) => (
            <span
              key={name}
              className="inline-flex items-center gap-1.5 text-zinc-500"
              title={name}
            >
              <Logo />
              <span className="sr-only">{name}</span>
            </span>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-[#1e1e2e] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px]">© 2026 Vera Group · Hamburg, Deutschland</p>
          <p className="text-[12px] text-zinc-500">
            Payments powered by Stripe Connect
          </p>
        </div>
      </LandingContainer>
    </footer>
  );
}
