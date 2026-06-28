const PAGE_VIEWS_KEY = "qr_pwa_guest_page_views";
const ORDER_PLACED_KEY = "qr_pwa_guest_order_placed";

export const GUEST_INSTALL_PROMPT_MESSAGE =
  "Dodajte nas na početni ekran za brži pristup sledeći put!";

export function getGuestPageViewCount(): number {
  if (typeof localStorage === "undefined") return 0;
  try {
    return Number.parseInt(localStorage.getItem(PAGE_VIEWS_KEY) ?? "0", 10);
  } catch {
    return 0;
  }
}

export function hasGuestPlacedOrder(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(ORDER_PLACED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Test / dev reset — clears install prompt counters. */
export function resetGuestInstallPromptState() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(PAGE_VIEWS_KEY);
    localStorage.removeItem(ORDER_PLACED_KEY);
  } catch {
    // ignore
  }
}

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

/** 3+ page views OR 1 order placed — then show custom Denis install banner (M17). */
export function shouldShowGuestInstallPrompt() {
  if (typeof localStorage === "undefined") return false;
  try {
    return hasGuestPlacedOrder() || getGuestPageViewCount() >= 3;
  } catch {
    return false;
  }
}
