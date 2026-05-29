/**
 * POS Speed feature flags (staff ordering). Client-safe via NEXT_PUBLIC_* mirrors.
 */

function isTruthyEnv(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function readEnv(primary: string, publicMirror: string): string | undefined {
  return process.env[primary] ?? process.env[publicMirror];
}

function isLocationInPilotList(
  locationId: string,
  listEnv: string | undefined
): boolean {
  if (!listEnv?.trim()) return true;
  const allowed = listEnv
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return allowed.includes(locationId);
}

/** M1 local-first — IndexedDB WAL before network sync (P1). */
export function isPosLocalFirstEnabled(_locationId: string): boolean {
  const enabled = isTruthyEnv(
    readEnv("POS_LOCAL_FIRST", "NEXT_PUBLIC_POS_LOCAL_FIRST")
  );
  if (!enabled) return false;
  return isLocationInPilotList(
    _locationId,
    readEnv("POS_LOCAL_FIRST_LOCATIONS", "NEXT_PUBLIC_POS_LOCAL_FIRST_LOCATIONS")
  );
}

/** M2 kitchen provisional broadcast (KDS orange card). */
export function isPosKitchenProvisionalEnabled(locationId: string): boolean {
  const enabled = isTruthyEnv(
    readEnv("POS_KITCHEN_PROVISIONAL", "NEXT_PUBLIC_POS_KITCHEN_PROVISIONAL")
  );
  if (!enabled) return false;
  return isLocationInPilotList(
    locationId,
    readEnv(
      "POS_KITCHEN_PROVISIONAL_LOCATIONS",
      "NEXT_PUBLIC_POS_KITCHEN_PROVISIONAL_LOCATIONS"
    )
  );
}
