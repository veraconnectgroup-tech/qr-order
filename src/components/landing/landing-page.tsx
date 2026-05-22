"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  ChefHat,
  CreditCard,
  QrCode,
  Shield,
  Smartphone,
  Users,
} from "lucide-react";
import {
  AnimateInView,
  HeroItem,
  HeroStagger,
  StaggerInView,
  StaggerItem,
} from "@/components/landing/animate-in-view";
import {
  CheckoutShowcase,
  FeatureCheck,
  GuestMenuShowcase,
  HistoryShowcase,
  KitchenShowcase,
  TablesShowcase,
} from "@/components/landing/product-showcases";
import { EnterpriseHeroVisual } from "@/components/landing/enterprise-hero-visual";
import { platformFeeDescriptionEn } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TRANSACTION_FEE = platformFeeDescriptionEn();

const navLinks = [
  { href: "#platform", label: "Platform" },
  { href: "#product", label: "Product" },
  { href: "#enterprise", label: "Enterprise" },
  { href: "#pricing", label: "Pricing" },
];

const trustLogos = [
  "Skyline Lounge",
  "Harbor Group",
  "Altstadt Bars",
  "Rooftop Collective",
  "Nord Hospitality",
];

const platformPillars = [
  {
    icon: Smartphone,
    title: "Guest experience",
    description:
      "QR menus on any phone. No app, no account — browse, customize, and order in seconds.",
  },
  {
    icon: ChefHat,
    title: "Live operations",
    description:
      "Orders, kitchen display, table status, and waiter calls in one staff workspace.",
  },
  {
    icon: CreditCard,
    title: "Payments & billing",
    description:
      "Stripe Connect, pay at bar or table, session bills, and email receipts — your rules.",
  },
  {
    icon: BarChart3,
    title: "Reporting",
    description:
      "Revenue, order history, and CSV export built for finance and multi-location review.",
  },
];

const problems = [
  {
    title: "Fragmented ordering",
    description:
      "Paper tickets, WhatsApp messages, and manual entry slow service and introduce errors.",
  },
  {
    title: "Payment friction",
    description:
      "Guests wait to flag staff; venues lose throughput when checkout is not built into the flow.",
  },
  {
    title: "No single source of truth",
    description:
      "Without live order state, kitchen and floor teams operate on guesswork during peak hours.",
  },
];

const productSections = [
  {
    eyebrow: "Guest",
    title: "Ordering that feels native on mobile",
    description:
      "A fast, thumb-friendly menu with modifiers, serve sizes, and live order tracking. Designed for bars, restaurants, and rooftop venues.",
    visual: <GuestMenuShowcase />,
    device: "phone" as const,
  },
  {
    eyebrow: "Payments",
    title: "Checkout on your terms",
    description:
      "Card online via Stripe, pay in person at bar, counter, or table, or card terminal brought to the guest — configured per venue.",
    visual: <CheckoutShowcase />,
    device: "phone" as const,
  },
  {
    eyebrow: "Floor",
    title: "Every table, one live view",
    description:
      "Zones, QR codes, session totals, and attention states — so hosts know where to act before guests have to ask.",
    visual: <TablesShowcase />,
    device: "tablet" as const,
  },
  {
    eyebrow: "Kitchen",
    title: "Prep display built for peak service",
    description:
      "Accepted orders hit the line instantly with timers and large tap targets — drinks and food on one screen.",
    visual: <KitchenShowcase />,
    device: "tablet" as const,
  },
  {
    eyebrow: "Analytics",
    title: "Numbers your team can trust",
    description:
      "Daily revenue, order volume, and top items with filters and export — ready for operators and accountants.",
    visual: <HistoryShowcase />,
    device: "tablet" as const,
  },
];

const enterpriseFeatures = [
  {
    icon: Shield,
    title: "Secure by design",
    description: "Stripe-hosted payments, role-based staff access, and audit-friendly order history.",
  },
  {
    icon: Building2,
    title: "Multi-location ready",
    description: "Organizations, locations, zones, and tables — structured for groups that scale.",
  },
  {
    icon: Users,
    title: "Staff & roles",
    description: "Owner, manager, floor, and kitchen views with invites — no shared passwords.",
  },
];

const plans = [
  {
    name: "Standard",
    price: "€0",
    period: "/ month",
    fee: TRANSACTION_FEE,
    description: "Full platform. Pay only when guests pay by card.",
    features: [
      "QR guest menus & live orders",
      "Kitchen display & waiter calls",
      "Stripe Connect card payments",
      "Bar, counter & table payment options",
      "Analytics & CSV export",
      "Staff invites & roles",
    ],
    cta: "Request access",
    primary: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    fee: "Volume pricing & dedicated onboarding",
    description: "For chains, hotel F&B, and high-volume venues.",
    features: [
      "Everything in Standard",
      "Multi-location rollout support",
      "Custom integrations",
      "Priority support & SLA options",
      "Dedicated success contact",
    ],
    cta: "Contact sales",
    primary: false,
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
      {children}
    </p>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#09090b] text-zinc-50 antialiased">
      {/* Nav — Cursor-style minimal */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
              <QrCode className="size-3.5 text-zinc-300" strokeWidth={1.75} />
            </div>
            <span className="text-[13px] font-medium tracking-tight text-zinc-100">
              QR Order
            </span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[13px] text-zinc-400 transition hover:text-zinc-100"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="hidden h-8 px-3 text-[13px] text-zinc-400 hover:text-zinc-100 sm:inline-flex"
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="hidden h-8 px-3 text-[13px] text-zinc-400 hover:text-zinc-100 md:inline-flex"
            >
              <a href="mailto:hello@qrorder.app">Contact sales</a>
            </Button>
            <Button
              size="sm"
              asChild
              className="h-8 rounded-md bg-zinc-100 px-3.5 text-[13px] font-medium text-zinc-950 hover:bg-white"
            >
              <Link href="/signup">Request access</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative border-b border-white/[0.06] px-5 pb-16 pt-24 sm:px-6 sm:pb-20 sm:pt-28 lg:pb-24 lg:pt-32">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.06),transparent_70%)]"
            aria-hidden
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
            <HeroStagger className="max-w-xl lg:max-w-none">
              <HeroItem>
                <SectionLabel>Hospitality ordering platform</SectionLabel>
              </HeroItem>
              <HeroItem>
                <h1 className="mt-5 text-[2rem] font-semibold leading-[1.08] tracking-[-0.03em] text-zinc-50 sm:text-5xl lg:text-[3.25rem]">
                  Built for venues that run at full capacity
                </h1>
              </HeroItem>
              <HeroItem>
                <p className="mt-5 text-base leading-relaxed text-zinc-400 sm:text-lg sm:leading-relaxed">
                  QR Order connects guest menus, live operations, and payments —
                  one system for restaurants, bars, and multi-location groups.
                </p>
              </HeroItem>
              <HeroItem>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button
                    size="lg"
                    asChild
                    className="h-11 rounded-md bg-zinc-100 px-6 text-sm font-medium text-zinc-950 hover:bg-white"
                  >
                    <Link href="/signup">
                      Request access
                      <ArrowRight className="ml-1.5 size-4" />
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    asChild
                    className="h-11 rounded-md border-white/[0.12] bg-transparent px-6 text-sm font-medium text-zinc-200 hover:bg-white/[0.04]"
                  >
                    <Link href="/skyline-lounge/demo-table-8">View live demo</Link>
                  </Button>
                </div>
              </HeroItem>
              <HeroItem>
                <p className="mt-5 text-xs leading-relaxed text-zinc-600">
                  No guest app · Stripe Connect · Deploy in days · {TRANSACTION_FEE}
                </p>
              </HeroItem>
            </HeroStagger>

            <div className="relative min-w-0 lg:pl-4">
              <EnterpriseHeroVisual />
            </div>
          </div>
        </section>

        {/* Trust strip — Numero / Cursor style */}
        <section className="border-b border-white/[0.06] py-10">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <p className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-600">
              Built for modern hospitality teams
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {trustLogos.map((name) => (
                <span
                  key={name}
                  className="text-sm font-medium tracking-tight text-zinc-600"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Platform pillars */}
        <section id="platform" className="scroll-mt-20 px-5 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <AnimateInView className="max-w-2xl">
              <SectionLabel>Platform</SectionLabel>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-zinc-50 sm:text-4xl">
                One stack from guest scan to closed bill
              </h2>
              <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
                Replace fragmented tools with a platform engineered for speed,
                accuracy, and auditability — with staff in the loop at every step.
              </p>
            </AnimateInView>

            <StaggerInView className="mt-14 grid gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-4">
              {platformPillars.map((pillar) => (
                <StaggerItem
                  key={pillar.title}
                  className="bg-[#09090b] p-6 sm:p-7"
                >
                  <pillar.icon
                    className="size-5 text-zinc-400"
                    strokeWidth={1.5}
                  />
                  <h3 className="mt-4 text-sm font-semibold text-zinc-100">
                    {pillar.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                    {pillar.description}
                  </p>
                </StaggerItem>
              ))}
            </StaggerInView>
          </div>
        </section>

        {/* Problem — Numero-style */}
        <section className="border-y border-white/[0.06] bg-white/[0.02] px-5 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
              <AnimateInView>
                <SectionLabel>The problem</SectionLabel>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-zinc-50 sm:text-4xl">
                  Service scales. Manual processes do not.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-zinc-400">
                  Most venues add headcount and workarounds on top of broken
                  flows. QR Order replaces that with software your floor and
                  kitchen can actually run on.
                </p>
              </AnimateInView>
              <StaggerInView className="space-y-px overflow-hidden rounded-xl border border-white/[0.06]">
                {problems.map((item, i) => (
                  <StaggerItem
                    key={item.title}
                    className={cn(
                      "bg-[#09090b] px-6 py-5 sm:px-7 sm:py-6",
                      i > 0 && "border-t border-white/[0.06]"
                    )}
                  >
                    <h3 className="text-sm font-semibold text-zinc-200">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                      {item.description}
                    </p>
                  </StaggerItem>
                ))}
              </StaggerInView>
            </div>
          </div>
        </section>

        {/* Product deep-dives */}
        <section id="product" className="scroll-mt-20 px-5 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl space-y-24 sm:space-y-28">
            {productSections.map((section, i) => (
              <AnimateInView key={section.title}>
                <div
                  className={cn(
                    "grid items-center gap-10 lg:grid-cols-2 lg:gap-16",
                    i % 2 === 1 && "lg:[&>div:first-child]:order-2"
                  )}
                >
                  <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                    <SectionLabel>{section.eyebrow}</SectionLabel>
                    <h3 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-zinc-50 sm:text-3xl">
                      {section.title}
                    </h3>
                    <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
                      {section.description}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex min-w-0 items-center justify-center",
                      section.device === "phone"
                        ? "rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-10"
                        : "py-2",
                      i % 2 === 1 ? "lg:order-1" : ""
                    )}
                  >
                    {section.visual}
                  </div>
                </div>
              </AnimateInView>
            ))}
          </div>
        </section>

        {/* Enterprise */}
        <section
          id="enterprise"
          className="scroll-mt-20 border-t border-white/[0.06] px-5 py-20 sm:px-6 sm:py-24"
        >
          <div className="mx-auto max-w-6xl">
            <AnimateInView className="mx-auto max-w-2xl text-center">
              <SectionLabel>Enterprise</SectionLabel>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
                Ready for groups that need control
              </h2>
              <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
                Security, structure, and support that match how professional
                operators run hospitality — not a side project bolted onto a menu PDF.
              </p>
            </AnimateInView>

            <StaggerInView className="mt-14 grid gap-6 md:grid-cols-3">
              {enterpriseFeatures.map((item) => (
                <StaggerItem
                  key={item.title}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-7"
                >
                  <item.icon className="size-5 text-zinc-400" strokeWidth={1.5} />
                  <h3 className="mt-4 text-sm font-semibold text-zinc-100">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                    {item.description}
                  </p>
                </StaggerItem>
              ))}
            </StaggerInView>

            <AnimateInView className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-600">
              <span className="flex items-center gap-2">
                <Shield className="size-3.5" strokeWidth={1.5} />
                Stripe Connect
              </span>
              <span className="flex items-center gap-2">
                <CreditCard className="size-3.5" strokeWidth={1.5} />
                PCI via Stripe
              </span>
              <span className="flex items-center gap-2">
                <Building2 className="size-3.5" strokeWidth={1.5} />
                Multi-location
              </span>
            </AnimateInView>
          </div>
        </section>

        {/* Testimonial */}
        <section className="border-y border-white/[0.06] bg-white/[0.02] px-5 py-20 sm:px-6">
          <AnimateInView className="mx-auto max-w-3xl text-center">
            <blockquote className="text-xl font-medium leading-relaxed tracking-[-0.01em] text-zinc-200 sm:text-2xl">
              &ldquo;We needed ordering that guests actually use and staff can
              trust during Friday rush — not another PDF menu with a payment link
              duct-taped on.&rdquo;
            </blockquote>
            <footer className="mt-8">
              <p className="text-sm font-medium text-zinc-300">Operations lead</p>
              <p className="mt-1 text-sm text-zinc-600">Multi-location bar group</p>
            </footer>
          </AnimateInView>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 px-5 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <AnimateInView className="mx-auto max-w-2xl text-center">
              <SectionLabel>Pricing</SectionLabel>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
                Transparent economics
              </h2>
              <p className="mt-4 text-base text-zinc-400">
                No monthly platform fee on Standard. Card processing via Stripe
                with a clear per-order fee.
              </p>
            </AnimateInView>

            <StaggerInView className="mx-auto mt-14 grid max-w-4xl gap-6 lg:grid-cols-2">
              {plans.map((plan) => (
                <StaggerItem key={plan.name}>
                  <div
                    className={cn(
                      "flex h-full flex-col rounded-xl border p-7 sm:p-8",
                      plan.primary
                        ? "border-white/[0.12] bg-white/[0.03]"
                        : "border-white/[0.06] bg-transparent"
                    )}
                  >
                    <h3 className="text-sm font-medium text-zinc-400">
                      {plan.name}
                    </h3>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-4xl font-semibold tracking-tight text-zinc-50">
                        {plan.price}
                      </span>
                      {plan.period && (
                        <span className="text-sm text-zinc-600">{plan.period}</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-zinc-500">{plan.fee}</p>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                      {plan.description}
                    </p>
                    <ul className="mt-6 flex-1 space-y-2.5 border-t border-white/[0.06] pt-6">
                      {plan.features.map((feat) => (
                        <FeatureCheck key={feat}>{feat}</FeatureCheck>
                      ))}
                    </ul>
                    <Button
                      asChild
                      className={cn(
                        "mt-8 h-11 w-full rounded-md text-sm font-medium",
                        plan.primary
                          ? "bg-zinc-100 text-zinc-950 hover:bg-white"
                          : "border border-white/[0.12] bg-transparent text-zinc-200 hover:bg-white/[0.04]"
                      )}
                      variant={plan.primary ? "default" : "outline"}
                    >
                      <Link
                        href={
                          plan.primary ? "/signup" : "mailto:hello@qrorder.app"
                        }
                      >
                        {plan.cta}
                      </Link>
                    </Button>
                  </div>
                </StaggerItem>
              ))}
            </StaggerInView>
          </div>
        </section>

        {/* Final CTA — restrained, not gradient banner */}
        <section className="px-5 pb-24 pt-4 sm:px-6">
          <AnimateInView className="mx-auto max-w-6xl">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-8 py-14 text-center sm:px-16 sm:py-16">
              <h2 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-50 sm:text-3xl">
                See QR Order on your floor
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-base text-zinc-400">
                Request access for your venue or book a walkthrough with our team.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  size="lg"
                  asChild
                  className="h-11 rounded-md bg-zinc-100 px-7 text-sm font-medium text-zinc-950 hover:bg-white"
                >
                  <Link href="/signup">Request access</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="h-11 rounded-md border-white/[0.12] bg-transparent px-7 text-sm text-zinc-300 hover:bg-white/[0.04]"
                >
                  <a href="mailto:hello@qrorder.app">Contact sales</a>
                </Button>
              </div>
            </div>
          </AnimateInView>
        </section>
      </main>

      {/* Footer — enterprise columns */}
      <footer className="border-t border-white/[0.06] px-5 py-14 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Link href="/" className="flex items-center gap-2">
                <QrCode className="size-4 text-zinc-400" strokeWidth={1.75} />
                <span className="text-sm font-medium text-zinc-200">QR Order</span>
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-600">
                QR ordering and payments for restaurants, bars, and hospitality
                groups.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Product
              </h4>
              <ul className="mt-4 space-y-2.5 text-sm text-zinc-600">
                <li><a href="#platform" className="hover:text-zinc-300">Platform</a></li>
                <li><a href="#product" className="hover:text-zinc-300">Product tour</a></li>
                <li><a href="#pricing" className="hover:text-zinc-300">Pricing</a></li>
                <li>
                  <Link href="/skyline-lounge/demo-table-8" className="hover:text-zinc-300">
                    Live demo
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Company
              </h4>
              <ul className="mt-4 space-y-2.5 text-sm text-zinc-600">
                <li><a href="#enterprise" className="hover:text-zinc-300">Enterprise</a></li>
                <li><a href="mailto:hello@qrorder.app" className="hover:text-zinc-300">Contact</a></li>
                <li><Link href="/login" className="hover:text-zinc-300">Sign in</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Legal
              </h4>
              <ul className="mt-4 space-y-2.5 text-sm text-zinc-600">
                <li><a href="#" className="hover:text-zinc-300">Privacy</a></li>
                <li><a href="#" className="hover:text-zinc-300">Terms</a></li>
                <li><a href="#" className="hover:text-zinc-300">Imprint</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/[0.06] pt-8 sm:flex-row sm:items-center">
            <p className="text-xs text-zinc-600">© 2026 QR Order · Hamburg, DE</p>
            <p className="text-xs text-zinc-700">
              Payments powered by Stripe Connect
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
