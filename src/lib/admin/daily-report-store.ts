import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";

const TTL_SEC = 86_400;

function sentKey(locationId: string, date: string): string {
  return `denis:daily-report:sent:${locationId}:${date}`;
}

export async function markDailyReportSent(
  locationId: string,
  date: string
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(sentKey(locationId, date), "1", { ex: TTL_SEC });
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
