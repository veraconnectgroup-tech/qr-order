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
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-zinc-950 px-6 py-16 text-center text-zinc-100">
      <h1 className="text-xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-sm text-zinc-400">{error.message}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button
          type="button"
          onClick={reset}
          className="bg-orange-500 hover:bg-orange-600"
        >
          Try again
        </Button>
        <Button variant="outline" asChild className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-zinc-900 hover:text-white">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
