"use client";

const STORAGE_PREFIX = "guest-device";

function storageKey(locationId: string, tableId: string, suffix: string) {
  return `${STORAGE_PREFIX}:${locationId}:${tableId}:${suffix}`;
}

export function getStoredDeviceToken(
  locationId: string,
  tableId: string
): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(storageKey(locationId, tableId, "token"));
}

export function setStoredDeviceToken(
  locationId: string,
  tableId: string,
  token: string
) {
  localStorage.setItem(storageKey(locationId, tableId, "token"), token);
}

export function getStoredDeviceFingerprint(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`${STORAGE_PREFIX}:fingerprint`);
}

/** Stable per-browser fingerprint without external SDK. */
export function getOrCreateDeviceFingerprint(): string {
  if (typeof window === "undefined") return "server";

  const existing = getStoredDeviceFingerprint();
  if (existing) return existing;

  const entropy = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join("|");

  let hash = 0;
  for (let i = 0; i < entropy.length; i++) {
    hash = (hash << 5) - hash + entropy.charCodeAt(i);
    hash |= 0;
  }

  const fingerprint = `fp_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
  localStorage.setItem(`${STORAGE_PREFIX}:fingerprint`, fingerprint);
  return fingerprint;
}

export function clearStoredDeviceAuth(locationId: string, tableId: string) {
  localStorage.removeItem(storageKey(locationId, tableId, "token"));
}
