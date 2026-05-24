"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PlatformError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-sm text-neutral-600">
        Platform data could not be loaded. Please try again.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/platform">Back to overview</Link>
        </Button>
      </div>
    </div>
  );
}
