"use client";

import Link from "next/link";
import { QrCard } from "@/components/design-system/qr-card";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <QrCard variant="muted" className="w-full max-w-md">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {process.env.NODE_ENV === "production"
            ? "An unexpected error occurred. Please try again."
            : error.message}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button type="button" size="lg" onClick={reset}>
            Try again
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/admin">Back to admin</Link>
          </Button>
        </div>
      </QrCard>
    </div>
  );
}
