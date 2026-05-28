import type { Scene } from "@/lib/scene/types";
import type { TableSessionView } from "@/lib/denis/loop/view-types";

export type DenisViewResponse = {
  viewVersion: number;
  view: TableSessionView;
  scene: Scene;
};

export async function fetchDenisView(
  tableToken: string,
  sessionToken: string
): Promise<DenisViewResponse | null> {
  const params = new URLSearchParams({
    tableToken,
    sessionToken,
  });

  const res = await fetch(`/api/denis/view?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  const json = (await res.json()) as {
    data?: DenisViewResponse;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(json.error ?? "Could not load Denis view.");
  }

  return json.data ?? null;
}
