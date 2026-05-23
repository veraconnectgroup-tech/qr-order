export function aiSessionStorageKey(locationId: string, sessionToken: string) {
  return `ai-concierge-session-${locationId}-${sessionToken}`;
}

export function readAiSessionId(locationId: string, sessionToken: string) {
  try {
    return localStorage.getItem(aiSessionStorageKey(locationId, sessionToken));
  } catch {
    return null;
  }
}

export function writeAiSessionId(
  locationId: string,
  sessionToken: string,
  sessionId: string
) {
  try {
    localStorage.setItem(aiSessionStorageKey(locationId, sessionToken), sessionId);
  } catch {
    // ignore
  }
}

export function clearAiSessionId(locationId: string, sessionToken: string) {
  try {
    localStorage.removeItem(aiSessionStorageKey(locationId, sessionToken));
  } catch {
    // ignore
  }
}

export async function trackAiConversion(input: {
  sessionId: string;
  productId: string;
  locationId: string;
  tableId: string;
  sessionToken: string;
}) {
  try {
    await fetch("/api/ai/conversion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    // non-blocking analytics
  }
}

export async function completeAiSession(input: {
  sessionId: string;
  locationId: string;
  tableId: string;
  sessionToken: string;
}) {
  try {
    await fetch("/api/ai/session/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    // ignore
  }
}
