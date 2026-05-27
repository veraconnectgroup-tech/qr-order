"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
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
  const activePreset = isAnalyticsPreset(params.preset ?? "")
    ? params.preset
    : range.preset;
  const [customMode, setCustomMode] = useState(activePreset === "custom");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(range.start);
  const [customTo, setCustomTo] = useState<Date | undefined>(range.end);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

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
      setCustomFrom(range.start);
      setCustomTo(range.end);
      setCustomMode(true);
      return;
    }
    setCustomMode(false);
    pushParams({ preset });
  }

  function applyCustomRange() {
    if (!customFrom || !customTo) return;
    const from = customFrom <= customTo ? customFrom : customTo;
    const to = customFrom <= customTo ? customTo : customFrom;
    pushParams({
      preset: "custom",
      from: formatAnalyticsIsoDate(from),
      to: formatAnalyticsIsoDate(to),
    });
    setCustomMode(true);
    setFromOpen(false);
    setToOpen(false);
  }

  const isCustom = customMode || activePreset === "custom";

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant={
              activePreset === preset.id ||
              (preset.id === "custom" && customMode)
                ? "default"
                : "outline"
            }
            className={cn(
              (activePreset === preset.id ||
                (preset.id === "custom" && customMode)) &&
                "bg-blue-600 text-white hover:bg-blue-700"
            )}
            onClick={() => selectPreset(preset.id)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {isCustom ? (
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={fromOpen} onOpenChange={setFromOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="min-w-[140px] justify-start gap-2 font-normal"
              >
                <CalendarIcon className="size-4 text-muted-foreground" />
                {customFrom ? format(customFrom, "dd MMM yyyy") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={customFrom}
                onSelect={(date) => {
                  setCustomFrom(date);
                  setFromOpen(false);
                }}
                defaultMonth={customFrom ?? range.start}
                disabled={{ after: customTo ?? new Date() }}
              />
            </PopoverContent>
          </Popover>

          <span className="text-sm text-muted-foreground/70">–</span>

          <Popover open={toOpen} onOpenChange={setToOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="min-w-[140px] justify-start gap-2 font-normal"
              >
                <CalendarIcon className="size-4 text-muted-foreground" />
                {customTo ? format(customTo, "dd MMM yyyy") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={customTo}
                onSelect={(date) => {
                  setCustomTo(date);
                  setToOpen(false);
                }}
                defaultMonth={customTo ?? range.end}
                disabled={{
                  before: customFrom,
                  after: new Date(),
                }}
              />
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            size="sm"
            disabled={!customFrom || !customTo}
            onClick={applyCustomRange}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            Apply
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {formatAnalyticsRangeLabel(range)}
        </p>
      )}
    </div>
  );
}
