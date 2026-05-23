export type CategorySchedule = {
  schedule_enabled: boolean;
  schedule_start: string | null;
  schedule_end: string | null;
  schedule_days: number[] | null;
};

const WEEKDAY_TO_JS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const DEFAULT_TIMEZONE = "Europe/Berlin";

export function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatMinutesAsTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getZonedDay(now: Date, timezone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(now);
  return WEEKDAY_TO_JS[weekday] ?? now.getDay();
}

function getZonedTimeMinutes(now: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function isTimeWithinRange(
  currentMinutes: number,
  startMinutes: number,
  endMinutes: number
): boolean {
  if (startMinutes === endMinutes) return true;

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  // Overnight window (e.g. 22:00 → 02:00)
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

export function isCategoryAvailable(
  category: CategorySchedule,
  now: Date,
  timezone = DEFAULT_TIMEZONE
): boolean {
  if (!category.schedule_enabled) return true;

  const days = category.schedule_days ?? [0, 1, 2, 3, 4, 5, 6];
  const startMinutes = parseTimeToMinutes(category.schedule_start);
  const endMinutes = parseTimeToMinutes(category.schedule_end);

  if (startMinutes == null || endMinutes == null) return true;

  const currentDay = getZonedDay(now, timezone);
  if (!days.includes(currentDay)) return false;

  const currentMinutes = getZonedTimeMinutes(now, timezone);
  return isTimeWithinRange(currentMinutes, startMinutes, endMinutes);
}

const DAY_LABELS: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

export function formatScheduleDays(days: number[] | null | undefined): string {
  const normalized = [...new Set(days ?? [0, 1, 2, 3, 4, 5, 6])].sort(
    (a, b) => a - b
  );

  if (normalized.length === 7) return "Svaki dan";
  if (normalized.join(",") === "1,2,3,4,5") return "Pon-Pet";
  if (normalized.join(",") === "0,6") return "Sub-Ned";
  if (normalized.join(",") === "1,2,3,4,5,6") return "Pon-Sub";

  return normalized.map((day) => DAY_LABELS[day] ?? String(day)).join(", ");
}

export function formatScheduleTimeRange(
  start: string | null,
  end: string | null
): string | null {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes == null || endMinutes == null) return null;
  return `${formatMinutesAsTime(startMinutes)}-${formatMinutesAsTime(endMinutes)}`;
}

export function formatScheduleBadge(category: CategorySchedule): string | null {
  if (!category.schedule_enabled) return null;
  const range = formatScheduleTimeRange(
    category.schedule_start,
    category.schedule_end
  );
  if (!range) return null;
  return `⏰ ${range}, ${formatScheduleDays(category.schedule_days)}`;
}

export function formatScheduleGuestHint(
  categoryName: string,
  category: CategorySchedule
): string | null {
  if (!category.schedule_enabled) return null;
  const range = formatScheduleTimeRange(
    category.schedule_start,
    category.schedule_end
  );
  if (!range) return null;
  return `${categoryName} available ${range}`;
}

export const SCHEDULE_PRESETS = {
  breakfast: {
    label: "Breakfast (07–11)",
    schedule_start: "07:00",
    schedule_end: "11:30",
    schedule_days: [0, 1, 2, 3, 4, 5, 6],
  },
  lunch: {
    label: "Lunch (11–15)",
    schedule_start: "11:00",
    schedule_end: "15:00",
    schedule_days: [0, 1, 2, 3, 4, 5, 6],
  },
  dinner: {
    label: "Dinner (17–22)",
    schedule_start: "17:00",
    schedule_end: "22:00",
    schedule_days: [0, 1, 2, 3, 4, 5, 6],
  },
} as const;

export function normalizeScheduleDays(days: number[]): number[] {
  return [...new Set(days.filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b);
}

export function toTimeInputValue(value: string | null | undefined): string {
  const minutes = parseTimeToMinutes(value);
  if (minutes == null) return "";
  return formatMinutesAsTime(minutes);
}
