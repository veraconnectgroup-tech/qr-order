import type { DailyReport } from "@/lib/admin/build-daily-report";
import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";

const DAILY_TTL_SEC = 86_400;
/** 8 days — covers 7-day weekly rollup + delivery day. */
const WEEKLY_ROLLUP_TTL_SEC = 8 * 86_400;

function sentKey(locationId: string, date: string): string {
  return `denis:daily-report:sent:${locationId}:${date}`;
}

function reportKey(locationId: string, date: string): string {
  return `denis:daily-report:payload:${locationId}:${date}`;
}

function weeklySentKey(locationId: string, weekEnding: string): string {
  return `denis:weekly-owner-report:sent:${locationId}:${weekEnding}`;
}

export async function storeDailyReport(
  locationId: string,
  report: DailyReport
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(
      reportKey(locationId, report.date),
      JSON.stringify(report),
      { ex: WEEKLY_ROLLUP_TTL_SEC }
    );
  } catch (error) {
    logRedisDegradation("denis.daily-report.store", error);
  }
}

export async function loadStoredDailyReport(
  locationId: string,
  date: string
): Promise<DailyReport | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const raw = await redis.get<string>(reportKey(locationId, date));
    if (!raw) return null;
    return JSON.parse(raw) as DailyReport;
  } catch (error) {
    logRedisDegradation("denis.daily-report.read", error);
    return null;
  }
}

function shiftDateIso(date: string, deltaDays: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/** Read up to `days` stored daily reports ending on `weekEnding` (inclusive). */
export async function loadStoredDailyReportsForRange(
  locationId: string,
  weekEnding: string,
  days = 7
): Promise<DailyReport[]> {
  const reports: DailyReport[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = shiftDateIso(weekEnding, -offset);
    const report = await loadStoredDailyReport(locationId, date);
    if (report) reports.push(report);
  }
  return reports;
}

export async function markDailyReportSent(
  locationId: string,
  date: string
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(sentKey(locationId, date), "1", { ex: DAILY_TTL_SEC });
  } catch (error) {
    logRedisDegradation("denis.daily-report.sent", error);
  }
}

export async function wasDailyReportSent(
  locationId: string,
  date: string
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  try {
    const raw = await redis.get<string>(sentKey(locationId, date));
    return raw === "1";
  } catch (error) {
    logRedisDegradation("denis.daily-report.sent.read", error);
    return false;
  }
}

export async function markWeeklyOwnerReportSent(
  locationId: string,
  weekEnding: string
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(weeklySentKey(locationId, weekEnding), "1", {
      ex: WEEKLY_ROLLUP_TTL_SEC,
    });
  } catch (error) {
    logRedisDegradation("denis.weekly-owner-report.sent", error);
  }
}

export async function wasWeeklyOwnerReportSent(
  locationId: string,
  weekEnding: string
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  try {
    const raw = await redis.get<string>(weeklySentKey(locationId, weekEnding));
    return raw === "1";
  } catch (error) {
    logRedisDegradation("denis.weekly-owner-report.sent.read", error);
    return false;
  }
}
