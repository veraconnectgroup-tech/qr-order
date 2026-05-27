"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#system", label: "Overview" },
  { href: "#operations", label: "Operations" },
  { href: "/enterprise", label: "Enterprise" },
  { href: "#pricing", label: "Pricing" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-zinc-800/80 bg-[#08080c]/95 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/" className="text-[13px] font-medium text-white">
              Denis
            </Link>
            <nav className="hidden items-center gap-6 lg:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[12px] text-zinc-500 transition hover:text-zinc-300"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-[12px] text-zinc-500 transition hover:text-zinc-300 sm:inline"
            >
              Sign in
            </Link>
            <Button
              size="sm"
              asChild
              className="hidden h-8 rounded-md bg-[var(--qr-ember)] px-4 text-[12px] font-medium text-white hover:bg-[var(--qr-ember-hover)] sm:inline-flex"
            >
              <Link href="/signup">Open Denis</Link>
            </Button>
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex size-8 items-center justify-center text-zinc-400 lg:hidden"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 bg-[#08080c] lg:hidden">
          <nav className="flex flex-col border-t border-zinc-800/80 px-6 pt-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="border-b border-zinc-800/60 py-3.5 text-[14px] text-zinc-400"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="border-b border-zinc-800/60 py-3.5 text-[14px] text-zinc-400"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className={cn("py-4 text-[14px] font-medium text-white")}
            >
              Open Denis
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
