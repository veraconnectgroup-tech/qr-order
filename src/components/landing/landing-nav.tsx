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
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--lp-border-subtle)] bg-[var(--lp-bg)]/95 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/" className="text-[13px] font-medium text-[var(--lp-ink)]">
              Denis
            </Link>
            <nav className="hidden items-center gap-6 lg:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[12px] text-[var(--lp-muted)] transition hover:text-[var(--lp-ink)]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-[12px] text-[var(--lp-muted)] transition hover:text-[var(--lp-ink)] sm:inline"
            >
              Sign in
            </Link>
            <Button
              size="sm"
              asChild
              className="hidden h-8 rounded-md bg-[var(--lp-ember)] px-4 text-[12px] font-medium text-white hover:bg-[var(--lp-ember-hover)] sm:inline-flex"
            >
              <Link href="/signup">Open Denis</Link>
            </Button>
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex size-8 items-center justify-center text-[var(--lp-muted)] lg:hidden"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 bg-[var(--lp-bg)] lg:hidden">
          <nav className="flex flex-col border-t border-[var(--lp-border-subtle)] px-6 pt-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="border-b border-[var(--lp-border-subtle)] py-3.5 text-[14px] text-[var(--lp-muted)]"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="border-b border-[var(--lp-border-subtle)] py-3.5 text-[14px] text-[var(--lp-muted)]"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className={cn("py-4 text-[14px] font-medium text-[var(--lp-ink)]")}
            >
              Open Denis
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
