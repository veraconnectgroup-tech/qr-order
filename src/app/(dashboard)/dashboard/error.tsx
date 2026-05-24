"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-dash-bg px-6 py-16 text-center text-dash-text">
      <h1 className="text-xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-sm text-dash-text-muted">
        {process.env.NODE_ENV === "production"
          ? "An unexpected error occurred. Please try again."
          : error.message}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button
          type="button"
          onClick={reset}
          className="bg-dash-accent hover:bg-dash-accent-hover"
        >
          Try again
        </Button>
        <Button variant="outline" asChild className="border-dash-surface-overlay bg-transparent text-dash-text-secondary hover:bg-dash-surface hover:text-white">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
