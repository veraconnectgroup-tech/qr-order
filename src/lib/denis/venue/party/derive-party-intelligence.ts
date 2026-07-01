import type { PartyMode, PartyOrderRow, TablePartyModel } from "@/lib/denis/venue/party/types";

export type PartyIntelligenceFacts = {
  partySize: number;
  devicesWithOrder: number;
  orderedRatio: number;
  partyMode: PartyMode;
  minutesSinceLastOrder: number | null;
  /** Partial group ordering — table has mixed progress (G3). */
  isPartyIncomplete: boolean;
  /** Only the lagging guest should get the party_incomplete nudge. */
  isPartyIncompleteForCurrentDevice: boolean;
  currentDeviceHasOrdered: boolean;
};

const PARTY_INCOMPLETE_WAIT_MINUTES = 5;

const ROUND_ORDER_PATTERN =
  /\b(za ceo sto|za cijeli sto|for the (whole )?table|für den tisch|svima|za sve|round order|cela grupa|für alle)\b/i;

export function detectRoundOrderIntent(message: string): boolean {
  return ROUND_ORDER_PATTERN.test(message.trim());
}

export function buildRoundOrderDenisMessage(language?: string | null): string {
  const lang = (language ?? "sr").slice(0, 2);
  switch (lang) {
    case "de":
      return "Bestelle ich für den ganzen Tisch? Super — was darf es sein?";
    case "en":
      return "Ordering for the whole table? Great — what would you like?";
    default:
      return "Naručujem za ceo sto? Super — šta želite?";
  }
}

function manualCartItemCount(snapshot: unknown): number {
  if (!snapshot || typeof snapshot !== "object") return 0;
  const items = (snapshot as { items?: unknown }).items;
  return Array.isArray(items) ? items.length : 0;
}

function deviceHasCartActivity(device: TablePartyModel["devices"][number]): boolean {
  return manualCartItemCount(device.manualCartSnapshot) > 0;
}

function activeOrders(orders: PartyOrderRow[]): PartyOrderRow[] {
  return orders.filter(
    (order) => order.status !== "cancelled" && order.status !== "rejected"
  );
}

function minutesSinceLastOrder(orders: PartyOrderRow[], nowMs: number): number | null {
  const active = activeOrders(orders);
  if (active.length === 0) return null;
  const lastMs = Math.max(
    ...active.map((order) => new Date(order.createdAt).getTime())
  );
  return Math.round((nowMs - lastMs) / 60_000);
}

function deviceHasOrdered(input: {
  party: TablePartyModel;
  orders: PartyOrderRow[];
  deviceFingerprint: string;
}): boolean {
  const fp = input.deviceFingerprint.trim().toLowerCase();
  const device = input.party.devices.find(
    (row) => row.deviceFingerprint.toLowerCase() === fp
  );
  if (!device) return false;

  const active = activeOrders(input.orders);

  if (input.party.partyMode === "shared_cart") {
    if (active.length > 0) return true;
    return deviceHasCartActivity(device);
  }

  return (
    active.some(
      (order) => order.deviceFingerprint?.trim().toLowerCase() === fp
    ) || deviceHasCartActivity(device)
  );
}

function countDevicesWithOrder(input: {
  party: TablePartyModel;
  orders: PartyOrderRow[];
}): number {
  const { party, orders } = input;
  const active = activeOrders(orders);

  if (party.partyMode === "shared_cart") {
    if (active.length > 0) return party.activeDeviceCount;
    return party.devices.filter((device) => deviceHasCartActivity(device)).length;
  }

  const orderFingerprints = new Set(
    active
      .map((order) => order.deviceFingerprint?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value))
  );

  return party.devices.filter(
    (device) =>
      orderFingerprints.has(device.deviceFingerprint.toLowerCase()) ||
      deviceHasCartActivity(device)
  ).length;
}

/** Party beliefs + proactive trigger inputs from table session TRUTH (G3). */
export function derivePartyIntelligence(input: {
  party: TablePartyModel | null | undefined;
  orders: PartyOrderRow[];
  nowMs?: number;
}): PartyIntelligenceFacts | null {
  const party = input.party;
  if (!party || party.activeDeviceCount <= 0) return null;

  const nowMs = input.nowMs ?? Date.now();
  const partySize = party.activeDeviceCount;
  const devicesWithOrder = countDevicesWithOrder({ party, orders: input.orders });
  const orderedRatio =
    partySize > 0 ? Number((devicesWithOrder / partySize).toFixed(2)) : 0;
  const sinceLastOrder = minutesSinceLastOrder(input.orders, nowMs);

  const currentFp = party.currentDeviceFingerprint?.trim() ?? "";
  const currentDeviceHasOrdered = currentFp
    ? deviceHasOrdered({ party, orders: input.orders, deviceFingerprint: currentFp })
    : false;

  const isPartyIncomplete =
    partySize >= 2 &&
    devicesWithOrder >= 1 &&
    devicesWithOrder < partySize &&
    sinceLastOrder != null &&
    sinceLastOrder >= PARTY_INCOMPLETE_WAIT_MINUTES;

  const isPartyIncompleteForCurrentDevice =
    isPartyIncomplete && !currentDeviceHasOrdered;

  return {
    partySize,
    devicesWithOrder,
    orderedRatio,
    partyMode: party.partyMode,
    minutesSinceLastOrder: sinceLastOrder,
    isPartyIncomplete,
    isPartyIncompleteForCurrentDevice,
    currentDeviceHasOrdered,
  };
}

export function buildPartyDockHeadline(
  facts: PartyIntelligenceFacts | null
): string | null {
  if (!facts || facts.partySize < 2) return null;
  if (facts.devicesWithOrder <= 0 || facts.devicesWithOrder >= facts.partySize) {
    return null;
  }
  return `${facts.devicesWithOrder}/${facts.partySize} naručilo | Čekamo ostale?`;
}

export function buildPartyIncompleteMessage(
  facts: PartyIntelligenceFacts,
  language?: string | null
): string {
  const lang = (language ?? "sr").slice(0, 2);

  if (facts.partyMode === "shared_cart") {
    switch (lang) {
      case "de":
        return "Möchten Sie gemeinsam bestellen?";
      case "en":
        return "Would you like to order together?";
      default:
        return "Želite li da naručite zajedno?";
    }
  }

  switch (lang) {
    case "de":
      return "Es sieht so aus, als hätten alle anderen schon bestellt — darf ich Ihnen helfen?";
    case "en":
      return "Looks like everyone else has ordered — may I help you too?";
    default:
      return "Izgleda da svi već naručili — smem li i vama pomoći?";
  }
}
