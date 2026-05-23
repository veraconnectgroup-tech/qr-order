"use client";

import Link from "next/link";
import { Menu, QrCode, X } from "lucide-react";
import { useEffect, useState } from "react";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#modules", label: "Platform" },
  { href: "/enterprise", label: "Enterprise" },
  { href: "#pricing", label: "Pricing" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
            ? "border-zinc-800 bg-zinc-950/95 backdrop-blur-md"
            : "border-transparent bg-transparent"
        )}
      >
        <LandingContainer wide className="flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <QrCode className="size-5 text-[var(--lp-accent)]" strokeWidth={1.75} />
            <span className="text-[14px] font-semibold text-white">QR Order</span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[13px] font-medium text-zinc-400 transition hover:text-white"
              >
                {link.label}
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
            {[...navLinks, { href: "/login", label: "Log in" }].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg py-3 text-[16px] font-medium text-white"
              >
                {link.label}
              </Link>
            ))}
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
