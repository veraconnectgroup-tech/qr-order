"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  formatAnalyticsIsoDate,
  formatAnalyticsRangeLabel,
  isAnalyticsPreset,
  resolveAnalyticsDateRange,
  type AnalyticsPreset,
} from "@/lib/analytics/date-range";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const PRESETS: Array<{ id: AnalyticsPreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom" },
];

export function AnalyticsDateRangePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useMemo(
    () => ({
      preset: searchParams.get("preset") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    }),
    [searchParams]
  );
  const range = resolveAnalyticsDateRange(params);
  const [open, setOpen] = useState(false);
  const [customRange, setCustomRange] = useState<DateRange | undefined>({
    from: range.start,
    to: range.end,
  });

  function pushParams(next: {
    preset: AnalyticsPreset;
    from?: string;
    to?: string;
  }) {
    const query = new URLSearchParams();
    query.set("preset", next.preset);
    if (next.preset === "custom" && next.from && next.to) {
      query.set("from", next.from);
      query.set("to", next.to);
    }
    router.push(`/admin/analytics?${query.toString()}`);
  }

  function selectPreset(preset: AnalyticsPreset) {
    if (preset === "custom") {
      setCustomRange({ from: range.start, to: range.end });
      setOpen(true);
      return;
    }
    pushParams({ preset });
    setOpen(false);
  }

  function applyCustomRange() {
    if (!customRange?.from || !customRange.to) return;
    pushParams({
      preset: "custom",
      from: formatAnalyticsIsoDate(customRange.from),
      to: formatAnalyticsIsoDate(customRange.to),
    });
    setOpen(false);
  }

  const activePreset = isAnalyticsPreset(params.preset ?? "")
    ? params.preset
    : range.preset;

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant={activePreset === preset.id ? "default" : "outline"}
            className={cn(
              activePreset === preset.id &&
                "bg-blue-600 text-white hover:bg-blue-700"
            )}
            onClick={() => selectPreset(preset.id)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="min-w-[240px] justify-start gap-2 font-normal"
          >
            <CalendarIcon className="size-4 text-neutral-500" />
            {formatAnalyticsRangeLabel(range)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            defaultMonth={customRange?.from ?? range.start}
            selected={customRange}
            onSelect={setCustomRange}
            numberOfMonths={2}
            disabled={{ after: new Date() }}
          />
          <div className="flex items-center justify-between border-t border-neutral-200 px-3 py-2">
            <p className="text-xs text-neutral-500">
              {customRange?.from && customRange.to
                ? `${format(customRange.from, "dd MMM yyyy")} – ${format(customRange.to, "dd MMM yyyy")}`
                : "Select start and end date"}
            </p>
            <Button
              type="button"
              size="sm"
              disabled={!customRange?.from || !customRange?.to}
              onClick={applyCustomRange}
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
