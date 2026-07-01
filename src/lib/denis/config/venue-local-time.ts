const WEEKDAY_SHORT: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function venueTimezone(timezone: string | null | undefined): string {
  return timezone?.trim() || "Europe/Berlin";
}

export function localHourMinute(
  timezone: string | null | undefined,
  now = new Date()
): string {
  const tz = venueTimezone(timezone);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

export function weekdayInTimezone(
  timezone: string | null | undefined,
  now = new Date()
): number {
  const tz = venueTimezone(timezone);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(now);

  return WEEKDAY_SHORT[weekday] ?? now.getUTCDay();
}

export function localHourAndMinute(
  timezone: string | null | undefined,
  now = new Date()
): { hour: number; minute: number } {
  const tz = venueTimezone(timezone);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0"
  );

  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

export function nextLocalSlot(
  dow: number,
  hour: number
): { dow: number; hour: number } {
  const nextHour = (hour + 1) % 24;
  const nextDow = hour === 23 ? (dow + 1) % 7 : dow;
  return { dow: nextDow, hour: nextHour };
}
