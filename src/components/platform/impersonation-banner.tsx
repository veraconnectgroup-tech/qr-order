"use client";

import { exitImpersonation } from "@/lib/platform/platform-actions";
import { Button } from "@/components/ui/button";

export function ImpersonationBanner({ orgName }: { orgName: string }) {
  return (
    <div
      role="region"
      aria-label="Impersonation mode"
      className="border-b border-violet-500/40 bg-violet-600 px-4 py-2 text-center text-sm text-white"
    >
      <span>
        Viewing as <strong>{orgName}</strong>
      </span>
      <form action={exitImpersonation} className="ms-3 inline">
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          className="h-7 bg-white/15 text-white hover:bg-white/25"
        >
          Exit
        </Button>
      </form>
    </div>
  );
}
