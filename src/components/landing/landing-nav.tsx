"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DenisBrandMark } from "@/components/design-system/denis-brand-mark";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingNav() {
  const { copy } = useLandingCopy();
  const { nav } = copy;
  const navLinks = useMemo(
    () => [
      { href: "#features-guest", label: nav.platform, sectionId: "features-guest" },
      { href: "#enterprise", label: nav.enterprise, sectionId: "enterprise" },
      { href: "#pricing", label: nav.pricing, sectionId: "pricing" },
      { href: "#faq", label: nav.faq, sectionId: "faq" },
    ],
    [nav]
  );

  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sectionIds = navLinks
      .map((l) => l.sectionId)
      .filter((id): id is string => Boolean(id));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) {
          setActiveSection(visible.target.id);
        }
      },
      { rootMargin: "-40% 0px -45% 0px", threshold: [0, 0.25, 0.5] }
    );

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [navLinks]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-200",
          scrolled
            ? "border-[var(--lp-border-subtle)] bg-[color-mix(in_srgb,var(--lp-bg)_85%,transparent)] backdrop-blur-xl"
            : "border-transparent bg-transparent"
        )}
      >
        <LandingContainer wide className="flex h-14 items-center justify-between gap-4">
          <Link href="/" className="inline-flex shrink-0">
            <DenisBrandMark className="[&_.text-dash-text-muted]:text-[var(--lp-subtle)] [&_.text-dash-text]:text-[var(--lp-ink)]" />
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-[13px] font-medium transition hover:text-[var(--lp-ink)]",
                  link.sectionId && activeSection === link.sectionId
                    ? "text-[var(--lp-ink)]"
                    : "text-[var(--lp-muted)]"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="hidden h-8 px-3 text-[13px] font-medium text-[var(--lp-muted)] hover:bg-black/5 hover:text-[var(--lp-ink)] sm:inline-flex"
            >
              <Link href="/login">{nav.signIn}</Link>
            </Button>
            <Button
              size="sm"
              asChild
              className="landing-btn-primary hidden h-8 px-4 text-[13px] font-medium sm:inline-flex"
            >
              <Link href="/signup">{nav.cta}</Link>
            </Button>
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex size-8 items-center justify-center text-[var(--lp-ink)] lg:hidden"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </LandingContainer>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 bg-[var(--lp-bg)] lg:hidden">
          <div className="flex h-14 items-center justify-between border-b border-[var(--lp-border-subtle)] px-6">
            <span className="text-[14px] font-semibold text-[var(--lp-ink)]">Menu</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close">
              <X className="size-5 text-[var(--lp-ink)]" />
            </button>
          </div>
          <nav className="flex flex-col gap-1 px-6 py-6">
            {[...navLinks, { href: "/login", label: nav.signIn, sectionId: null }].map(
              (link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg py-3 text-[16px] font-medium text-[var(--lp-ink)]"
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>
          <div className="px-6">
            <Button
              asChild
              className="landing-btn-primary h-11 w-full font-medium"
            >
              <Link href="/signup" onClick={() => setOpen(false)}>
                {nav.cta}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
