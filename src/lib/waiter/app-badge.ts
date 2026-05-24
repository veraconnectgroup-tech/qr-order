export async function setWaiterAppBadge(count: number) {
  if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) {
    return;
  }

  try {
    if (count <= 0) {
      await navigator.clearAppBadge?.();
      return;
    }
    await navigator.setAppBadge?.(count > 99 ? 99 : count);
  } catch {
    /* unsupported */
  }
}
