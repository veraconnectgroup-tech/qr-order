"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#features-guest", label: "Platform" },
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
          "fixed inset-x-0 top-0 z-50 transition-colors duration-200",
          scrolled ? "bg-black/90" : "bg-transparent"
        )}
      >
        <LandingContainer wide className="flex h-14 items-center justify-between">
          <Link href="/" className="text-sm font-medium text-white">
            Denis
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[13px] text-zinc-500 transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-[13px] text-zinc-500 transition hover:text-white sm:inline"
            >
              Sign in
            </Link>
            <Button
              size="sm"
              asChild
              className="hidden h-8 rounded-md bg-[var(--qr-ember)] px-4 text-[13px] font-medium text-white hover:bg-[var(--qr-ember-hover)] sm:inline-flex"
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
          <nav className="flex flex-col gap-1 px-6 pt-20">
            {[...navLinks, { href: "/login", label: "Sign in" }].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="py-3 text-[16px] text-zinc-300"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="mt-4 py-3 text-[16px] font-medium text-white"
            >
              Get started
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
