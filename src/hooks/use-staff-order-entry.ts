"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import {
  advanceTrustToKitchen,
  scheduleKitchenTrustAssume,
  type PosTrustOrder,
} from "@/components/dashboard/pos-trust-indicator";
import { loadStaffMenuProducts } from "@/components/dashboard/staff-order-entry/load-staff-menu-products";
import {
  cartItemTaxRate,
  computeLineTotal,
  lineTotal,
  matchesStaffSearch,
  productHasAvailableModifiers,
  type CategoryWithProducts,
  type LocationPaymentSettings,
  type PaymentMethodOption,
  type StaffCartItem,
  type TableWithZone,
} from "@/components/dashboard/staff-order-entry/types";
import { calculateOrderTaxFromItems } from "@/lib/tax/vat";
import { resilientFetch } from "@/lib/fetch/resilient-fetch";
import { enqueueStaffOrder, removeQueuedStaffOrder, type StaffOrderQueueItem } from "@/lib/offline/order-queue";
import {
  isBrowserOffline,
  shouldQueueStaffOrderOffline,
} from "@/lib/offline/should-queue-staff-order-offline";
import {
  computeMenuVersion,
  loadStaffMenuCache,
  persistStaffMenuCache,
} from "@/lib/offline/menu-cache";
import {
  onStaffOrderSyncConflict,
  onStaffOrderSyncSuccess,
  removeUnavailableFromQueuedStaffOrder,
  retryQueuedStaffOrder,
} from "@/lib/offline/sync-manager";
import {
  emitKitchenProvisionalIfEnabled,
  submitStaffOrderLocalFirst,
} from "@/lib/offline/staff-order-submit";
import { isPosLocalFirstEnabled } from "@/lib/pos/feature-flags";
import { useConnectionStatus } from "@/hooks/use-connection-status";
import { createClient } from "@/lib/supabase/client";
import {
  STAFF_TABLE_WITH_ZONE_SELECT,
  TABLE_WITH_ZONE_SELECT,
  staffTableWithZoneRows,
  tableWithZoneRows,
} from "@/lib/supabase/query-rows";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import { inferMenuSection, type MenuSection } from "@/lib/menu-section";
import type { Category, ProductWithModifiers } from "@/types";

export function useStaffOrderEntry(initialTableId?: string) {
  const router = useRouter();
  const pathname = usePathname();
  const ordersRedirect = pathname.startsWith("/waiter")
    ? "/waiter/orders"
    : "/dashboard/orders";
  const {
    locationId,
    orgId,
    currency,
    inPersonPaymentLocation,
    stripeOnboarded,
    staffRole,
  } = useDashboard();
  const { status: connectionStatus } = useConnectionStatus();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tables, setTables] = useState<TableWithZone[]>([]);
  const [categories, setCategories] = useState<CategoryWithProducts[]>([]);
  const [paymentSettings, setPaymentSettings] =
    useState<LocationPaymentSettings | null>(null);
  const [defaultTaxPercent, setDefaultTaxPercent] = useState(19);
  const [menuVersion, setMenuVersion] = useState("");
  const localFirstEnabled = isPosLocalFirstEnabled(locationId);
  const [trustOrders, setTrustOrders] = useState<PosTrustOrder[]>([]);
  const [conflictItem, setConflictItem] = useState<StaffOrderQueueItem | null>(
    null
  );
  const [conflictBusy, setConflictBusy] = useState(false);

  const [selectedTable, setSelectedTable] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<StaffCartItem[]>([]);
  const [isTakeaway, setIsTakeaway] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodOption>("at_bar");
  const [orderNotes, setOrderNotes] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [modifierProduct, setModifierProduct] =
    useState<ProductWithModifiers | null>(null);
  const [modifierMenuSection, setModifierMenuSection] =
    useState<MenuSection>("food");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalOrder, setTerminalOrder] = useState<{
    orderId: string;
    orderNumber: number;
    total: number;
    tableName: string;
  } | null>(null);

  useEffect(() => {
    const offSuccess = onStaffOrderSyncSuccess((result) => {
      setTrustOrders((prev) =>
        prev.map((order) =>
          order.clientOrderId === result.clientOrderId
            ? {
                ...order,
                phase: "confirmed" as const,
                orderNumber: result.orderNumber,
              }
            : order
        )
      );
      window.setTimeout(() => {
        setTrustOrders((prev) =>
          prev.filter((order) => order.clientOrderId !== result.clientOrderId)
        );
      }, 4000);
    });
    const offConflict = onStaffOrderSyncConflict((item) => {
      setTrustOrders((prev) =>
        prev.filter((order) => order.clientOrderId !== item.clientOrderId)
      );
      setConflictItem(item);
    });
    return () => {
      offSuccess();
      offConflict();
    };
  }, []);

  useEffect(() => {
    const onKitchen = (event: Event) => {
      const clientOrderId = (event as CustomEvent<{ clientOrderId: string }>)
        .detail.clientOrderId;
      setTrustOrders((prev) =>
        prev.map((order) =>
          order.clientOrderId === clientOrderId && order.phase === "saved"
            ? { ...order, phase: "kitchen" as const }
            : order
        )
      );
    };
    window.addEventListener("pos-trust:kitchen", onKitchen);
    return () => window.removeEventListener("pos-trust:kitchen", onKitchen);
  }, []);

  const registerTrustOrder = useCallback(
    (clientOrderId: string, tableName: string) => {
      setTrustOrders((prev) => [
        ...prev.filter((order) => order.clientOrderId !== clientOrderId),
        { clientOrderId, tableName, phase: "saved" },
      ]);
      scheduleKitchenTrustAssume(clientOrderId);
    },
    []
  );

  const load = useCallback(async () => {
    setLoading(true);

    const cachedMenu = await loadStaffMenuCache(locationId).catch(() => null);
    if (cachedMenu) {
      setCategories(cachedMenu.categories);
      setMenuVersion(cachedMenu.menuVersion);
      setLoading(false);
    }

    const supabase = createClient();

    const [
      { data: tablesData },
      { data: categoriesData },
      { data: locationData },
      { data: orgData },
      productList,
    ] = await Promise.all([
      supabase
        .from("tables")
        .select(STAFF_TABLE_WITH_ZONE_SELECT)
        .eq("location_id", locationId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("categories")
        .select("id, name, name_en, menu_section, sort_order, is_active")
        .eq("location_id", locationId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("sort_order"),
      supabase
        .from("locations")
        .select(
          "accepting_orders, payment_online_enabled, payment_at_bar_enabled, payment_card_at_table_enabled"
        )
        .eq("id", locationId)
        .single(),
      supabase
        .from("organizations")
        .select("default_tax_percent")
        .eq("id", orgId)
        .single(),
      loadStaffMenuProducts(supabase, locationId),
    ]);

    const productsByCategory = new Map<string, ProductWithModifiers[]>();
    for (const product of productList) {
      if (!product.category_id) continue;
      const list = productsByCategory.get(product.category_id) ?? [];
      list.push(product);
      productsByCategory.set(product.category_id, list);
    }

    const tableRows = staffTableWithZoneRows(tablesData);
    setTables(tableRows);
    setSelectedTable((prev) => {
      if (prev && tableRows.some((table) => table.id === prev)) {
        return prev;
      }
      if (
        initialTableId &&
        tableRows.some((table) => table.id === initialTableId)
      ) {
        return initialTableId;
      }
      return tableRows[0]?.id ?? "";
    });

    const normalizedCategories: CategoryWithProducts[] = (
      (categoriesData as Category[]) ?? []
    )
      .map((category) => ({
        ...category,
        products: productsByCategory.get(category.id) ?? [],
      }))
      .filter((category) => category.products.length > 0);

    setCategories(normalizedCategories);

    const version = computeMenuVersion(
      productList.map((product: ProductWithModifiers) => ({
        updated_at: product.updated_at,
      }))
    );
    setMenuVersion(version);

    void persistStaffMenuCache({
      locationId,
      menuVersion: version,
      categories: normalizedCategories,
      cachedAt: new Date().toISOString(),
    }).catch(() => {});

    const loc = locationData as LocationPaymentSettings | null;
    setPaymentSettings(loc);

    const org = orgData as { default_tax_percent: number } | null;
    setDefaultTaxPercent(Number(org?.default_tax_percent ?? 19));

    setLoading(false);
  }, [initialTableId, locationId, orgId]);

  useEffect(() => {
    if (staffRole === "kitchen") {
      router.replace("/dashboard/orders");
      return;
    }
    void load();
  }, [staffRole, router, load]);

  const availablePaymentMethods = useMemo(() => {
    if (!paymentSettings) return ["at_bar"] as PaymentMethodOption[];
    const methods: PaymentMethodOption[] = [];
    if (paymentSettings.payment_at_bar_enabled) methods.push("at_bar");
    if (paymentSettings.payment_card_at_table_enabled) {
      methods.push("card_at_table");
    }
    if (paymentSettings.payment_card_at_table_enabled && stripeOnboarded) {
      methods.push("card_terminal");
    }
    if (paymentSettings.payment_online_enabled && stripeOnboarded) {
      methods.push("online");
    }
    return methods.length ? methods : (["at_bar"] as PaymentMethodOption[]);
  }, [paymentSettings, stripeOnboarded]);

  useEffect(() => {
    if (!availablePaymentMethods.includes(paymentMethod)) {
      setPaymentMethod(availablePaymentMethods[0] ?? "at_bar");
    }
  }, [availablePaymentMethods, paymentMethod]);

  const tablesByZone = useMemo(() => {
    const groups = new Map<
      string,
      { zoneName: string; tables: TableWithZone[] }
    >();
    for (const table of tables) {
      const key = table.zone_id ?? "__none__";
      const existing = groups.get(key);
      if (existing) {
        existing.tables.push(table);
      } else {
        groups.set(key, {
          zoneName: table.zone?.name ?? "No zone",
          tables: [table],
        });
      }
    }
    return groups;
  }, [tables]);

  const flatProducts = useMemo(
    () =>
      categories.flatMap((category) =>
        category.products.map((product) => ({
          product,
          categoryId: category.id,
          menuSection: inferMenuSection(category),
        }))
      ),
    [categories]
  );

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim();
    return flatProducts.filter(({ product, categoryId }) => {
      if (selectedCategory !== "all" && categoryId !== selectedCategory) {
        return false;
      }
      if (query && !matchesStaffSearch(product, query)) return false;
      return true;
    });
  }, [flatProducts, selectedCategory, searchQuery]);

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const orderTotals = useMemo(() => {
    return calculateOrderTaxFromItems(
      cart.map((item) => ({
        lineTotal: lineTotal(item),
        taxRate: cartItemTaxRate(item, isTakeaway, defaultTaxPercent),
      }))
    );
  }, [cart, isTakeaway, defaultTaxPercent]);

  function addCartItem(item: Omit<StaffCartItem, "id" | "lineTotal">) {
    setCart((prev) => [
      ...prev,
      {
        ...item,
        id: crypto.randomUUID(),
        lineTotal: computeLineTotal(item),
      },
    ]);
  }

  function handleProductClick(
    product: ProductWithModifiers,
    menuSection: MenuSection
  ) {
    const hasModifiers = productHasAvailableModifiers(product);
    if (hasModifiers) {
      setModifierMenuSection(menuSection);
      setModifierProduct(product);
      return;
    }

    addCartItem({
      productId: product.id,
      productName: product.name,
      unitPrice: Number(product.price),
      quantity: 1,
      notes: "",
      modifiers: [],
      menuSection,
      productTaxRate:
        product.tax_rate != null ? Number(product.tax_rate) : null,
    });
    toast.success(`${product.name} added`);
  }

  function updateQuantity(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item;
          const quantity = item.quantity + delta;
          return {
            ...item,
            quantity,
            lineTotal: computeLineTotal({ ...item, quantity }),
          };
        })
        .filter((item) => item.quantity > 0)
    );
  }

  function removeItem(id: string) {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }

  async function verifyTableStillValid(): Promise<boolean> {
    const supabase = createClient();
    const { data: table } = await supabase
      .from("tables")
      .select("id, deleted_at")
      .eq("id", selectedTable)
      .maybeSingle();

    if (!table || (table as { deleted_at: string | null }).deleted_at) {
      toast.error("Tisch ist nicht mehr verfügbar.");
      return false;
    }

    const { data: loc } = await supabase
      .from("locations")
      .select("accepting_orders")
      .eq("id", locationId)
      .single();

    if (!(loc as { accepting_orders: boolean } | null)?.accepting_orders) {
      toast.error("Bestellungen sind derzeit pausiert.");
      return false;
    }

    return true;
  }

  async function handleSubmit() {
    if (!selectedTable || cart.length === 0) return;
    if (!localFirstEnabled && submitting) return;

    const tableName =
      tables.find((table) => table.id === selectedTable)?.name ?? "Tisch";
    const clientOrderId = crypto.randomUUID();

    const payload = {
      tableId: selectedTable,
      clientOrderId,
      items: cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        notes: item.notes || undefined,
        modifiers: item.modifiers.map((mod) => ({
          modifierId: mod.modifierId,
        })),
      })),
      paymentMethod,
      notes: orderNotes.trim() || undefined,
      isTakeaway,
    };

    const clearOrderForm = () => {
      setCart([]);
      setOrderNotes("");
      setIsTakeaway(false);
      setCartOpen(false);
    };

    if (localFirstEnabled && paymentMethod !== "card_terminal") {
      try {
        const result = await submitStaffOrderLocalFirst({
          locationId,
          tableId: selectedTable,
          tableName,
          menuVersion,
          cartItems: cart.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            productTaxRate: item.productTaxRate,
            menuSection: item.menuSection,
            notes: item.notes || undefined,
            modifiers: item.modifiers.map((mod) => ({
              modifierId: mod.modifierId,
              price: mod.price,
            })),
          })),
          paymentMethod,
          orderNotes,
          isTakeaway,
          defaultTaxPercent,
          onClearForm: clearOrderForm,
          onOrderSaved: (savedId) => registerTrustOrder(savedId, tableName),
          onKitchenBroadcast: advanceTrustToKitchen,
        });
        toast.success(
          result.syncedImmediately ?
            "Bestellung erstellt ✓"
          : "Bestellung gespeichert ✓ — Sync läuft"
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Bestellung fehlgeschlagen";
        toast.error(message);
      }
      return;
    }

    if (!(await verifyTableStillValid())) return;

    const isOffline =
      connectionStatus === "offline" || isBrowserOffline();

    if (isOffline) {
      if (paymentMethod === "card_terminal") {
        toast.error(
          "Kartenterminal-Zahlung erfordert eine Internetverbindung."
        );
        return;
      }

      setSubmitting(true);
      try {
        const clientOrderId = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        await enqueueStaffOrder({
          id: clientOrderId,
          clientOrderId,
          locationId,
          createdAt,
          tableId: selectedTable,
          tableName,
          menuVersion,
          payload: {
            ...payload,
            clientOrderId,
            menuVersion,
          },
        });
        void emitKitchenProvisionalIfEnabled({
          clientOrderId,
          locationId,
          tableId: selectedTable,
          tableName,
          items: cart.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
            notes: item.notes || undefined,
          })),
          total: cart.reduce((sum, item) => sum + item.lineTotal, 0),
          createdAt,
        });
        toast.success("Bestellung erstellt ✓ (offline gespeichert)");
        clearOrderForm();
      } catch {
        toast.error("Bestellung konnte nicht gespeichert werden.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);

    try {
      const { data: json, error, retried, status } = await resilientFetch<{
        data: {
          orderId: string;
          orderNumber: number;
          tableName: string;
          total: number;
        } | null;
        error: string | null;
      }>("/api/staff-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (error || !json?.data) {
        if (
          paymentMethod !== "card_terminal" &&
          shouldQueueStaffOrderOffline({
            connectionStatus,
            httpStatus: status,
            error,
            retried,
          })
        ) {
          const clientOrderId = crypto.randomUUID();
          await enqueueStaffOrder({
            id: clientOrderId,
            clientOrderId,
            createdAt: new Date().toISOString(),
            tableId: selectedTable,
            tableName,
            menuVersion,
            payload: {
              ...payload,
              clientOrderId,
              menuVersion,
            },
          });
          toast.message(
            "Bestellung offline gespeichert — wird synchronisiert, sobald die Verbindung steht."
          );
          clearOrderForm();
          return;
        }

        toast.error(json?.error ?? error ?? "Bestellung konnte nicht erstellt werden.");
        return;
      }

      const data = json.data;

      if (paymentMethod === "card_terminal") {
        setTerminalOrder(data);
        setTerminalOpen(true);
        clearOrderForm();
        return;
      }

      toast.success(
        `Bestellung ${formatOrderNumber(data.orderNumber)} — ${data.tableName} — ${formatPrice(data.total, currency)}`,
        { duration: 5000 }
      );
      clearOrderForm();
      router.push(ordersRedirect);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      if (
        paymentMethod !== "card_terminal" &&
        shouldQueueStaffOrderOffline({
          connectionStatus,
          error: message,
          retried: false,
        })
      ) {
        try {
          const clientOrderId = crypto.randomUUID();
          await enqueueStaffOrder({
            id: clientOrderId,
            clientOrderId,
            createdAt: new Date().toISOString(),
            tableId: selectedTable,
            tableName,
            menuVersion,
            payload: {
              ...payload,
              clientOrderId,
              menuVersion,
            },
          });
          toast.message(
            "Bestellung offline gespeichert — wird synchronisiert, sobald die Verbindung steht."
          );
          clearOrderForm();
          return;
        } catch {
          // fall through
        }
      }
      toast.error("Bestellung konnte nicht erstellt werden.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    Boolean(selectedTable) &&
    cart.length > 0 &&
    (localFirstEnabled || !submitting) &&
    paymentSettings?.accepting_orders !== false;

  async function handleConflictRemoveUnavailable(item: StaffOrderQueueItem) {
    setConflictBusy(true);
    try {
      const names = item.unavailableProducts ?? [];
      const ok = await removeUnavailableFromQueuedStaffOrder(item.id, names);
      setConflictItem(null);
      if (!ok && names.length > 0) {
        toast.message("Bestellung aktualisiert — erneuter Sync läuft.");
      }
    } finally {
      setConflictBusy(false);
    }
  }

  async function handleConflictRetry(item: StaffOrderQueueItem) {
    setConflictBusy(true);
    try {
      const ok = await retryQueuedStaffOrder(item.id);
      if (ok) {
        setConflictItem(null);
      } else {
        toast.error("Sync fehlgeschlagen — bitte erneut versuchen.");
      }
    } finally {
      setConflictBusy(false);
    }
  }

  async function handleConflictCancel(item: StaffOrderQueueItem) {
    setConflictBusy(true);
    try {
      await removeQueuedStaffOrder(item.id);
      setConflictItem(null);
    } finally {
      setConflictBusy(false);
    }
  }

  return {
    staffRole,
    loading,
    submitting,
    localFirstEnabled,
    trustOrders,
    conflictItem,
    setConflictItem,
    conflictBusy,
    categories,
    paymentSettings,
    currency,
    inPersonPaymentLocation,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    filteredProducts,
    cart,
    cartCount,
    selectedTable,
    setSelectedTable,
    tablesByZone,
    isTakeaway,
    setIsTakeaway,
    paymentMethod,
    setPaymentMethod,
    availablePaymentMethods,
    orderNotes,
    setOrderNotes,
    cartOpen,
    setCartOpen,
    modifierProduct,
    setModifierProduct,
    modifierMenuSection,
    terminalOpen,
    setTerminalOpen,
    terminalOrder,
    setTerminalOrder,
    ordersRedirect,
    router,
    orderTotals,
    canSubmit,
    handleSubmit,
    handleProductClick,
    updateQuantity,
    removeItem,
    addCartItem,
    handleConflictRemoveUnavailable,
    handleConflictRetry,
    handleConflictCancel,
  };
}
