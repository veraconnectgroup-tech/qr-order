"use client";

import Link from "next/link";
import { DenisBrandMark } from "@/components/design-system/denis-brand-mark";
import { QrCard } from "@/components/design-system/qr-card";
import { Button } from "@/components/ui/button";

export default function AuthError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="dashboard-theme flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border px-5 py-4">
        <Link href="/" className="inline-flex">
          <DenisBrandMark />
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <QrCard variant="muted" className="w-full max-w-md text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            Something went wrong
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            We could not complete sign-in. Please try again.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button type="button" size="lg" onClick={reset}>
              Try again
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/login">Back to login</Link>
            </Button>
          </div>
        </QrCard>
      </div>
    </div>
  );
}
