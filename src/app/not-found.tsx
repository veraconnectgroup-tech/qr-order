import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center text-zinc-50">
      <p className="text-sm font-medium uppercase tracking-wider text-zinc-500">
        404
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
        This link may be outdated, or the venue has not finished setup yet. Try
        the demo menu or return to the homepage.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild className="bg-zinc-100 text-zinc-950 hover:bg-white">
          <Link href="/">Home</Link>
        </Button>
        <Button asChild variant="outline" className="border-zinc-700">
          <Link href="/skyline-lounge/demo-table-8">View demo menu</Link>
        </Button>
      </div>
    </div>
  );
}
