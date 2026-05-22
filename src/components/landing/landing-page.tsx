"use client";

import Link from "next/link";
import {
  Building2,
  CreditCard,
  QrCode,
  Shield,
  ShoppingCart,
} from "lucide-react";
import {
  AnimateInView,
  HeroItem,
  HeroStagger,
  StaggerInView,
  StaggerItem,
} from "@/components/landing/animate-in-view";
import { CountUpStat, StatText } from "@/components/landing/count-up-stat";
import {
  CheckoutShowcase,
  FeatureCheck,
  GuestMenuShowcase,
  HistoryShowcase,
  KitchenShowcase,
  TablesShowcase,
} from "@/components/landing/product-showcases";
import { EnterpriseHeroVisual } from "@/components/landing/enterprise-hero-visual";
import { Button } from "@/components/ui/button";

const trustSignals = [
  { icon: CreditCard, label: "Stripe Connect" },
  { icon: Shield, label: "Secure payments" },
  { icon: Building2, label: "Multi-location" },
];

const navLinks = [
  { href: "#features", label: "Platform" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
];

const steps = [
  {
    num: "01",
    icon: QrCode,
    title: "Scan QR Code",
    description: "Guests scan the code on their table — no app download required.",
  },
  {
    num: "02",
    icon: ShoppingCart,
    title: "Browse & Order",
    description: "Pick items, customize modifiers, and add to cart in seconds.",
  },
  {
    num: "03",
    icon: CreditCard,
    title: "Pay Instantly",
    description: "Apple Pay, Google Pay, or card — paid before the waiter arrives.",
  },
];

const features = [
  {
    title: "Works on Any Phone",
    description:
      "Guests scan a QR code and order from a fast, mobile-first menu. No app download, no account — just browse, customize, and pay.",
    visual: <GuestMenuShowcase />,
    device: "phone" as const,
    reverse: false,
  },
  {
    title: "Instant Payments",
    description:
      "Stripe Connect routes payments to your account. Apple Pay, Google Pay, and cards — checkout optimized for thumb-sized screens.",
    visual: <CheckoutShowcase />,
    device: "phone" as const,
    reverse: true,
  },
  {
    title: "Real-Time Operations",
    description:
      "See every table at a glance — available, occupied, or needs attention. QR codes, zones, and live session totals on your staff tablet.",
    visual: <TablesShowcase />,
    device: "tablet" as const,
    reverse: false,
  },
  {
    title: "Analytics & History",
    description:
      "Revenue, order counts, and top items with one tap. Filter by day or week and export CSV for your accountant.",
    visual: <HistoryShowcase />,
    device: "tablet" as const,
    reverse: true,
  },
  {
    title: "Kitchen Display",
    description:
      "Orders land on the kitchen tablet the moment they're accepted. Color-coded timers and large tap targets for busy prep stations.",
    visual: <KitchenShowcase />,
    device: "tablet" as const,
    reverse: false,
  },
];

const plans = [
  {
    name: "Starter",
    price: "0€",
    period: "/mo",
    fee: "+ 1.5% per order",
    description: "Perfect for trying it out",
    features: ["QR menus", "Online payments", "Basic dashboard"],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "49€",
    period: "/mo",
    fee: "+ 1% per order",
    description: "For busy venues",
    features: [
      "Everything in Starter",
      "Kitchen display",
      "Analytics",
      "Priority support",
    ],
    cta: "Get started",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "99€",
    period: "/mo",
    fee: "+ 0.5% per order",
    description: "For multi-location chains",
    features: [
      "Everything in Pro",
      "Multi-location",
      "Custom branding",
      "API access",
      "Dedicated support",
    ],
    cta: "Contact sales",
    highlighted: false,
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-950 text-zinc-50 antialiased">
      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
              <QrCode className="size-4 text-zinc-300" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-zinc-100">
              QR Order
            </span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-zinc-400 transition hover:text-zinc-100"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/skyline-lounge/demo-table-8"
              className="text-sm text-zinc-400 transition hover:text-zinc-100"
            >
              Demo
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-zinc-400 hover:text-zinc-100"
            >
              <Link href="/login">Log in</Link>
            </Button>
            <Button
              size="sm"
              asChild
              className="bg-zinc-100 text-zinc-950 hover:bg-white"
            >
              <Link href="/signup">Request access</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero — enterprise */}
        <section className="border-b border-zinc-800 px-4 pb-16 pt-24 sm:px-6 sm:pb-20 sm:pt-28 md:pb-24 md:pt-32">
          <div className="mx-auto grid max-w-6xl items-center gap-8 sm:gap-12 lg:grid-cols-2 lg:gap-16">
            <HeroStagger className="text-center lg:text-left">
              <HeroItem>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                  Hospitality ordering platform
                </p>
              </HeroItem>
              <HeroItem>
                <h1 className="mt-4 text-3xl font-semibold leading-[1.15] tracking-tight text-zinc-50 sm:text-4xl lg:text-[2.75rem]">
                  Contactless ordering your operations team can rely on
                </h1>
              </HeroItem>
              <HeroItem>
                <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-zinc-400 lg:mx-0 lg:text-lg">
                  QR Order connects guest menus, staff dashboards, kitchen
                  displays, and Stripe payments on one secure platform — built
                  for restaurants, bars, and multi-location venues.
                </p>
              </HeroItem>
              <HeroItem>
                <ul className="mx-auto mt-8 flex max-w-md flex-col gap-3 text-left lg:mx-0">
                  {trustSignals.map(({ icon: Icon, label }) => (
                    <li
                      key={label}
                      className="flex items-center gap-3 text-sm text-zinc-300"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
                        <Icon className="size-4 text-zinc-400" />
                      </span>
                      {label}
                    </li>
                  ))}
                </ul>
              </HeroItem>
              <HeroItem>
                <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
                  <Button
                    size="lg"
                    asChild
                    className="h-11 w-full bg-zinc-100 px-7 text-sm font-semibold text-zinc-950 hover:bg-white sm:w-auto"
                  >
                    <Link href="/signup">Request access</Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    asChild
                    className="h-11 w-full border-zinc-700 bg-transparent px-7 text-sm font-medium text-zinc-200 hover:bg-zinc-900 hover:text-zinc-50 sm:w-auto"
                  >
                    <Link href="/skyline-lounge/demo-table-8">
                      View live demo
                    </Link>
                  </Button>
                </div>
                <p className="mt-5 text-xs leading-relaxed text-zinc-500">
                  Deploy in days. No guest app. Payments routed to your Stripe
                  account. EU-ready infrastructure.
                </p>
              </HeroItem>
            </HeroStagger>

            <div className="flex min-w-0 justify-center lg:order-2 lg:justify-end lg:pl-4">
              <EnterpriseHeroVisual />
            </div>
          </div>
        </section>

        {/* SECTION 2 — How it works */}
        <section id="how-it-works" className="border-t border-zinc-800 px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <AnimateInView className="mb-10 text-center">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Three steps. Zero friction.
              </h2>
            </AnimateInView>

            <StaggerInView className="grid gap-12 md:grid-cols-3 md:gap-0">
              {steps.map((step, i) => (
                <StaggerItem
                  key={step.num}
                  className={`relative px-4 text-center md:px-8 ${
                    i > 0 ? "md:border-l md:border-zinc-800" : ""
                  } ${i > 0 ? "border-t border-zinc-800 pt-12 md:border-t-0 md:pt-0" : ""}`}
                >
                  <span
                    className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 select-none text-8xl font-bold text-zinc-800"
                    aria-hidden
                  >
                    {step.num}
                  </span>
                  <div className="relative pt-6">
                    <step.icon className="mx-auto size-8 text-orange-500" />
                    <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                      {step.description}
                    </p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerInView>
          </div>
        </section>

        {/* SECTION 3 — Features */}
        <section id="features" className="border-t border-zinc-800 px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-6xl space-y-12 sm:space-y-16">
            {features.map((f) => (
              <AnimateInView key={f.title}>
                <div className="grid items-center gap-8 sm:gap-10 lg:grid-cols-2 lg:gap-16">
                  <div className={`min-w-0 ${f.reverse ? "lg:order-2" : ""}`}>
                    <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                      {f.title}
                    </h3>
                    <p className="mt-3 text-base leading-relaxed text-zinc-400 sm:mt-4 sm:text-lg">
                      {f.description}
                    </p>
                  </div>
                  <div
                    className={`flex min-w-0 w-full max-w-full items-center justify-center ${
                      f.device === "tablet"
                        ? "py-2 sm:py-4"
                        : "rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-4 sm:p-8 lg:p-10"
                    } ${f.reverse ? "lg:order-1" : ""}`}
                  >
                    {f.visual}
                  </div>
                </div>
              </AnimateInView>
            ))}
          </div>
        </section>

        {/* SECTION 4 — Stats */}
        <section className="border-y border-zinc-800 bg-zinc-900 px-6 py-12">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 md:grid-cols-4 md:gap-8">
            <CountUpStat value={30} prefix="< " suffix="s" label="Order Time" />
            <CountUpStat value={0} suffix="€" label="Setup Fee" />
            <CountUpStat value={99.9} suffix="%" decimals={1} label="Uptime" />
            <StatText display="24/7" label="Support" />
          </div>
        </section>

        {/* SECTION 5 — Pricing */}
        <section id="pricing" className="px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <AnimateInView className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Simple pricing. No surprises.
              </h2>
            </AnimateInView>

            <StaggerInView className="grid gap-6 lg:grid-cols-3">
              {plans.map((plan) => (
                <StaggerItem key={plan.name}>
                  <div
                    className={`relative flex h-full flex-col rounded-2xl border p-6 lg:p-8 ${
                      plan.highlighted
                        ? "border-orange-500 shadow-lg shadow-orange-500/10"
                        : "border-zinc-800 bg-zinc-900"
                    } ${!plan.highlighted ? "bg-zinc-900" : "bg-zinc-900/80"}`}
                  >
                    {plan.highlighted && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-3 py-0.5 text-xs font-semibold text-white">
                        Most popular
                      </span>
                    )}
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="text-zinc-500">{plan.period}</span>
                    </div>
                    <p className="mt-1 text-sm text-orange-500">{plan.fee}</p>
                    <p className="mt-2 text-sm text-zinc-400">{plan.description}</p>
                    <ul className="mt-6 flex-1 space-y-2.5">
                      {plan.features.map((feat) => (
                        <FeatureCheck key={feat}>{feat}</FeatureCheck>
                      ))}
                    </ul>
                    <Button
                      asChild
                      className={`mt-8 w-full ${
                        plan.highlighted
                          ? "bg-orange-500 hover:bg-orange-600"
                          : "bg-zinc-800 hover:bg-zinc-700"
                      }`}
                    >
                      <Link href="/signup">{plan.cta}</Link>
                    </Button>
                  </div>
                </StaggerItem>
              ))}
            </StaggerInView>
          </div>
        </section>

        {/* SECTION 6 — CTA */}
        <section className="px-6 py-16">
          <AnimateInView className="mx-auto max-w-5xl">
            <div className="rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-14 text-center md:px-16">
              <h2 className="text-3xl font-bold text-white md:text-4xl">
                Ready to modernize your venue?
              </h2>
              <p className="mt-3 text-lg text-orange-100">
                Set up in 10 minutes. Start accepting orders today.
              </p>
              <Button
                size="lg"
                asChild
                className="mt-8 h-12 bg-white px-10 text-base font-semibold text-orange-600 hover:bg-orange-50"
              >
                <Link href="/signup">Start Free</Link>
              </Button>
            </div>
          </AnimateInView>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-950 px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Product
              </h4>
              <ul className="mt-4 space-y-2 text-sm text-zinc-500">
                <li>
                  <a href="#features" className="hover:text-zinc-300">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-zinc-300">
                    Pricing
                  </a>
                </li>
                <li>
                  <Link
                    href="/skyline-lounge/demo-table-8"
                    className="hover:text-zinc-300"
                  >
                    Demo
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Company
              </h4>
              <ul className="mt-4 space-y-2 text-sm text-zinc-500">
                <li><a href="#" className="hover:text-zinc-300">About</a></li>
                <li><a href="#" className="hover:text-zinc-300">Blog</a></li>
                <li><a href="#" className="hover:text-zinc-300">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Legal
              </h4>
              <ul className="mt-4 space-y-2 text-sm text-zinc-500">
                <li><a href="#" className="hover:text-zinc-300">Privacy</a></li>
                <li><a href="#" className="hover:text-zinc-300">Terms</a></li>
                <li><a href="#" className="hover:text-zinc-300">Imprint</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Contact
              </h4>
              <ul className="mt-4 space-y-2 text-sm text-zinc-500">
                <li>
                  <a
                    href="mailto:hello@qrorder.app"
                    className="hover:text-zinc-300"
                  >
                    hello@qrorder.app
                  </a>
                </li>
                <li>Hamburg, DE</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-zinc-800 pt-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <QrCode className="size-4 text-orange-500" />
              <span className="text-sm font-medium text-zinc-50">QR Order</span>
              <span className="text-sm text-zinc-600">·</span>
              <span className="text-sm text-zinc-500">© 2026 QR Order</span>
            </div>
            <div className="flex items-center gap-5 text-zinc-500">
              <a href="#" aria-label="Twitter" className="hover:text-zinc-300">
                <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="#" aria-label="LinkedIn" className="hover:text-zinc-300">
                <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <a href="#" aria-label="GitHub" className="hover:text-zinc-300">
                <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
