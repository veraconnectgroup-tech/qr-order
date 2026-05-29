"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { StaffOrderModifierDialog } from "@/components/dashboard/staff-order-modifier-dialog";
import { StaffOrderConflictSheet } from "@/components/dashboard/staff-order-conflict-sheet";
import {
  PosTrustIndicator,
  advanceTrustToKitchen,
  scheduleKitchenTrustAssume,
  type PosTrustOrder,
} from "@/components/dashboard/pos-trust-indicator";
import { TerminalPayment } from "@/components/dashboard/terminal-payment";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatOrderNumber, formatPrice } from "@/lib/format";
import { inferMenuSection, type MenuSection } from "@/lib/menu-section";
import type { InPersonPaymentLocation } from "@/lib/constants";
import {
  calculateOrderTaxFromItems,
  resolveItemTaxRate,
} from "@/lib/tax/vat";
import { cn } from "@/lib/utils";
import type {
  Category,
  Modifier,
  ModifierGroup,
  ProductWithModifiers,
  Table,
  Zone,
} from "@/types";

type TableWithZone = Pick<Table, "id" | "name" | "location_id" | "zone_id"> & {
  zone: Pick<Zone, "name"> | null;
};

type CategoryWithProducts = Category & {
  products: ProductWithModifiers[];
};

type StaffCartModifier = {
  modifierId: string;
  modifierName: string;
  price: number;
};

export type StaffCartItem = {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes: string;
  modifiers: StaffCartModifier[];
  menuSection: MenuSection;
  productTaxRate: number | null;
  lineTotal: number;
};

type PaymentMethodOption = "at_bar" | "card_at_table" | "card_terminal" | "online";

type LocationPaymentSettings = {
  accepting_orders: boolean;
  payment_online_enabled: boolean;
  payment_at_bar_enabled: boolean;
  payment_card_at_table_enabled: boolean;
};

type LoadedProductRow = {
  id: string;
  name: string;
  name_en: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  category_id: string | null;
  allergens: string[] | null;
  tax_rate: number | null;
  sort_order: number;
  modifier_groups?: Array<
    ModifierGroup & {
      modifiers?: Modifier[];
    }
  >;
};

const PRODUCT_SELECT =
  "id, name, name_en, price, image_url, is_available, category_id, allergens, tax_rate, sort_order, updated_at";

function normalizeLoadedProduct(
  row: LoadedProductRow,
  locationId: string
): ProductWithModifiers {
  const modifier_groups = (row.modifier_groups ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((group) => ({
      ...group,
      modifiers: (group.modifiers ?? [])
        .filter((modifier) => modifier.is_available)
        .sort((a, b) => a.sort_order - b.sort_order),
    }))
    .filter((group) => group.modifiers.length > 0);

  return {
    id: row.id,
    location_id: locationId,
    category_id: row.category_id,
    name: row.name,
    name_en: row.name_en,
    description: null,
    description_en: null,
    price: row.price,
    image_url: row.image_url,
    is_available: row.is_available,
    prep_time_minutes: null,
    allergens: row.allergens,
    tags: null,
    sort_order: row.sort_order,
    requires_serve_size: false,
    serve_size_presets: null,
    allow_custom_serve_size: true,
    tax_rate: row.tax_rate,
    ai_description: null,
    deleted_at: null,
    created_at: "",
    updated_at: "",
    modifier_groups,
  };
}

async function loadStaffMenuProducts(
  supabase: ReturnType<typeof createClient>,
  locationId: string
) {
  const { data: productsData } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("location_id", locationId)
    .eq("is_available", true)
    .is("deleted_at", null)
    .order("sort_order");

  const rows = (productsData as LoadedProductRow[]) ?? [];
  const productIds = rows.map((product) => product.id);

  const { data: modifierGroupsData } = productIds.length
    ? await supabase
        .from("modifier_groups")
        .select(
          "id, name, min_select, max_select, is_required, sort_order, product_id"
        )
        .in("product_id", productIds)
        .order("sort_order")
    : { data: [] };

  const groupIds = ((modifierGroupsData as ModifierGroup[]) ?? []).map(
    (group) => group.id
  );

  const { data: modifiersData } = groupIds.length
    ? await supabase
        .from("modifiers")
        .select("id, name, price, is_available, sort_order, group_id")
        .in("group_id", groupIds)
        .eq("is_available", true)
        .order("sort_order")
    : { data: [] };

  const modifiersByGroup = new Map<string, Modifier[]>();
  for (const modifier of (modifiersData as Modifier[]) ?? []) {
    const list = modifiersByGroup.get(modifier.group_id) ?? [];
    list.push(modifier);
    modifiersByGroup.set(modifier.group_id, list);
  }

  const groupsByProduct = new Map<
    string,
    Array<ModifierGroup & { modifiers: Modifier[] }>
  >();
  for (const group of (modifierGroupsData as ModifierGroup[]) ?? []) {
    const list = groupsByProduct.get(group.product_id) ?? [];
    list.push({
      ...group,
      modifiers: modifiersByGroup.get(group.id) ?? [],
    });
    groupsByProduct.set(group.product_id, list);
  }

  return rows.map((row) =>
    normalizeLoadedProduct(
      {
        ...row,
        modifier_groups: groupsByProduct.get(row.id) ?? [],
      },
      locationId
    )
  );
}

function productHasAvailableModifiers(product: ProductWithModifiers) {
  return (product.modifier_groups ?? []).some(
    (group) => group.modifiers.length > 0
  );
}

function matchesStaffSearch(
  product: { name: string; name_en?: string | null },
  query: string
) {
  const q = query.toLowerCase();
  return (
    product.name.toLowerCase().includes(q) ||
    (product.name_en?.toLowerCase().includes(q) ?? false)
  );
}

function atBarPaymentLabel(location: InPersonPaymentLocation) {
  switch (location) {
    case "counter":
      return "Pay at counter";
    case "table":
      return "Pay at table";
    default:
      return "Pay at bar";
  }
}

function computeLineTotal(item: {
  unitPrice: number;
  quantity: number;
  modifiers: StaffCartModifier[];
}) {
  const mods = item.modifiers.reduce((sum, mod) => sum + mod.price, 0);
  return (item.unitPrice + mods) * item.quantity;
}

function lineTotal(item: StaffCartItem) {
  return item.lineTotal;
}

function cartItemTaxRate(
  item: StaffCartItem,
  isTakeaway: boolean,
  orgDefaultRate: number
) {
  return resolveItemTaxRate({
    productTaxRate: item.productTaxRate,
    menuSection: item.menuSection,
    isTakeaway,
    orgDefaultRate,
  });
}

export function StaffOrderEntry({
  initialTableId,
}: {
  initialTableId?: string;
} = {}) {
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
        .select("id, name, location_id, zone_id, zone:zones(name)")
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

    const tableRows = (tablesData ?? []) as unknown as TableWithZone[];
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
      productList.map((product) => ({ updated_at: product.updated_at }))
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
        await submitStaffOrderLocalFirst({
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
        toast.success("Bestellung gespeichert ✓ — Sync läuft");
      } catch {
        toast.error("Bestellung konnte nicht gespeichert werden.");
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

  const cartPanel = (
    <StaffOrderCartPanel
      currency={currency}
      cart={cart}
      cartCount={cartCount}
      selectedTable={selectedTable}
      onTableChange={setSelectedTable}
      tablesByZone={tablesByZone}
      isTakeaway={isTakeaway}
      onTakeawayChange={setIsTakeaway}
      paymentMethod={paymentMethod}
      onPaymentMethodChange={setPaymentMethod}
      availablePaymentMethods={availablePaymentMethods}
      inPersonPaymentLocation={inPersonPaymentLocation}
      orderNotes={orderNotes}
      onOrderNotesChange={setOrderNotes}
      orderTotal={orderTotals.total}
      canSubmit={canSubmit}
      submitting={localFirstEnabled ? false : submitting}
      acceptingOrders={paymentSettings?.accepting_orders !== false}
      onSubmit={handleSubmit}
      onUpdateQuantity={updateQuantity}
      onRemoveItem={removeItem}
    />
  );

  if (staffRole === "kitchen") {
    return null;
  }

  if (loading) {
    return <StaffOrderEntrySkeleton />;
  }

  return (
    <>
      <PosTrustIndicator orders={trustOrders} />

      <StaffOrderConflictSheet
        item={conflictItem}
        open={conflictItem != null}
        onOpenChange={(open) => {
          if (!open) setConflictItem(null);
        }}
        busy={conflictBusy}
        onRemoveUnavailable={handleConflictRemoveUnavailable}
        onRetry={handleConflictRetry}
        onCancel={handleConflictCancel}
      />

      {!paymentSettings?.accepting_orders && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Location is not accepting orders.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
        <section className="min-w-0 space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dash-text-disabled" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search menu..."
              className="h-11 border-dash-border bg-dash-surface pl-10 text-dash-text placeholder:text-dash-text-disabled"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CategoryPill
              active={selectedCategory === "all"}
              onClick={() => setSelectedCategory("all")}
              label="All"
            />
            {categories.map((category) => (
              <CategoryPill
                key={category.id}
                active={selectedCategory === category.id}
                onClick={() => setSelectedCategory(category.id)}
                label={category.name}
              />
            ))}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <UtensilsCrossed className="mb-3 size-10 text-dash-text-disabled" />
              <p className="text-sm text-dash-text-disabled">No items found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {filteredProducts.map(({ product, menuSection }) => {
                const hasOptions = productHasAvailableModifiers(product);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleProductClick(product, menuSection)}
                    className="overflow-hidden rounded-xl border border-dash-border bg-dash-surface p-3 text-left transition hover:border-dash-surface-overlay active:scale-[0.98]"
                  >
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-dash-surface-raised">
                        <UtensilsCrossed className="size-8 text-dash-text-disabled" />
                      </div>
                    )}
                    <p className="mt-3 line-clamp-2 text-sm font-medium text-dash-text">
                      {product.name}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-dash-accent">
                      {formatPrice(Number(product.price), currency)}
                    </p>
                    {hasOptions && (
                      <p className="mt-1 text-xs text-dash-text-disabled">+ options</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-20">{cartPanel}</div>
        </aside>
      </div>

      {cartCount > 0 && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed bottom-20 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-dash-accent text-white shadow-lg shadow-dash-accent/30 transition hover:bg-dash-accent-hover active:scale-95 lg:hidden"
          aria-label="Open order"
        >
          <ShoppingCart className="size-6" />
          <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-dash-bg text-xs font-bold">
            {cartCount}
          </span>
        </button>
      )}

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-2xl border-dash-border bg-dash-bg px-4 pb-safe text-dash-text lg:hidden"
        >
          <SheetHeader className="px-0 pt-2">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-dash-surface-overlay" />
            <SheetTitle className="text-left text-base font-semibold">
              Current order
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">{cartPanel}</div>
        </SheetContent>
      </Sheet>

      <StaffOrderModifierDialog
        product={modifierProduct}
        menuSection={modifierMenuSection}
        currency={currency}
        open={Boolean(modifierProduct)}
        onOpenChange={(open) => {
          if (!open) setModifierProduct(null);
        }}
        onAdd={(item) => {
          addCartItem(item);
          toast.success(`${item.productName} added`);
          setModifierProduct(null);
        }}
      />

      {terminalOrder && (
        <TerminalPayment
          open={terminalOpen}
          orderId={terminalOrder.orderId}
          amount={terminalOrder.total}
          currency={currency}
          orderLabel={`#${formatOrderNumber(terminalOrder.orderNumber)} · ${terminalOrder.tableName}`}
          onClose={() => {
            setTerminalOpen(false);
            setTerminalOrder(null);
            router.push(ordersRedirect);
          }}
          onSuccess={() => {
            setTerminalOpen(false);
            setTerminalOrder(null);
            router.push(ordersRedirect);
          }}
        />
      )}
    </>
  );
}

function CategoryPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
        active
          ? "bg-dash-accent text-white"
          : "bg-dash-surface-raised text-dash-text-secondary hover:bg-dash-surface-overlay"
      )}
    >
      {label}
    </button>
  );
}

function StaffOrderCartPanel({
  currency,
  cart,
  cartCount,
  selectedTable,
  onTableChange,
  tablesByZone,
  isTakeaway,
  onTakeawayChange,
  paymentMethod,
  onPaymentMethodChange,
  availablePaymentMethods,
  inPersonPaymentLocation,
  orderNotes,
  onOrderNotesChange,
  orderTotal,
  canSubmit,
  submitting,
  acceptingOrders,
  onSubmit,
  onUpdateQuantity,
  onRemoveItem,
}: {
  currency: string;
  cart: StaffCartItem[];
  cartCount: number;
  selectedTable: string;
  onTableChange: (tableId: string) => void;
  tablesByZone: Map<
    string,
    { zoneName: string; tables: TableWithZone[] }
  >;
  isTakeaway: boolean;
  onTakeawayChange: (value: boolean) => void;
  paymentMethod: PaymentMethodOption;
  onPaymentMethodChange: (value: PaymentMethodOption) => void;
  availablePaymentMethods: PaymentMethodOption[];
  inPersonPaymentLocation: InPersonPaymentLocation;
  orderNotes: string;
  onOrderNotesChange: (value: string) => void;
  orderTotal: number;
  canSubmit: boolean;
  submitting: boolean;
  acceptingOrders: boolean;
  onSubmit: () => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
}) {
  const paymentLabels: Record<PaymentMethodOption, string> = {
    at_bar: atBarPaymentLabel(inPersonPaymentLocation),
    card_at_table: "Card at table",
    card_terminal: "Kartenzahlung (Terminal)",
    online: "Pay online",
  };

  return (
    <div className="rounded-2xl border border-dash-border bg-dash-surface p-4">
      <div className="mb-4">
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-dash-text-disabled">
          Table
        </label>
        <Select value={selectedTable} onValueChange={onTableChange}>
          <SelectTrigger className="h-11 w-full border-dash-surface-overlay bg-dash-bg text-dash-text">
            <SelectValue placeholder="Select table" />
          </SelectTrigger>
          <SelectContent className="border-dash-surface-overlay bg-dash-surface text-dash-text">
            {[...tablesByZone.entries()].map(([zoneKey, group]) => (
              <SelectGroup key={zoneKey}>
                <SelectLabel className="text-dash-text-disabled">
                  {group.zoneName}
                </SelectLabel>
                {group.tables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    {table.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dash-text">Order summary</h2>
        <span className="text-xs text-dash-text-disabled">{cartCount} items</span>
      </div>

      {cart.length === 0 ? (
        <p className="py-8 text-center text-sm text-dash-text-disabled">
          Tap products to add them to the order.
        </p>
      ) : (
        <ul className="max-h-[45vh] space-y-3 overflow-y-auto">
          {cart.map((item) => (
            <li
              key={item.id}
              className="rounded-xl bg-dash-surface p-3 ring-1 ring-dash-border"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-dash-text">
                    {item.productName}
                  </p>
                  {item.modifiers.length > 0 && (
                    <p className="mt-0.5 text-xs text-dash-text-disabled">
                      {item.modifiers
                        .map((mod) => mod.modifierName)
                        .join(", ")}
                    </p>
                  )}
                  {item.notes && (
                    <p className="mt-0.5 text-xs italic text-dash-text-disabled">
                      {item.notes}
                    </p>
                  )}
                </div>
                <p className="shrink-0 text-right text-sm font-semibold text-dash-text-secondary">
                  {formatPrice(item.lineTotal, currency)}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.id, -1)}
                    className="flex size-7 items-center justify-center rounded-lg border border-dash-surface-overlay text-dash-text-secondary hover:bg-dash-surface-raised"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="min-w-[1.25rem] text-center text-sm font-semibold text-dash-text">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.id, 1)}
                    className="flex size-7 items-center justify-center rounded-lg border border-dash-surface-overlay text-dash-text-secondary hover:bg-dash-surface-raised"
                    aria-label="Increase quantity"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  className="flex size-7 items-center justify-center rounded-lg text-red-400 hover:bg-red-500/10"
                  aria-label="Remove item"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-4 border-t border-dash-border pt-4">
        <label className="flex cursor-pointer items-center gap-3 text-sm text-dash-text-secondary">
          <Checkbox
            checked={isTakeaway}
            onCheckedChange={(checked) => onTakeawayChange(checked === true)}
          />
          Takeaway
        </label>

        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-dash-text-disabled">
            Payment
          </label>
          <Select
            value={paymentMethod}
            onValueChange={(value) =>
              onPaymentMethodChange(value as PaymentMethodOption)
            }
          >
            <SelectTrigger className="w-full border-dash-surface-overlay bg-dash-bg text-dash-text">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-dash-surface-overlay bg-dash-surface text-dash-text">
              {availablePaymentMethods.map((method) => (
                <SelectItem key={method} value={method}>
                  {paymentLabels[method]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label
            htmlFor="staff-order-notes"
            className="mb-2 block text-xs font-medium uppercase tracking-wide text-dash-text-disabled"
          >
            Order notes
          </label>
          <Textarea
            id="staff-order-notes"
            value={orderNotes}
            onChange={(event) => onOrderNotesChange(event.target.value)}
            placeholder="Optional notes for kitchen or service…"
            rows={2}
            className="resize-none border-dash-surface-overlay bg-dash-bg text-dash-text"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-dash-text-secondary">Total</span>
          <span className="text-lg font-bold text-dash-text">
            {formatPrice(orderTotal, currency)}
          </span>
        </div>

        <Button
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
          className="h-12 w-full bg-dash-accent-hover text-sm font-semibold text-white hover:bg-dash-accent-hover disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Placing order…
            </>
          ) : (
            `Place Order — ${formatPrice(orderTotal, currency)}`
          )}
        </Button>

        {!acceptingOrders && (
          <p className="text-center text-xs text-amber-400">
            Orders are paused for this location.
          </p>
        )}
      </div>
    </div>
  );
}

function StaffOrderEntrySkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-11 w-full max-w-xs" />
      <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
        <div className="space-y-4">
          <Skeleton className="h-11 w-full" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-20 rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[4/3] rounded-xl" />
            ))}
          </div>
        </div>
        <Skeleton className="hidden h-[520px] rounded-2xl lg:block" />
      </div>
    </div>
  );
}
