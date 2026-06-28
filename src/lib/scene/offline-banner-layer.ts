import type { SceneBannerLayer } from "@/lib/scene/layer-utils";

export const OFFLINE_SCENE_BANNER_ID = "guest-offline-mode";

export function buildOfflineBannerLayer(message: string): SceneBannerLayer {
  return {
    kind: "banner",
    id: OFFLINE_SCENE_BANNER_ID,
    message,
    action: "dismiss",
  };
}

/** Prepend offline banner when guest is in degraded/offline mode. */
export function mergeOfflineBannerLayer(
  banners: SceneBannerLayer[],
  input: { offline: boolean; message: string | null }
): SceneBannerLayer[] {
  if (!input.offline || !input.message) {
    return banners.filter((banner) => banner.id !== OFFLINE_SCENE_BANNER_ID);
  }

  const layer = buildOfflineBannerLayer(input.message);
  const withoutOffline = banners.filter(
    (banner) => banner.id !== OFFLINE_SCENE_BANNER_ID
  );
  return [layer, ...withoutOffline];
}
