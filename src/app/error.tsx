"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 py-16 text-center text-zinc-100">
      <h1 className="text-xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <Button
        type="button"
        onClick={reset}
        className="mt-8 bg-orange-500 hover:bg-orange-600"
      >
        Try again
      </Button>
    </div>
  );
}
