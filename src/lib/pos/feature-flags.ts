/**
 * POS Speed + POS Bridge feature flags (staff ordering + Denis ↔ POS sync).
 * Client-safe via NEXT_PUBLIC_* mirrors where noted.
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

export const POS_BRIDGE_PROVIDERS = [
  "deliverect",
  "lightspeed",
  "orderbird",
  "sumup",
  "ready2order",
  "custom",
] as const;

export type PosBridgeProvider = (typeof POS_BRIDGE_PROVIDERS)[number];

/** Prompt 39 — Denis ↔ POS bridge enabled for location. */
export function isPosBridgeEnabled(locationId: string): boolean {
  const enabled = isTruthyEnv(
    readEnv("POS_BRIDGE_ENABLED", "NEXT_PUBLIC_POS_BRIDGE_ENABLED")
  );
  if (!enabled) return false;
  return isLocationInPilotList(
    locationId,
    readEnv("POS_BRIDGE_LOCATIONS", "NEXT_PUBLIC_POS_BRIDGE_LOCATIONS")
  );
}

/** Active connected POS integration for a location (first match). */
export function resolveActivePosProvider(
  integrations: Array<{ provider: string; status: string }>
): PosBridgeProvider | null {
  const connected = integrations.filter((row) => row.status === "connected");
  for (const provider of POS_BRIDGE_PROVIDERS) {
    if (connected.some((row) => row.provider === provider)) {
      return provider;
    }
  }
  return connected[0]?.provider as PosBridgeProvider | null ?? null;
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
