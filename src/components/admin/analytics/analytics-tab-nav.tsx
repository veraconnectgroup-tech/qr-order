"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function AnalyticsTabNav() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "overview";

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "intelligence", label: "Intelligence" },
    { id: "menu-engineering", label: "Menu Engineering" },
  ] as const;

  return (
    <nav className="flex flex-wrap gap-2">
      {tabs.map((entry) => {
        const params = new URLSearchParams(searchParams.toString());
        if (entry.id === "overview") {
          params.delete("tab");
        } else {
          params.set("tab", entry.id);
        }
        const href = params.toString()
          ? `/admin/analytics?${params.toString()}`
          : "/admin/analytics";

        return (
          <Link
            key={entry.id}
            href={href}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              tab === entry.id
                ? "border-dash-accent bg-dash-accent/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted/50"
            )}
          >
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );
}
