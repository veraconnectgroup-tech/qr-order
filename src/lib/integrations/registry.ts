import type { SupabaseClient } from "@supabase/supabase-js";
import { getPosAdapter } from "@/lib/pos/adapter-registry";
import { SkeletonPosAdapter } from "@/lib/pos/adapters/skeleton-adapter";
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
  if (!def.builtInCode) {
    return { state: "not_built", healthy: null, lastError: null };
  }
  const adapter = getPosAdapter(def.id);
  if (!adapter || adapter instanceof SkeletonPosAdapter) {
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

  return CONNECTOR_CATALOG.map((def) => {
    if (def.category !== "pos") {
      // Non-POS categories (delivery, reservation, ...) have no built
      // adapter/table yet — always honest "not built" until one exists.
      return { ...def, state: "not_built", healthy: null, lastError: null };
    }
    const { state, healthy, lastError } = resolvePosState(
      def,
      posRows.get(def.id)
    );
    return { ...def, state, healthy, lastError };
  });
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
