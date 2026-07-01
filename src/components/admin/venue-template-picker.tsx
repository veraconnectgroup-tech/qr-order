"use client";

import { VENUE_TEMPLATES } from "@/lib/venue-templates/template-registry";
import { cn } from "@/lib/utils";

export function VenueTemplatePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (templateId: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground/90">
        Denis venue template
      </p>
      <p className="text-xs text-muted-foreground">
        Optional — pre-configures persona, proactive rules, and starter menu
        sections.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "rounded-lg border px-3 py-3 text-left text-sm transition-colors",
            value == null
              ? "border-orange-500/60 bg-orange-500/10"
              : "border-border bg-muted/20 hover:bg-muted/40"
          )}
        >
          <span className="font-medium text-foreground">Blank location</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Configure Denis manually later.
          </span>
        </button>
        {VENUE_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onChange(template.id)}
            className={cn(
              "rounded-lg border px-3 py-3 text-left text-sm transition-colors",
              value === template.id
                ? "border-orange-500/60 bg-orange-500/10"
                : "border-border bg-muted/20 hover:bg-muted/40"
            )}
          >
            <span className="font-medium text-foreground">
              {template.icon} {template.name}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {template.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
