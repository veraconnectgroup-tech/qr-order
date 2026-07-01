export type AnalyticsPreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "month"
  | "custom";

export type AnalyticsDateRange = {
  preset: AnalyticsPreset;
  start: Date;
  end: Date;
};

export type AnalyticsSearchParams = {
  preset?: string;
  from?: string;
  to?: string;
  tab?: string;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function parseIsoDate(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isAnalyticsPreset(value: string): value is AnalyticsPreset {
  return (
    value === "today" ||
    value === "yesterday" ||
    value === "7d" ||
    value === "30d" ||
    value === "month" ||
    value === "custom"
  );
}

export function resolveAnalyticsDateRange(
  params: AnalyticsSearchParams
): AnalyticsDateRange {
  const preset = isAnalyticsPreset(params.preset ?? "")
    ? params.preset
    : "30d";
  const now = new Date();
  const today = startOfDay(now);

  if (preset === "today") {
    return { preset, start: today, end: endOfDay(now) };
  }

  if (preset === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { preset, start: y, end: endOfDay(y) };
  }

  if (preset === "7d") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { preset, start, end: endOfDay(now) };
  }

  if (preset === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { preset, start, end: endOfDay(now) };
  }

  if (preset === "custom") {
    const from = parseIsoDate(params.from);
    const to = parseIsoDate(params.to);
    if (from && to && from <= to) {
      return { preset, start: startOfDay(from), end: endOfDay(to) };
    }
  }

  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  return { preset: "30d", start, end: endOfDay(now) };
}

export function getPreviousAnalyticsRange(range: AnalyticsDateRange) {
  const durationMs = range.end.getTime() - range.start.getTime();
  const prevEnd = new Date(range.start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return { start: prevStart, end: prevEnd };
}

export function formatAnalyticsIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatAnalyticsRangeLabel(range: AnalyticsDateRange) {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  if (range.preset === "today") return "Today";
  if (range.preset === "yesterday") return "Yesterday";
  if (range.preset === "7d") return "Last 7 days";
  if (range.preset === "30d") return "Last 30 days";
  if (range.preset === "month") return "This month";
  return `${fmt(range.start)} – ${fmt(range.end)}`;
}

export function rangeDurationDays(range: AnalyticsDateRange) {
  return (
    (endOfDay(range.end).getTime() - startOfDay(range.start).getTime()) /
      86_400_000 +
    1
  );
}
