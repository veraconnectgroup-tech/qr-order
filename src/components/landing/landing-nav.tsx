"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#modules", label: "Platform", sectionId: "modules" },
  { href: "/enterprise", label: "Enterprise", sectionId: null },
  { href: "#pricing", label: "Pricing", sectionId: "pricing" },
  { href: "#product", label: "Product", sectionId: "product" },
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
            ? "landing-nav-gradient-border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md"
            : "border-transparent bg-transparent"
        )}
      >
        <LandingContainer wide className="flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-[16px] font-bold tracking-[-0.03em] text-white">VERA</span>
            <span className="ml-1.5 rounded-[4px] bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400">
              Hospitality
            </span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative text-[13px] font-medium transition hover:text-white",
                  link.sectionId && activeSection === link.sectionId
                    ? "text-white"
                    : "text-zinc-400"
                )}
              >
                {link.label}
                {link.sectionId && activeSection === link.sectionId && (
                  <span className="absolute -bottom-[1.15rem] left-0 right-0 h-0.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                )}
              </Link>
            ))}
            <Link
              href="/skyline-lounge/demo-table-8"
              className="text-[13px] font-medium text-zinc-400 transition hover:text-white"
            >
              Demo
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="hidden h-8 px-3 text-[13px] font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white sm:inline-flex"
            >
              <Link href="/login">Log in</Link>
            </Button>
            <Button
              size="sm"
              asChild
              className="landing-btn-accent hidden h-8 rounded-full px-4 text-[13px] font-semibold sm:inline-flex"
            >
              <Link href="/signup">Request access</Link>
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
        <div className="fixed inset-0 z-40 bg-zinc-950 lg:hidden">
          <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-6">
            <span className="text-[14px] font-semibold text-white">Menu</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close">
              <X className="size-5 text-white" />
            </button>
          </div>
          <nav className="flex flex-col gap-1 px-6 py-6">
            {[...navLinks, { href: "/login", label: "Log in", sectionId: null }].map(
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
            <Button asChild className="landing-btn-accent h-11 w-full rounded-full">
              <Link href="/signup" onClick={() => setOpen(false)}>
                Request access
              </Link>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
