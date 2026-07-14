import type { SupabaseClient } from "@supabase/supabase-js";
import { isPosAdapterBuilt } from "@/lib/pos/adapter-registry";
import {
  resolvePosCapabilities,
  type PosCapabilities,
  type PosVendor,
} from "@/lib/integrations/pos-capability-matrix";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

/**
 * ADR-029/047's planned connector registry — the "one place integrations
 * arrive" the founder asked for. Static catalog of known connectors (real
 * or not-yet-built) plus a per-location status resolver, so both the admin
 * UI and Denis's own context read the same honest truth about what's
 * actually connected — never a silent guess (see ADR-048's "NO, not
 * connected" honesty rule).
 *
 * Adding a new connector later — implemented or not — means adding one
 * entry here, not wiring a new wire per surface.
 */

export type ConnectorCategory =
  | "pos"
  | "delivery"
  | "reservation"
  | "payment"
  | "accounting";

export type ConnectorDefinition = {
  id: string;
  name: string;
  category: ConnectorCategory;
  /** True once a real adapter exists in code (not a skeleton stub) — independent of whether any location has actually connected it. */
  builtInCode: boolean;
  description: string;
  /**
   * ADR-052 Phase 0 extension point — browser-automation connectors (no
   * real API, Playwright-driven) are a structurally different kind and
   * must never be treated as a real PosAdapter. Absent means "api", the
   * only kind that exists in this catalog today — no existing entry
   * needs updating for this field to be meaningful.
   */
  integrationKind?: "api" | "browser_automation";
};

export const CONNECTOR_CATALOG: ConnectorDefinition[] = [
  {
    id: "deliverect",
    name: "Deliverect",
    category: "pos",
    builtInCode: true,
    description:
      "POS aggregator — bridges many POS systems through one connection, not a single vendor.",
  },
  {
    id: "lightspeed",
    name: "Lightspeed",
    category: "pos",
    builtInCode: false,
    description: "Direct POS integration — selectable, not yet implemented.",
  },
  {
    id: "orderbird",
    name: "orderbird",
    category: "pos",
    builtInCode: false,
    description: "Direct POS integration — selectable, not yet implemented.",
  },
  {
    id: "sumup",
    name: "SumUp",
    category: "pos",
    builtInCode: false,
    description: "Direct POS integration — selectable, not yet implemented.",
  },
  {
    id: "toast",
    name: "Toast",
    category: "pos",
    builtInCode: false,
    description: "US-focused POS — no adapter built yet.",
  },
  {
    id: "wolt",
    name: "Wolt",
    category: "delivery",
    builtInCode: false,
    description: "Delivery marketplace — no adapter built yet.",
  },
  {
    id: "opentable",
    name: "OpenTable",
    category: "reservation",
    builtInCode: false,
    description:
      "Reservations — requires a formal OpenTable partner agreement before any code integration is possible.",
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "payment",
    builtInCode: true,
    description:
      "Online guest payment via Stripe Connect — real per-org onboarding status, not just whether the code exists.",
  },
];

export type ConnectorState = "connected" | "not_connected" | "not_built";

export type ConnectorStatus = ConnectorDefinition & {
  state: ConnectorState;
  /** Only meaningful when state === "connected" — mirrors pos_integrations.status. */
  healthy: boolean | null;
  lastError: string | null;
};

type PosIntegrationRow =
  Database["public"]["Tables"]["pos_integrations"]["Row"];

function resolvePosState(
  def: ConnectorDefinition,
  row: PosIntegrationRow | undefined
): Pick<ConnectorStatus, "state" | "healthy" | "lastError"> {
  if (!def.builtInCode || !isPosAdapterBuilt(def.id)) {
    return { state: "not_built", healthy: null, lastError: null };
  }
  if (!row || row.status === "disconnected") {
    return { state: "not_connected", healthy: null, lastError: null };
  }
  return {
    state: "connected",
    healthy: row.status === "connected",
    lastError: row.last_error,
  };
}

/**
 * Stripe isn't in pos_integrations — onboarding lives on organizations
 * (stripe_onboarded) and the online-payment toggle lives per-location
 * (locations.payment_online_enabled). Both must be true for Denis to
 * honestly say online payment works here — an org that finished Stripe
 * Connect but has this specific location's online payment switched off
 * is NOT "connected" from a guest's point of view.
 */
async function resolveStripeState(
  admin: SupabaseClient,
  locationId: string
): Promise<Pick<ConnectorStatus, "state" | "healthy" | "lastError">> {
  const { data: location } = await admin
    .from("locations")
    .select("org_id, payment_online_enabled")
    .eq("id", locationId)
    .maybeSingle();

  if (!location) return { state: "not_connected", healthy: null, lastError: null };

  const row = location as { org_id: string; payment_online_enabled: boolean };

  const { data: org } = await admin
    .from("organizations")
    .select("stripe_onboarded")
    .eq("id", row.org_id)
    .maybeSingle();

  const stripeOnboarded = (org as { stripe_onboarded: boolean } | null)
    ?.stripe_onboarded;

  if (!stripeOnboarded) {
    return { state: "not_connected", healthy: null, lastError: null };
  }
  if (!row.payment_online_enabled) {
    return {
      state: "not_connected",
      healthy: null,
      lastError: "Stripe onboarded, but online payment is switched off for this location.",
    };
  }
  return { state: "connected", healthy: true, lastError: null };
}

/** Every connector's real status for this location — the one truthful source both the admin UI and Denis's own context read from. */
export async function resolveConnectorStatuses(
  admin: SupabaseClient,
  locationId: string
): Promise<ConnectorStatus[]> {
  const { data } = await admin
    .from("pos_integrations")
    .select("*")
    .eq("location_id", locationId);

  const posRows = new Map<string, PosIntegrationRow>(
    ((data ?? []) as PosIntegrationRow[]).map((row) => [row.provider, row])
  );

  const stripeStatus = await resolveStripeState(admin, locationId);

  return Promise.all(CONNECTOR_CATALOG.map(async (def) => {
    if (def.id === "stripe") {
      return { ...def, ...stripeStatus };
    }
    if (def.category !== "pos") {
      // Non-POS, non-Stripe categories (delivery, reservation, ...) have
      // no built adapter/table yet — always honest "not built" until one
      // exists.
      return { ...def, state: "not_built", healthy: null, lastError: null };
    }
    const { state, healthy, lastError } = resolvePosState(
      def,
      posRows.get(def.id)
    );
    return { ...def, state, healthy, lastError };
  }));
}

/**
 * Short, honest capability summary for Denis's own context — "what am I
 * actually connected to right now" — same registry the admin matrix reads,
 * so he never claims a capability that page shows as not connected.
 * Skips categories with nothing connected rather than listing every
 * not-built vendor — that's for the admin view, not something to recite.
 */
export async function loadIntegrationsAwarenessBlock(
  locationId: string
): Promise<string | null> {
  const admin = createAdminClient();
  const statuses = await resolveConnectorStatuses(admin, locationId);
  const connected = statuses.filter((s) => s.state === "connected");

  if (connected.length === 0) return null;

  const lines = connected.map(
    (s) => `- ${s.name} (${CATEGORY_LABEL_EN[s.category]})${s.healthy ? "" : " — currently erroring, don't rely on it"}`
  );

  return [
    "CONNECTED SYSTEMS YOU CAN ACTUALLY USE:",
    ...lines,
    "Anything not listed here is NOT connected — say so honestly if asked, never guess or assume a capability exists.",
  ].join("\n");
}

const CATEGORY_LABEL_EN: Record<ConnectorCategory, string> = {
  pos: "point of sale",
  delivery: "delivery",
  reservation: "reservations",
  payment: "payment",
  accounting: "accounting",
};

function resolvePosVendor(row: PosIntegrationRow | undefined): PosVendor {
  if (!row) return "unknown";

  // Non-Deliverect providers map straight to their own vendor name once a
  // direct adapter exists — today only Deliverect is builtInCode, so this
  // branch is forward-looking, not yet reachable in production.
  if (row.provider === "orderbird" || row.provider === "lightspeed") {
    return row.provider;
  }

  if (row.provider !== "deliverect") return "unknown";

  // Deliverect is generic — the underlying POS it's actually configured
  // against isn't something Deliverect's own API tells us, so an admin
  // must record it when connecting. Absent that, we stay on the
  // conservative baseline rather than guessing which POS is behind it.
  const config = (row.config ?? {}) as Record<string, unknown>;
  const vendor = typeof config.pos_vendor === "string" ? config.pos_vendor : "";
  if (vendor === "toast" || vendor === "lightspeed" || vendor === "orderbird") {
    return vendor;
  }
  return "unknown";
}

/**
 * What Denis is actually allowed to promise a guest for this location's
 * connected POS — see pos-capability-matrix.ts for the sourced, labeled
 * data this reads from. Returns the conservative baseline (mostly
 * not_confirmed) when no POS is connected or its vendor is unrecorded —
 * never invents a capability.
 */
export async function getCapabilities(
  admin: SupabaseClient,
  locationId: string
): Promise<PosCapabilities> {
  const { data } = await admin
    .from("pos_integrations")
    .select("*")
    .eq("location_id", locationId)
    .eq("status", "connected")
    .maybeSingle();

  const vendor = resolvePosVendor((data ?? undefined) as PosIntegrationRow | undefined);
  return resolvePosCapabilities(vendor);
}

const CAPABILITY_LABEL_EN: Record<
  keyof PosCapabilities,
  string
> = {
  dineInOrder: "sending a dine-in order to the POS",
  prepaidFlag: "marking an order already-paid",
  tableIdRealRouting: "routing an order to the exact table on the POS screen",
  readOpenBill: "reading a bill a staff member already started",
  appendToOpenBill: "adding items to a bill already open in the POS",
  externalTenderOnOpenBill: "marking an existing open bill as paid",
  closeBill: "closing a bill in the POS",
  splitBill: "splitting a bill between guests",
  customPaymentMethodLabel: "labeling online payments distinctly in POS reports",
  tips: "sending a tip through to the POS",
  floorPlanApi: "seeing the real-time visual floor plan",
};

/**
 * Capability-aware honesty block for Denis's brain context — tells him,
 * per connected POS, exactly what he may promise a guest and what he must
 * defer to staff for. Complements loadIntegrationsAwarenessBlock (which
 * only says WHAT is connected); this says what that connection can
 * actually DO. Only surfaces the capabilities Denis needs to reason about
 * guest-facing promises — not every internal row.
 */
export async function loadCapabilityAwarenessBlock(
  locationId: string
): Promise<string | null> {
  const admin = createAdminClient();
  const capabilities = await getCapabilities(admin, locationId);

  const guestFacingKeys: (keyof PosCapabilities)[] = [
    "readOpenBill",
    "appendToOpenBill",
    "externalTenderOnOpenBill",
    "closeBill",
    "splitBill",
    "tips",
  ];

  const canDo: string[] = [];
  const cannotDo: string[] = [];

  for (const key of guestFacingKeys) {
    const entry = capabilities[key];
    const label = CAPABILITY_LABEL_EN[key];
    if (entry.status === "confirmed") {
      canDo.push(`- ${label}`);
    } else if (entry.status === "not_supported" || entry.status === "not_confirmed") {
      cannotDo.push(`- ${label} — NOT possible today; be honest, say a staff member must handle it`);
    }
    // pos_dependent entries are deliberately omitted here — too uncertain
    // to state as a flat yes/no to a guest; treat as "cannot promise."
  }

  if (canDo.length === 0 && cannotDo.length === 0) return null;

  const lines = ["POS CAPABILITIES — what you may actually promise a guest:"];
  if (canDo.length) lines.push("You CAN:", ...canDo);
  if (cannotDo.length) lines.push("You CANNOT (say so honestly, never claim otherwise):", ...cannotDo);
  lines.push(
    "If a guest asks for something in the CANNOT list — e.g. paying at the end after ordering with staff — tell them plainly a staff member needs to help, don't imply you'll handle it."
  );

  return lines.join("\n");
}

/**
 * Staff/owner-facing counterpart to loadCapabilityAwarenessBlock — the
 * COMPLETE researched picture (all 11 pos-capability-matrix.ts keys,
 * every status including pos_dependent, plus the sourced note behind
 * each one — e.g. Deliverect's own "not all POS systems currently
 * return the table IDs" caveat), not the guest-safe 6-key subset that
 * function deliberately narrows to. An owner or manager asking Denis
 * "what exactly can Deliverect actually do for us" needs the honest
 * full answer, nuance included — staff can hold "it depends," a guest
 * promise can't. Only emitted when a POS is actually connected; a venue
 * with nothing connected has nothing to detail.
 */
export async function loadFullCapabilityAwarenessBlock(
  locationId: string
): Promise<string | null> {
  const admin = createAdminClient();
  const statuses = await resolveConnectorStatuses(admin, locationId);
  const hasConnectedPos = statuses.some(
    (s) => s.category === "pos" && s.state === "connected"
  );
  if (!hasConnectedPos) return null;

  const capabilities = await getCapabilities(admin, locationId);
  const lines = ["CONNECTED POS — FULL CAPABILITY DETAIL (for your own reasoning, not a script to recite):"];

  for (const key of Object.keys(CAPABILITY_LABEL_EN) as (keyof PosCapabilities)[]) {
    const entry = capabilities[key];
    lines.push(`- ${CAPABILITY_LABEL_EN[key]}: ${entry.status} — ${entry.note}`);
  }

  return lines.join("\n");
}
