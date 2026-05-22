"use client";

import Link from "next/link";
import { Menu, QrCode, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#platform", label: "Platform" },
  { href: "#product", label: "Product" },
  { href: "#enterprise", label: "Enterprise" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
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
          "fixed inset-x-0 top-0 z-50 transition-[border-color,background-color,box-shadow] duration-300",
          scrolled
            ? "border-b border-white/[0.08] bg-[#09090b]/90 shadow-[0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-xl"
            : "border-b border-transparent bg-transparent"
        )}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:h-[3.75rem] sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
              <QrCode className="size-3.5 text-zinc-300" strokeWidth={1.75} />
            </div>
            <span className="font-display text-[13px] font-medium tracking-tight text-zinc-100">
              QR Order
            </span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[13px] text-zinc-400 transition-colors hover:text-zinc-100"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/skyline-lounge/demo-table-8"
              className="text-[13px] text-zinc-400 transition-colors hover:text-zinc-100"
            >
              Demo
            </Link>
          </nav>

          <div className="flex items-center gap-2">
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
              className="hidden h-8 rounded-md bg-zinc-100 px-3.5 text-[13px] font-medium text-zinc-950 hover:bg-white sm:inline-flex"
            >
              <Link href="/signup">Request access</Link>
            </Button>
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex size-9 items-center justify-center rounded-md border border-white/[0.08] text-zinc-300 lg:hidden"
            >
              {open ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu overlay"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 top-14 border-b border-white/[0.08] bg-[#09090b] px-5 py-6 shadow-2xl">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-medium text-zinc-200 hover:bg-white/[0.04]"
                >
                  {link.label}
                </a>
              ))}
              <Link
                href="/skyline-lounge/demo-table-8"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-zinc-200 hover:bg-white/[0.04]"
              >
                Live demo
              </Link>
            </nav>
            <div className="mt-6 flex flex-col gap-2 border-t border-white/[0.06] pt-6">
              <Button asChild variant="outline" className="h-11 border-white/[0.12] bg-transparent">
                <Link href="/login" onClick={() => setOpen(false)}>
                  Sign in
                </Link>
              </Button>
              <Button asChild className="h-11 bg-zinc-100 text-zinc-950 hover:bg-white">
                <Link href="/signup" onClick={() => setOpen(false)}>
                  Request access
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
