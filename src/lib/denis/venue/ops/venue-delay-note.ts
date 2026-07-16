import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";

/**
 * ADR-053 M2 — location-wide delay note ("roštilj kasni 10 min"), spoken
 * by kitchen/bar staff, read by every guest turn via VenueOpsBeliefs so
 * Denis tells guests with affected items the real timeline instead of
 * empty comfort. Redis with a TTL derived from the announced delay: this
 * is inherently ephemeral operational state (same reasoning as the abuse
 * tracker), so Redis loss degrades to "no note" — never a wrong note.
 * denis_staff_table_hints can't carry this (table_id NOT NULL, per-table
 * by design) and a migration just for an ephemeral note would be the
 * wrong durability class.
 */

export type VenueDelayNote = {
  area: string;
  minutes: number;
  announcedAt: string;
};

const MIN_TTL_SEC = 5 * 60;
const MAX_TTL_SEC = 90 * 60;

function delayNoteKey(locationId: string): string {
  return `denis:venue-delay:${locationId}`;
}

export async function setVenueDelayNote(
  locationId: string,
  note: { area: string; minutes: number }
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  const ttlSec = Math.min(
    MAX_TTL_SEC,
    Math.max(MIN_TTL_SEC, Math.round(note.minutes * 60 * 1.5))
  );

  try {
    await redis.set(
      delayNoteKey(locationId),
      {
        area: note.area,
        minutes: note.minutes,
        announcedAt: new Date().toISOString(),
      } satisfies VenueDelayNote,
      { ex: ttlSec }
    );
    return true;
  } catch (error) {
    logRedisDegradation("denis.venue-delay.set", error);
    return false;
  }
}

export async function getVenueDelayNote(
  locationId: string
): Promise<VenueDelayNote | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const note = await redis.get<VenueDelayNote>(delayNoteKey(locationId));
    if (note?.area && Number.isFinite(note.minutes)) return note;
  } catch (error) {
    logRedisDegradation("denis.venue-delay.get", error);
  }
  return null;
}

export async function clearVenueDelayNote(locationId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.del(delayNoteKey(locationId));
  } catch (error) {
    logRedisDegradation("denis.venue-delay.clear", error);
  }
}
