import type { DailyPrepBriefing } from "@/lib/admin/build-daily-prep-briefing";
import { formatDailyPrepCopilotLines } from "@/lib/admin/build-daily-prep-briefing";
import type { EventCopilotBlock } from "@/lib/denis/venue/copilot/types";
import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";

const TTL_SEC = 86_400;

function briefingKey(locationId: string, date: string): string {
  return `denis:daily-prep:${locationId}:${date}`;
}

function sentKey(locationId: string, date: string): string {
  return `denis:daily-prep:sent:${locationId}:${date}`;
}

export async function storeDailyPrepBriefing(
  locationId: string,
  briefing: DailyPrepBriefing
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(briefingKey(locationId, briefing.date), JSON.stringify(briefing), {
      ex: TTL_SEC,
    });
  } catch (error) {
    logRedisDegradation("denis.daily-prep.store", error);
  }
}

export async function loadDailyPrepBriefing(
  locationId: string,
  date: string
): Promise<DailyPrepBriefing | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const raw = await redis.get<string>(briefingKey(locationId, date));
    if (!raw) return null;
    return JSON.parse(raw) as DailyPrepBriefing;
  } catch (error) {
    logRedisDegradation("denis.daily-prep.read", error);
    return null;
  }
}

export async function markDailyPrepBriefingSent(
  locationId: string,
  date: string
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(sentKey(locationId, date), "1", { ex: TTL_SEC });
  } catch (error) {
    logRedisDegradation("denis.daily-prep.sent", error);
  }
}

export async function wasDailyPrepBriefingSent(
  locationId: string,
  date: string
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  try {
    const raw = await redis.get<string>(sentKey(locationId, date));
    return raw === "1";
  } catch (error) {
    logRedisDegradation("denis.daily-prep.sent.read", error);
    return false;
  }
}

export function dailyPrepBriefingToCopilotBlock(
  briefing: DailyPrepBriefing
): EventCopilotBlock {
  return {
    title: "Jutarnji briefing",
    lines: formatDailyPrepCopilotLines(briefing),
  };
}
