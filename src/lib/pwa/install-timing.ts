const PAGE_VIEWS_KEY = "qr_pwa_guest_page_views";
const ORDER_PLACED_KEY = "qr_pwa_guest_order_placed";

export function recordGuestPageView() {
  if (typeof localStorage === "undefined") return;
  try {
    const current = Number.parseInt(localStorage.getItem(PAGE_VIEWS_KEY) ?? "0", 10);
    localStorage.setItem(PAGE_VIEWS_KEY, String(current + 1));
  } catch {
    // ignore
  }
}

export function recordGuestOrderPlaced() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(ORDER_PLACED_KEY, "1");
  } catch {
    // ignore
  }
}

export function shouldShowGuestInstallPrompt() {
  if (typeof localStorage === "undefined") return false;
  try {
    const pageViews = Number.parseInt(localStorage.getItem(PAGE_VIEWS_KEY) ?? "0", 10);
    const hasOrdered = localStorage.getItem(ORDER_PLACED_KEY) === "1";
    if (pageViews < 1) return false;
    return hasOrdered || pageViews >= 3;
  } catch {
    return false;
  }
}
