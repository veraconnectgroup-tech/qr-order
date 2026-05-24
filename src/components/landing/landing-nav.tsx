"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#product", label: "Plattform", sectionId: "product" },
  { href: "#enterprise", label: "Enterprise", sectionId: "enterprise" },
  { href: "#pricing", label: "Preise", sectionId: "pricing" },
  { href: "/skyline-lounge/demo-table-8", label: "Demo", sectionId: null },
  { href: "/login", label: "Anmelden", sectionId: null },
];

export function LandingNav() {
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
  }, []);

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
            ? "border-[var(--lp-border-subtle)] bg-[rgba(9,9,11,0.82)] backdrop-blur-xl backdrop-saturate-[1.4]"
            : "border-transparent bg-transparent"
        )}
      >
        <LandingContainer wide className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-0">
            <span className="text-[22px] font-bold tracking-[-0.03em] text-[var(--lp-ink)]">
              vera
              <span className="text-[var(--lp-accent)]">.</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-[14px] font-medium transition hover:text-[var(--lp-ink)]",
                  link.sectionId && activeSection === link.sectionId
                    ? "text-[var(--lp-ink)]"
                    : "text-[var(--lp-muted)]"
                )}
              >
                {link.label}
              </Link>
            ))}
            <Button
              size="sm"
              asChild
              className="landing-btn-accent h-10 rounded-full px-6 text-[14px] font-semibold"
            >
              <Link href="/signup">Zugang anfordern</Link>
            </Button>
          </nav>

          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              aria-label={open ? "Menü schließen" : "Menü öffnen"}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex size-10 items-center justify-center text-[var(--lp-ink)]"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </LandingContainer>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 bg-[var(--lp-bg)] lg:hidden">
          <div className="flex h-16 items-center justify-between border-b border-[var(--lp-border-subtle)] px-6">
            <span className="text-[14px] font-semibold text-[var(--lp-ink)]">Menü</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Schließen">
              <X className="size-5 text-[var(--lp-ink)]" />
            </button>
          </div>
          <nav className="flex flex-col gap-1 px-6 py-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg py-3 text-[16px] font-medium text-[var(--lp-ink)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="px-6">
            <Button asChild className="landing-btn-accent h-11 w-full rounded-full">
              <Link href="/signup" onClick={() => setOpen(false)}>
                Zugang anfordern
              </Link>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
