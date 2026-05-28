import type { Scene } from "@/lib/scene/types";

export async function fetchGuestScene(
  tableToken: string,
  sessionToken: string
): Promise<Scene | null> {
  const params = new URLSearchParams({
    tableToken,
    sessionToken,
  });

  const res = await fetch(`/api/guest/scene?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  const json = (await res.json()) as {
    data?: { scene?: Scene };
    error?: string;
  };

  if (!res.ok) {
    throw new Error(json.error ?? "Could not load scene.");
  }

  return json.data?.scene ?? null;
}
