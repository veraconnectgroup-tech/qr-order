const DASHBOARD_DISMISS_KEY = "qr_order_pwa_dismiss_dashboard";
const GUEST_DISMISS_KEY = "qr_order_pwa_guest_dismiss";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

export function isDashboardBannerDismissed(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    const raw = localStorage.getItem(DASHBOARD_DISMISS_KEY);
    if (!raw) return false;
    const { at } = JSON.parse(raw) as { at: number };
    return Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

export function dismissDashboardBanner(): void {
  localStorage.setItem(
    DASHBOARD_DISMISS_KEY,
    JSON.stringify({ at: Date.now() })
  );
}

export function isGuestPromptDismissed(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    const raw = localStorage.getItem(GUEST_DISMISS_KEY);
    if (!raw) return false;
    const { at } = JSON.parse(raw) as { at: number };
    return Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

export function dismissGuestPrompt(): void {
  localStorage.setItem(
    GUEST_DISMISS_KEY,
    JSON.stringify({ at: Date.now() })
  );
}
