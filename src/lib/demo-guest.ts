import {
  DEMO_CURRENCY,
  DEMO_MENU_CATEGORIES,
  DEMO_TAX_PERCENT,
} from "@/components/landing/demo-data";
import {
  AI_SHEET_ALLERGY_OPTIONS,
  AI_SHEET_MOOD_OPTIONS,
} from "@/lib/ai/guest-sheet-preferences";
import { toSceneAccessibility, DEFAULT_GUEST_ACCESSIBILITY } from "@/lib/denis/cognition/mental-model/accessibility-types";
import { tableSessionViewToScene } from "@/lib/denis/loop/view-to-scene";
import type { TableSessionView } from "@/lib/denis/loop/view-types";
import { TABLE_ACTION_CHIP_IDS } from "@/lib/scene/resolve-table-actions";

export const DEMO_GUEST_SLUG = "skyline-lounge";
export const DEMO_GUEST_TOKEN = "demo-table-8";

export function isDemoGuestRoute(slug: string, token: string) {
  return slug === DEMO_GUEST_SLUG && token === DEMO_GUEST_TOKEN;
}

export function isDemoGuestTableToken(token: string) {
  return token === DEMO_GUEST_TOKEN;
}

/** Static session for the public demo menu — no Supabase required. */
export function getDemoGuestSession() {
  return {
    sessionId: "demo-session",
    sessionToken: "demo-session-token",
    tableId: "demo-table",
    tableName: "Table 8",
    locationId: "demo-location",
  };
}

export function isDemoGuestDenisSession(tableToken: string, sessionToken: string) {
  return (
    isDemoGuestTableToken(tableToken) &&
    sessionToken === getDemoGuestSession().sessionToken
  );
}

/** Browse-phase Denis view for the public demo link (no DB table session). */
export function getDemoGuestDenisView() {
  const demo = getDemoGuestSession();
  const chipOptions = [
    ...AI_SHEET_ALLERGY_OPTIONS.slice(0, 4).map((option) => ({
      id: `allergy-${option.id}`,
      label: option.label,
    })),
    ...AI_SHEET_MOOD_OPTIONS.slice(0, 2).map((option) => ({
      id: `mood-${option.id}`,
      label: option.label,
    })),
    {
      id: TABLE_ACTION_CHIP_IDS.orderMore,
      label: "scene.action.orderMore",
    },
  ];

  const view: TableSessionView = {
    version: 1,
    sessionId: demo.sessionId,
    phase: "browsing",
    chrome: {
      tableName: demo.tableName,
      venueName: "Skyline Lounge",
      headline: "",
      markState: "idle",
      denisActive: false,
    },
    layers: [{ kind: "chips", options: chipOptions }],
    transcript: [],
    cart: {
      aiItemCount: 0,
      manualItemCount: 0,
      visibleItemCount: 0,
      hasConflict: false,
      conflictPrompt: null,
      revision: 0,
    },
    orders: [],
    actions: [],
    dock: {
      headline: "Pregledajte meni",
      subline: null,
      chips: [],
      urgency: "idle",
      reorderOffer: null,
    },
    smartTipOffer: null,
    accessibility: toSceneAccessibility(DEFAULT_GUEST_ACCESSIBILITY),
  };

  return {
    viewVersion: view.version,
    view,
    scene: tableSessionViewToScene(view),
  };
}

/** Static demo menu when Supabase seed is not deployed yet. */
export function getDemoGuestMenuProps(slug: string, token: string) {
  return {
    slug,
    token,
    orgName: "Skyline Lounge",
    logoUrl: null as string | null,
    locationName: "Rooftop",
    tableName: "Table 8",
    zoneName: "Rooftop",
    categories: DEMO_MENU_CATEGORIES,
    taxPercent: DEMO_TAX_PERCENT,
    currency: DEMO_CURRENCY,
    locationId: "demo-location",
    tableId: "demo-table",
    orderingEnabled: true,
    acceptingOrders: true,
    aiConciergeEnabled: true,
    googleReviewUrl: null,
    timezone: "Europe/Berlin",
  };
}
