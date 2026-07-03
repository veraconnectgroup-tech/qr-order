"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { Loader2 } from "lucide-react";
import { hapticSuccess } from "@/lib/haptics";
import { buildGuestOrderIdempotencyKey } from "@/lib/resilience/idempotency";
import { useCart, type CartItem } from "@/hooks/use-cart";
import { useGuestSessionToken } from "@/hooks/use-guest-session-token";
import { useGuestSession } from "@/hooks/use-guest-session";
import { useTableContext } from "@/hooks/use-table-context";
import { ApprovalWaiting } from "@/components/guest/approval-waiting";
import { TablePinGate } from "@/components/guest/table-pin-gate";
import { TablePinReveal } from "@/components/guest/table-pin-reveal";
import {
  getOrCreateDeviceFingerprint,
  getStoredDeviceToken,
  setStoredDeviceToken,
} from "@/lib/guest/device-storage";
import { ensureTableSession, isSessionExpiredError, syncTableSessionStores } from "@/lib/guest/ensure-table-session";
import { resolveActiveApprovalOrderId } from "@/lib/guest/resolve-active-approval-order";
import { formatPrice } from "@/lib/format";
import { CheckoutSkeleton } from "@/components/guest/checkout-skeleton";
import { UpsellBar } from "@/components/guest/upsell-bar";
import {
  PromoInput,
  type AppliedPromo,
} from "@/components/guest/promo-input";
import { resilientFetch } from "@/lib/fetch/resilient-fetch";
import { isServerErrorStatus } from "@/lib/payment/fetch-with-retry";
import { recordGuestOrderPlaced } from "@/lib/pwa/install-timing";
import {
  enqueueOfflineOrder,
  registerOrderSync,
} from "@/lib/pwa/offline-order-queue";
import type { TaxBreakdownLine } from "@/lib/tax/vat";
import {
  buildDeliveryQuoteMessage,
  buildDenisPickupPrompt,
  buildTakeawayPickupSlots,
  DEFAULT_DELIVERY_CONFIG,
  estimatePrepMinutesFromCart,
  legacyIsTakeaway,
  validateDeliveryOrder,
  type OrderMode,
} from "@/lib/denis/commerce/delivery-mode";
import { OrderModeSelector } from "@/components/guest/order-mode-selector";
import { CheckoutPaymentHint } from "@/components/guest/checkout-payment-hint";
import { getAvailablePaymentMethods } from "@/lib/payment-methods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOnlineStatus } from "@/hooks/use-online-status";

async function saveGuestEmail(sessionToken: string, guestEmail: string) {
  if (!guestEmail.trim()) return;
  const res = await fetch("/api/sessions/guest-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken, guestEmail: guestEmail.trim() }),
  });
  if (!res.ok) {
    throw new Error("Could not save email.");
  }
}

function OrderSummary({
  items,
  subtotal,
  taxBreakdown,
  taxAmount,
  total,
  discountAmount,
  currency,
  tUI,
}: {
  items: CartItem[];
  subtotal: number;
  taxBreakdown: TaxBreakdownLine[];
  taxAmount: number;
  total: number;
  discountAmount: number;
  currency: string;
  tUI: ReturnType<typeof useAppLocale>["tUI"];
}) {
  return (
    <div className="rounded-xl bg-zinc-900 p-4">
      <h2 className="text-caption mb-3 uppercase tracking-wide text-zinc-500">
        {tUI("checkout.orderSummary")}
      </h2>
      {items.map((item, i) => (
        <div key={i} className="flex justify-between py-1 text-sm text-zinc-300">
          <span>
            {item.quantity}× {item.productName}
          </span>
          <span className="tabular-nums">{formatPrice(item.itemTotal, currency)}</span>
        </div>
      ))}
      <div className="mt-3 space-y-1 border-t border-zinc-800 pt-3 text-sm">
        <div className="flex justify-between text-zinc-400">
          <span>{tUI("checkout.subtotal")}</span>
          <span>{formatPrice(subtotal, currency)}</span>
        </div>
        {taxBreakdown.length > 0 ? (
          taxBreakdown.map((line) => (
            <div
              key={line.rate}
              className="flex justify-between text-zinc-400 tabular-nums"
            >
              <span data-testid="checkout-tax-line">
                {tUI("checkout.tax", { rate: line.rate })}
              </span>
              <span>{formatPrice(line.amount, currency)}</span>
            </div>
          ))
        ) : (
          <div className="flex justify-between text-zinc-400">
            <span data-testid="checkout-tax-line">{tUI("checkout.taxGeneric")}</span>
            <span>{formatPrice(taxAmount, currency)}</span>
          </div>
        )}
        {discountAmount > 0 && (
          <div className="flex justify-between text-green-400">
            <span>{tUI("checkout.discount")}</span>
            <span className="tabular-nums">
              -{formatPrice(discountAmount, currency)}
            </span>
          </div>
        )}
        <div className="flex justify-between font-bold text-zinc-50">
          <span>{tUI("checkout.total")}</span>
          <span className="tabular-nums">{formatPrice(total, currency)}</span>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        {tUI("checkout.paymentLater")}
      </p>
    </div>
  );
}

export function CheckoutForm({
  slug,
  token,
  locationId,
  taxPercent,
  currency,
  isDemo = false,
  acceptingOrders = true,
  paymentOnlineEnabled = true,
  paymentAtBarEnabled = true,
  paymentCardAtTableEnabled = false,
  stripeOnboarded = false,
}: {
  slug: string;
  token: string;
  locationId: string;
  taxPercent: number;
  currency: string;
  isDemo?: boolean;
  acceptingOrders?: boolean;
  paymentOnlineEnabled?: boolean;
  paymentAtBarEnabled?: boolean;
  paymentCardAtTableEnabled?: boolean;
  stripeOnboarded?: boolean;
}) {
  const { tUI } = useAppLocale();
  const items = useCart((s) => s.items);
  const { sessionToken, hydrated: sessionHydrated } = useGuestSessionToken();
  const tableId = useGuestSession((s) => s.tableId);
  const tableName = useGuestSession((s) => s.tableName);
  const { context, loading: contextLoading, refresh: refreshContext } =
    useTableContext(isDemo ? "" : token);
  const subtotal = useCart((s) => s.subtotal());
  const taxBreakdown = useCart((s) => s.taxBreakdown);
  const taxAmount = useCart((s) => s.taxAmount);
  const total = useCart((s) => s.total);
  const clearCart = useCart((s) => s.clearCart);
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const orderPlacedRef = useRef(false);

  const [cartHydrated, setCartHydrated] = useState(() =>
    useCart.persist.hasHydrated()
  );
  const storeReady = isDemo
    ? cartHydrated
    : cartHydrated && sessionHydrated;
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const [orderMode, setOrderMode] = useState<OrderMode>("dine_in");
  const [selectedPickupIndex, setSelectedPickupIndex] = useState(0);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [approvalOrderId, setApprovalOrderId] = useState<string | null>(null);
  const [autoOpenedPin, setAutoOpenedPin] = useState<string | null>(null);
  const [autoOpenedOrderId, setAutoOpenedOrderId] = useState<string | null>(null);
  const [pinVerified, setPinVerified] = useState(false);

  const isTakeaway = legacyIsTakeaway(orderMode);
  const breakdown = taxBreakdown(orderMode, taxPercent);
  const computedTax = taxAmount(orderMode, taxPercent);
  const preDiscountTotal = total(orderMode, taxPercent);
  const discountAmount = appliedPromo?.discountAmount ?? 0;
  const computedTotal = Math.max(
    0,
    Math.round((preDiscountTotal - discountAmount) * 100) / 100
  );

  const availablePaymentMethods = getAvailablePaymentMethods({
    stripeOnboarded,
    stripePublishableKey: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    paymentOnlineEnabled,
    paymentAtBarEnabled,
    paymentCardAtTableEnabled,
  });

  const prepMinutes = estimatePrepMinutesFromCart({
    items: items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      menuSection: item.menuSection,
    })),
    baseMinutes: DEFAULT_DELIVERY_CONFIG.estimatedPrepMinutes,
  });
  const pickupSlots = buildTakeawayPickupSlots({ prepMinutes });
  const selectedPickup = pickupSlots[selectedPickupIndex] ?? pickupSlots[0];

  const deliveryValidation =
    orderMode === "delivery"
      ? validateDeliveryOrder({
          mode: "delivery",
          config: DEFAULT_DELIVERY_CONFIG,
          address: deliveryAddress,
          cartTotal: preDiscountTotal,
          distanceKm: 6,
        })
      : null;

  const deliveryQuote =
    orderMode === "delivery" && deliveryValidation?.valid
      ? buildDeliveryQuoteMessage({
          address: deliveryAddress,
          fee: deliveryValidation.fee,
          estimatedMinutes: deliveryValidation.estimatedMinutes,
          currency,
        })
      : null;

  const activeApprovalOrderId = resolveActiveApprovalOrderId(
    approvalOrderId,
    context
  );

  useEffect(() => {
    if (useCart.persist.hasHydrated()) {
      setCartHydrated(true);
    }
    return useCart.persist.onFinishHydration(() => setCartHydrated(true));
  }, []);

  useEffect(() => {
    if (!storeReady || orderPlacedRef.current) return;
    if (!items.length && !activeApprovalOrderId) {
      router.replace(`/${slug}/${token}/cart`);
      return;
    }
    if (isDemo) {
      setReady(true);
      return;
    }
    if (!contextLoading) {
      setReady(true);
    }
  }, [
    storeReady,
    items.length,
    isDemo,
    slug,
    token,
    router,
    contextLoading,
    activeApprovalOrderId,
  ]);

  useEffect(() => {
    if (isDemo || !activeApprovalOrderId || orderPlacedRef.current) return;
    orderPlacedRef.current = true;
    if (items.length > 0) {
      clearCart();
    }
  }, [isDemo, activeApprovalOrderId, items.length, clearCart]);

  async function submitOrder(activeSessionToken?: string) {
    if (activeSessionToken && guestEmail.trim()) {
      await saveGuestEmail(activeSessionToken, guestEmail);
    }

    const resolvedTableId = context?.tableId ?? tableId ?? "";
    const deviceFingerprint = getOrCreateDeviceFingerprint();
    const deviceToken = resolvedTableId
      ? getStoredDeviceToken(locationId, resolvedTableId)
      : null;

    const sessionId =
      context?.sessionId ?? activeSessionToken ?? sessionToken ?? "unknown";

    const { data: parsed, error: fetchError, status } = await resilientFetch<{
      error?: string;
      details?: { products?: string[] };
      data?: {
        orderId: string;
        awaitingApproval?: boolean;
        sessionOpened?: {
          sessionId: string;
          sessionToken: string;
          deviceToken: string;
          tablePin?: string;
        };
      };
    }>(
      "/api/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": buildGuestOrderIdempotencyKey(sessionId, items),
        },
        body: JSON.stringify({
          sessionToken: activeSessionToken,
          tableToken: token,
          deviceFingerprint,
          deviceToken: deviceToken ?? undefined,
          items,
          guestEmail: guestEmail.trim() || undefined,
          isTakeaway,
          paymentMethod: "unset",
          promoCodeId: appliedPromo?.promoCodeId,
        }),
      },
      { baseDelayMs: 2000, maxRetries: 3 }
    );

    if (!parsed) {
      throw new TypeError(fetchError ?? "Network error");
    }

    if (status && isServerErrorStatus(status)) {
      throw new Error(tUI("error.orderFailed"));
    }

    const json = parsed;

    if (!json.data?.orderId) {
      if (json.error === "pin_required") {
        throw new Error("pin_required");
      }
      if (json.error === "device_blocked") {
        throw new Error("device_blocked");
      }
      if (json.error === "awaiting_approval") {
        throw new Error("awaiting_approval");
      }
      if (
        json.error === "unavailable_products" &&
        Array.isArray(json.details?.products)
      ) {
        for (const name of json.details.products) {
          toast.error(tUI("cart.unavailableProduct", { name }));
        }
        throw new Error(tUI("cart.unavailableProductsRefresh"));
      }
      throw new Error(json.error ?? tUI("error.orderFailed"));
    }

    return json.data;
  }

  async function queueOfflineCheckout(activeSessionToken?: string) {
    const resolvedTableId = context?.tableId ?? tableId ?? "";
    const deviceFingerprint = getOrCreateDeviceFingerprint();
    const deviceToken = resolvedTableId
      ? getStoredDeviceToken(locationId, resolvedTableId)
      : null;

    enqueueOfflineOrder({
      sessionToken: activeSessionToken ?? sessionToken ?? "",
      tableToken: token,
      payload: {
        sessionToken: activeSessionToken ?? sessionToken ?? undefined,
        tableToken: token,
        deviceFingerprint,
        deviceToken: deviceToken ?? undefined,
        items,
        guestEmail: guestEmail.trim() || undefined,
        isTakeaway,
        paymentMethod: "unset",
        promoCodeId: appliedPromo?.promoCodeId,
      },
    });
    void registerOrderSync();
    toast.success(tUI("offline.orderQueued"));
  }

  async function handlePlaceOrder() {
    if (processing) return;

    if (!acceptingOrders) {
      setError(tUI("menu.orderingPaused"));
      return;
    }

    if (orderMode === "delivery") {
      const check = validateDeliveryOrder({
        mode: "delivery",
        config: DEFAULT_DELIVERY_CONFIG,
        address: deliveryAddress,
        cartTotal: preDiscountTotal,
        distanceKm: 6,
      });
      if (!check.valid) {
        setError(tUI("checkout.deliveryOutOfRange"));
        return;
      }
    }

    if (
      !isDemo &&
      context?.capabilities.needsPin &&
      !context.capabilities.canPlaceOrders &&
      !pinVerified
    ) {
      setError(tUI("session.pinRequiredBeforeOrder"));
      return;
    }

    if (activeApprovalOrderId) {
      orderPlacedRef.current = true;
      if (!approvalOrderId) {
        setApprovalOrderId(activeApprovalOrderId);
      }
      if (items.length > 0) {
        clearCart();
      }
      return;
    }

    if (!navigator.onLine) {
      setProcessing(true);
      setError(null);
      try {
        const activeSessionToken = isDemo
          ? (sessionToken ??
            (await ensureTableSession(slug, token, tableId ?? undefined)) ??
            undefined)
          : (context?.sessionToken ?? sessionToken ?? undefined);
        await queueOfflineCheckout(activeSessionToken ?? undefined);
        orderPlacedRef.current = true;
        clearCart();
      } finally {
        setProcessing(false);
      }
      return;
    }

    setProcessing(true);
    setError(null);

    let activeSessionToken: string | undefined;

    try {
      activeSessionToken = isDemo
        ? (sessionToken ??
          (await ensureTableSession(slug, token, tableId ?? undefined)) ??
          undefined)
        : (context?.sessionToken ?? sessionToken ?? undefined);

      const result = await submitOrder(activeSessionToken ?? undefined);

      if (result.awaitingApproval) {
        orderPlacedRef.current = true;
        setApprovalOrderId(result.orderId);
        clearCart();
        setProcessing(false);
        return;
      }

      if (result.sessionOpened) {
        setStoredDeviceToken(
          locationId,
          context?.tableId ?? tableId ?? "",
          result.sessionOpened.deviceToken
        );
        syncTableSessionStores(
          slug,
          token,
          {
            sessionId: result.sessionOpened.sessionId,
            sessionToken: result.sessionOpened.sessionToken,
            tableId: context?.tableId ?? tableId ?? "",
            tableName: context?.tableName ?? tableName ?? "",
            locationId,
          },
          context?.tableId ?? tableId
        );
        activeSessionToken = result.sessionOpened.sessionToken;
      }

      if (result.sessionOpened?.tablePin) {
        orderPlacedRef.current = true;
        setAutoOpenedPin(result.sessionOpened.tablePin);
        setAutoOpenedOrderId(result.orderId);
        clearCart();
        setProcessing(false);
        return;
      }

      orderPlacedRef.current = true;
      recordGuestOrderPlaced();
      hapticSuccess();
      router.replace(`/${slug}/${token}/order/${result.orderId}?placed=1`);
      clearCart();

      if (activeSessionToken && guestEmail.trim()) {
        void saveGuestEmail(activeSessionToken, guestEmail);
      }
      setProcessing(false);
      return;
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (message === "pin_required") {
        setError(tUI("session.pinRequiredBeforeOrder"));
        setProcessing(false);
        return;
      }
      if (message === "device_blocked") {
        setError(tUI("session.deviceBlockedHint"));
        void refreshContext();
        setProcessing(false);
        return;
      }
      if (message === "awaiting_approval") {
        const refreshed = await refreshContext();
        const pendingId = resolveActiveApprovalOrderId(null, refreshed);
        if (pendingId) {
          orderPlacedRef.current = true;
          setApprovalOrderId(pendingId);
          clearCart();
        } else {
          setError(tUI("session.approvalWaitingHint"));
        }
        setProcessing(false);
        return;
      }
      if (!navigator.onLine || e instanceof TypeError) {
        await queueOfflineCheckout(activeSessionToken ?? sessionToken ?? undefined);
        orderPlacedRef.current = true;
        clearCart();
        setProcessing(false);
        return;
      }
      if (isSessionExpiredError(message)) {
        setError(tUI("ai.overlay.sessionExpired"));
        setProcessing(false);
        return;
      }
      setError(e instanceof Error ? e.message : tUI("error.generic"));
      setProcessing(false);
    }
  }

  if (!ready || (!isDemo && contextLoading)) {
    return (
      <div className="py-6">
        <CheckoutSkeleton />
      </div>
    );
  }

  if (!isDemo && !context && !contextLoading) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
        <p className="text-sm text-red-200">{tUI("error.networkRetry")}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-4 border-zinc-700"
          onClick={() => void refreshContext()}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (autoOpenedPin && autoOpenedOrderId) {
    return (
      <TablePinReveal
        tablePin={autoOpenedPin}
        onContinue={() =>
          router.replace(`/${slug}/${token}/order/${autoOpenedOrderId}?placed=1`)
        }
      />
    );
  }

  if (activeApprovalOrderId && (context?.tableId || tableId || locationId)) {
    return (
      <ApprovalWaiting
        slug={slug}
        token={token}
        orderId={activeApprovalOrderId}
        tableId={context?.tableId ?? tableId ?? ""}
        tableName={context?.tableName ?? tableName ?? ""}
        locationId={context?.locationId ?? locationId}
      />
    );
  }

  const showPinGate =
    !isDemo &&
    context?.sessionStatus === "active" &&
    context.capabilities.needsPin &&
    !pinVerified;

  const showDeviceBlocked =
    !isDemo && context?.capabilities.deviceBlocked;

  return (
    <div className="space-y-6" aria-label={tUI("checkout.title")}>
      {showDeviceBlocked && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
          <p className="font-semibold text-red-300">
            {tUI("session.deviceBlockedTitle")}
          </p>
          <p className="mt-2 text-sm text-red-200/80">
            {tUI("session.deviceBlockedHint")}
          </p>
        </div>
      )}

      {showPinGate && (
        <TablePinGate
          slug={slug}
          tableToken={token}
          tableId={context.tableId}
          locationId={context.locationId}
          tableName={context.tableName}
          onVerified={() => {
            setPinVerified(true);
            void refreshContext();
          }}
        />
      )}

      {!showPinGate && !showDeviceBlocked && (
        <>
      {!acceptingOrders && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center text-sm text-amber-200">
          {tUI("menu.orderingPaused")}
        </div>
      )}

      <OrderModeSelector
        orderMode={orderMode}
        onOrderModeChange={setOrderMode}
        takeawayEnabled={DEFAULT_DELIVERY_CONFIG.takeawayEnabled}
        deliveryEnabled={DEFAULT_DELIVERY_CONFIG.deliveryEnabled}
        pickupSlots={pickupSlots}
        selectedPickupIndex={selectedPickupIndex}
        onPickupIndexChange={setSelectedPickupIndex}
        deliveryAddress={deliveryAddress}
        onDeliveryAddressChange={setDeliveryAddress}
        deliveryQuote={deliveryQuote}
        deliveryError={
          deliveryValidation && !deliveryValidation.valid
            ? deliveryValidation.error === "outside_delivery_radius"
              ? tUI("checkout.deliveryOutOfRange")
              : deliveryValidation.error ?? null
            : null
        }
        dineInLabel={tUI("checkout.dineIn")}
        takeawayLabel={tUI("checkout.takeaway")}
        deliveryLabel={tUI("checkout.delivery")}
        pickupPrompt={buildDenisPickupPrompt()}
      />

      <PromoInput
        locationId={locationId}
        orderAmount={preDiscountTotal}
        currency={currency}
        value={appliedPromo}
        onChange={setAppliedPromo}
      />

      <OrderSummary
        items={items}
        subtotal={subtotal}
        taxBreakdown={breakdown}
        taxAmount={computedTax}
        total={computedTotal}
        discountAmount={discountAmount}
        currency={currency}
        tUI={tUI}
      />

      <CheckoutPaymentHint
        orderTotal={computedTotal}
        availableMethods={availablePaymentMethods}
      />

      <div>
        <Label htmlFor="checkout-email" className="text-zinc-400">
          {tUI("checkout.email")}
        </Label>
        <Input
          id="checkout-email"
          type="email"
          placeholder={tUI("checkout.emailPlaceholder")}
          className="mt-1 border-zinc-700 bg-zinc-950 text-zinc-100"
          value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
        />
        <p className="mt-1.5 text-xs text-zinc-500">{tUI("checkout.emailHint")}</p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <UpsellBar
        locationId={locationId}
        currency={currency}
        variant="checkout"
      />

      <Button
        type="button"
        disabled={processing || !acceptingOrders}
        onClick={handlePlaceOrder}
        className="h-14 w-full rounded-xl bg-orange-500 text-base font-bold hover:bg-orange-600 disabled:opacity-80"
      >
        {processing ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            {tUI("checkout.placingOrderWithTotal", {
              amount: formatPrice(computedTotal, currency),
            })}
          </span>
        ) : !isOnline ? (
          tUI("offline.orderQueuedShort")
        ) : (
          tUI("checkout.placeOrderWithTotal", {
            amount: formatPrice(computedTotal, currency),
          })
        )}
      </Button>
        </>
      )}
    </div>
  );
}
