export type OrderMode = "dine_in" | "takeaway" | "delivery";

export type DeliveryPartner =
  | "internal"
  | "wolt"
  | "glovo"
  | "deliverect"
  | null;

export type DeliveryConfig = {
  takeawayEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryRadius: number;
  /** Major currency units (e.g. euros). */
  deliveryFee: number;
  /** Per-km surcharge in major currency units. */
  deliveryFeePerKm?: number;
  freeDeliveryAbove: number;
  estimatedPrepMinutes: number;
  deliveryPartner: DeliveryPartner;
  separateMenu: boolean;
  onlinePaymentOnly: boolean;
};

export type TakeawayOrder = {
  orderId: string;
  mode: "takeaway" | "delivery";
  pickupTime: string | null;
  deliveryAddress: string | null;
  contactPhone: string;
  estimatedReadyMinutes: number;
  status: "preparing" | "ready" | "picked_up" | "delivered";
};

export const DEFAULT_DELIVERY_CONFIG: DeliveryConfig = {
  takeawayEnabled: true,
  deliveryEnabled: false,
  deliveryRadius: 5,
  deliveryFee: 3.5,
  deliveryFeePerKm: 0.5,
  freeDeliveryAbove: 20,
  estimatedPrepMinutes: 20,
  deliveryPartner: null,
  separateMenu: false,
  onlinePaymentOnly: true,
};

export type PickupSlot = {
  label: string;
  pickupTime: string | null;
  estimatedMinutes: number;
};

export type FulfillmentCartLine = {
  productId: string;
  productName: string;
  quantity: number;
  menuSection?: string;
  itemTotal?: number;
  fulfillmentMode?: OrderMode;
};

export type PackagingSuggestion = {
  productName: string;
  suggestion: string;
};

const SOUP_KEYWORDS = /supa|soup|čorba|corba|broth/i;
const LIQUID_KEYWORDS = /sos|sauce|dressing|dip/i;

export function isOffPremiseMode(mode: OrderMode): boolean {
  return mode === "takeaway" || mode === "delivery";
}

export function orderModeFromLegacy(isTakeaway: boolean): OrderMode {
  return isTakeaway ? "takeaway" : "dine_in";
}

export function legacyIsTakeaway(mode: OrderMode): boolean {
  return isOffPremiseMode(mode);
}

export function estimatePrepMinutesFromCart(input: {
  items: FulfillmentCartLine[];
  baseMinutes?: number;
  minutesPerItem?: number;
  kitchenLoadFactor?: number;
}): number {
  const base = input.baseMinutes ?? DEFAULT_DELIVERY_CONFIG.estimatedPrepMinutes;
  const perItem = input.minutesPerItem ?? 2;
  const load = input.kitchenLoadFactor ?? 1;
  const itemCount = input.items.reduce((sum, row) => sum + row.quantity, 0);
  const foodItems = input.items.filter(
    (row) => row.menuSection === "food" || row.menuSection === "desserts"
  );
  const complexityBonus = foodItems.length > 3 ? 5 : 0;
  const raw = base + itemCount * perItem + complexityBonus;
  return Math.max(5, Math.round(raw * load));
}

export function buildTakeawayPickupSlots(input: {
  now?: number;
  prepMinutes: number;
  timezone?: string;
}): PickupSlot[] {
  const now = input.now ?? Date.now();
  const prep = Math.max(5, input.prepMinutes);

  const asap = new Date(now + prep * 60_000);
  const slots: PickupSlot[] = [
    {
      label: `Što prije (~${prep} min)`,
      pickupTime: asap.toISOString(),
      estimatedMinutes: prep,
    },
  ];

  for (const hourOffset of [1, 2]) {
    const slot = new Date(now);
    slot.setMinutes(0, 0, 0);
    slot.setHours(slot.getHours() + hourOffset);
    if (slot.getTime() <= now) continue;
    const minutes = Math.max(prep, Math.round((slot.getTime() - now) / 60_000));
    slots.push({
      label: slot.toLocaleTimeString("sr-RS", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: input.timezone,
      }),
      pickupTime: slot.toISOString(),
      estimatedMinutes: minutes,
    });
  }

  return slots.slice(0, 3);
}

export function buildDenisPickupPrompt(language?: string): string {
  const lang = (language ?? "sr").slice(0, 2);
  if (lang === "en") {
    return "When would you like to pick up? Now or in how many minutes?";
  }
  if (lang === "de") {
    return "Wann möchten Sie abholen? Jetzt oder in wie vielen Minuten?";
  }
  return "Kad želite preuzeti? Sada ili za koliko minuta?";
}

export function isWithinDeliveryRadius(input: {
  distanceKm: number;
  radiusKm: number;
}): boolean {
  return input.distanceKm >= 0 && input.distanceKm <= input.radiusKm;
}

export function calculateDeliveryFee(input: {
  config: DeliveryConfig;
  cartTotal: number;
  distanceKm?: number;
}): number {
  if (input.cartTotal >= input.config.freeDeliveryAbove) {
    return 0;
  }
  const base = input.config.deliveryFee;
  const perKm = input.config.deliveryFeePerKm ?? 0;
  const distance = Math.max(0, input.distanceKm ?? 0);
  return Math.round((base + distance * perKm) * 100) / 100;
}

export function validateDeliveryOrder(input: {
  mode: OrderMode;
  config: DeliveryConfig;
  address: string | null;
  cartTotal: number;
  withinRadius?: boolean;
  distanceKm?: number;
}): {
  valid: boolean;
  fee: number;
  estimatedMinutes: number;
  error?: string;
} {
  const prep = estimatePrepMinutesFromCart({
    items: [],
    baseMinutes: input.config.estimatedPrepMinutes,
  });
  const deliveryBuffer = 15;

  if (input.mode === "dine_in") {
    return { valid: true, fee: 0, estimatedMinutes: prep };
  }

  if (input.mode === "takeaway") {
    if (!input.config.takeawayEnabled) {
      return { valid: false, fee: 0, estimatedMinutes: prep, error: "takeaway_disabled" };
    }
    return { valid: true, fee: 0, estimatedMinutes: prep };
  }

  if (!input.config.deliveryEnabled) {
    return { valid: false, fee: 0, estimatedMinutes: prep, error: "delivery_disabled" };
  }

  if (!input.address?.trim()) {
    return { valid: false, fee: 0, estimatedMinutes: prep, error: "address_required" };
  }

  if (input.withinRadius === false) {
    return { valid: false, fee: 0, estimatedMinutes: prep, error: "outside_delivery_radius" };
  }

  if (
    input.distanceKm != null &&
    !isWithinDeliveryRadius({
      distanceKm: input.distanceKm,
      radiusKm: input.config.deliveryRadius,
    })
  ) {
    return { valid: false, fee: 0, estimatedMinutes: prep, error: "outside_delivery_radius" };
  }

  const fee = calculateDeliveryFee({
    config: input.config,
    cartTotal: input.cartTotal,
    distanceKm: input.distanceKm,
  });

  return {
    valid: true,
    fee,
    estimatedMinutes: prep + deliveryBuffer,
  };
}

export function buildTakeawayConfirmationMessage(input: {
  orderNumber: number;
  pickupTime: string;
  language?: string;
}): string {
  const lang = (input.language ?? "sr").slice(0, 2);
  const time = new Date(input.pickupTime).toLocaleTimeString(
    lang === "en" ? "en-GB" : "sr-RS",
    { hour: "2-digit", minute: "2-digit" }
  );

  if (lang === "en") {
    return `Order #${input.orderNumber} received! Ready at ${time}. We'll notify you when it's done. 📱`;
  }
  return `Narudžba #${input.orderNumber} primljena! Bit će spremna u ${time}. Javimo vam kad bude gotova. 📱`;
}

export function buildTakeawayReadyMessage(language?: string): string {
  const lang = (language ?? "sr").slice(0, 2);
  if (lang === "en") return "Your order is READY! 🎉 Pick it up at the counter.";
  return "Vaša narudžba je SPREMNA! 🎉 Pokupite na šalteru.";
}

export function buildDeliveryQuoteMessage(input: {
  address: string;
  fee: number;
  estimatedMinutes: number;
  currency?: string;
  language?: string;
}): string {
  const lang = (input.language ?? "sr").slice(0, 2);
  const currency = input.currency ?? "EUR";
  const feeFormatted = input.fee.toFixed(2);

  if (lang === "en") {
    return `Delivery to your address: €${feeFormatted}, arrives in ~${input.estimatedMinutes} min.`;
  }
  return `Dostava na vašu adresu: €${feeFormatted}, stiže za ~${input.estimatedMinutes} min.`;
}

export function kitchenOrderModeBadge(mode: OrderMode): string {
  if (mode === "takeaway") return "🟡";
  if (mode === "delivery") return "🔵";
  return "🟢";
}

export function buildKdsFulfillmentLabel(mode: OrderMode): string | null {
  if (mode === "takeaway") return "TAKEAWAY";
  if (mode === "delivery") return "DELIVERY";
  return null;
}

export function resolveKitchenPrepPriority(mode: OrderMode): number {
  if (mode === "dine_in") return 0;
  if (mode === "takeaway") return 1;
  return 2;
}

export function buildPackagingSuggestions(
  items: FulfillmentCartLine[]
): PackagingSuggestion[] {
  const suggestions: PackagingSuggestion[] = [];

  for (const item of items) {
    const name = item.productName;
    if (SOUP_KEYWORDS.test(name)) {
      suggestions.push({
        productName: name,
        suggestion: "Sealed container",
      });
    } else if (LIQUID_KEYWORDS.test(name)) {
      suggestions.push({
        productName: name,
        suggestion: "Separate leak-proof pot",
      });
    } else if (item.menuSection === "food") {
      suggestions.push({
        productName: name,
        suggestion: "Takeaway box",
      });
    }
  }

  return suggestions;
}

export function formatPackagingBlock(suggestions: PackagingSuggestion[]): string {
  if (suggestions.length === 0) return "";
  const lines = suggestions.map((row) => `${row.productName} → ${row.suggestion}`);
  return ["PACKAGING:", ...lines.map((line) => `- ${line}`)].join("\n");
}

export function splitItemsByFulfillmentMode(input: {
  items: FulfillmentCartLine[];
  defaultMode: OrderMode;
}): {
  dineIn: FulfillmentCartLine[];
  offPremise: FulfillmentCartLine[];
  isMixed: boolean;
} {
  const dineIn: FulfillmentCartLine[] = [];
  const offPremise: FulfillmentCartLine[] = [];

  for (const item of input.items) {
    const mode = item.fulfillmentMode ?? input.defaultMode;
    if (mode === "dine_in") {
      dineIn.push(item);
    } else {
      offPremise.push({ ...item, fulfillmentMode: mode });
    }
  }

  return {
    dineIn,
    offPremise,
    isMixed: dineIn.length > 0 && offPremise.length > 0,
  };
}

export function validateTakeawayPayment(input: {
  config: DeliveryConfig;
  paymentMethod: "online" | "cash" | "card_on_pickup";
}): { valid: boolean; error?: string } {
  if (input.config.onlinePaymentOnly && input.paymentMethod !== "online") {
    return { valid: false, error: "online_payment_required" };
  }
  return { valid: true };
}

export type TakeawayReadyNotification = {
  title: string;
  body: string;
  channels: Array<"push" | "sms" | "email">;
  url?: string;
};

export function buildTakeawayReadyNotification(input: {
  orderNumber: number;
  mode: OrderMode;
  guestEmail?: string | null;
  guestPhone?: string | null;
  pushAvailable?: boolean;
  orderUrl?: string;
  language?: string;
}): TakeawayReadyNotification {
  const lang = (input.language ?? "sr").slice(0, 2);
  const body = buildTakeawayReadyMessage(lang);
  const title =
    lang === "en"
      ? `Order #${input.orderNumber} ready`
      : `Narudžba #${input.orderNumber} spremna`;

  const channels: TakeawayReadyNotification["channels"] = [];
  if (input.pushAvailable) channels.push("push");
  if (input.guestPhone?.trim()) channels.push("sms");
  if (input.guestEmail?.trim()) channels.push("email");

  return {
    title,
    body,
    channels,
    url: input.orderUrl,
  };
}
