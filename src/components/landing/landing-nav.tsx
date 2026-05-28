"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { DenisBrandMark } from "@/components/design-system/denis-brand-mark";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#features-guest", label: "Platform", sectionId: "features-guest" },
  { href: "/enterprise", label: "Enterprise", sectionId: null },
  { href: "#pricing", label: "Pricing", sectionId: "pricing" },
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
            ? "border-white/[0.06] bg-black/80 backdrop-blur-xl"
            : "border-transparent bg-transparent"
        )}
      >
        <LandingContainer wide className="flex h-14 items-center justify-between">
          <Link href="/" className="inline-flex shrink-0">
            <DenisBrandMark className="[&_.text-dash-text-muted]:text-zinc-500 [&_.text-dash-text]:text-white" />
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-[13px] font-medium transition hover:text-white",
                  link.sectionId && activeSection === link.sectionId
                    ? "text-white"
                    : "text-zinc-500"
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
              className="hidden h-8 px-3 text-[13px] font-medium text-zinc-400 hover:bg-white/5 hover:text-white sm:inline-flex"
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              size="sm"
              asChild
              className="hidden h-8 rounded-full bg-[var(--qr-ember)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--qr-ember-hover)] sm:inline-flex"
            >
              <Link href="/signup">Get started</Link>
            </Button>
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex size-8 items-center justify-center text-white lg:hidden"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </LandingContainer>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 bg-black lg:hidden">
          <div className="flex h-14 items-center justify-between border-b border-white/[0.06] px-6">
            <span className="text-[14px] font-semibold text-white">Menu</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close">
              <X className="size-5 text-white" />
            </button>
          </div>
          <nav className="flex flex-col gap-1 px-6 py-6">
            {[...navLinks, { href: "/login", label: "Sign in", sectionId: null }].map(
              (link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg py-3 text-[16px] font-medium text-white"
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>
          <div className="px-6">
            <Button
              asChild
              className="h-11 w-full rounded-full bg-[var(--qr-ember)] text-white hover:bg-[var(--qr-ember-hover)]"
            >
              <Link href="/signup" onClick={() => setOpen(false)}>
                Get started
              </Link>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
