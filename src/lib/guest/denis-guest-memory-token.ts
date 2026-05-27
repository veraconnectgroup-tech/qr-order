import { createHmac } from "crypto";

/** Opaque per-location guest token — never log raw device fingerprint. */
export function deriveGuestMemoryToken(
  locationId: string,
  deviceFingerprint: string
): string {
  const secret =
    process.env.GUEST_MEMORY_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "dev-guest-memory-secret";
  return createHmac("sha256", secret)
    .update(`${locationId}:${deviceFingerprint}`)
    .digest("hex");
}
