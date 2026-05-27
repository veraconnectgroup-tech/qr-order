import type {
  GuestMemoryProjection,
  GuestMemoryScope,
  GuestMemorySyncPayload,
} from "@/lib/denis/platform/guest-memory-types";

type MemoryApiBase = {
  locationId: string;
  tableId: string;
  sessionToken: string;
  deviceFingerprint: string;
};

async function parseMemoryResponse(
  res: Response
): Promise<GuestMemoryProjection | null> {
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: GuestMemoryProjection | null };
  return json.data ?? null;
}

export async function fetchGuestMemoryProjection(
  input: MemoryApiBase
): Promise<GuestMemoryProjection | null> {
  const res = await fetch("/api/guest/denis-memory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseMemoryResponse(res);
}

export async function grantGuestMemoryConsentClient(
  input: MemoryApiBase & {
    scopes: GuestMemoryScope[];
    sync?: GuestMemorySyncPayload;
  }
): Promise<GuestMemoryProjection | null> {
  const res = await fetch("/api/guest/denis-memory/consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseMemoryResponse(res);
}

export async function syncGuestMemoryClient(
  input: MemoryApiBase & {
    sync?: GuestMemorySyncPayload;
    recordVisit?: { itemNames: string[] };
  }
): Promise<GuestMemoryProjection | null> {
  const res = await fetch("/api/guest/denis-memory/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseMemoryResponse(res);
}

export async function revokeGuestMemoryClient(
  input: MemoryApiBase
): Promise<boolean> {
  const res = await fetch("/api/guest/denis-memory", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.ok;
}

const CONSENT_DISMISSED_PREFIX = "denis-memory-consent-dismissed";

export function isGuestMemoryConsentDismissed(locationId: string): boolean {
  if (typeof window === "undefined") return false;
  return (
    localStorage.getItem(`${CONSENT_DISMISSED_PREFIX}:${locationId}`) === "1"
  );
}

export function dismissGuestMemoryConsentPrompt(locationId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${CONSENT_DISMISSED_PREFIX}:${locationId}`, "1");
}
