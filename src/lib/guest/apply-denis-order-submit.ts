"use client";

import type { AllergenId } from "@/lib/allergens";
import type { CartItem } from "@/hooks/use-cart";
import {
  checkAllergyConflict,
  type AllergyGuardProduct,
} from "@/lib/denis/kernel/safety/allergy-guard";
import {
  getOrCreateDeviceFingerprint,
  setStoredDeviceToken,
} from "@/lib/guest/device-storage";
import { syncTableSessionStores } from "@/lib/guest/ensure-table-session";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";

export type DenisOrderSubmitPayload = {
  orderId: string;
  orderNumber: number;
  awaitingApproval?: boolean;
  sessionOpened?: {
    sessionId: string;
    sessionToken: string;
    deviceToken: string;
    tablePin?: string;
  };
};

export type DenisOrderSubmitValidation = {
  ok: boolean;
  warnings: string[];
  blockers: string[];
};

function buildAllergySubmitWarning(input: {
  productName: string;
  allergen: string;
  language: string;
}): string {
  const lang = input.language.slice(0, 2);
  if (lang === "de") {
    return `⚠️ Wir haben eine Allergie gegen ${input.allergen} notiert. ${input.productName} enthält ${input.allergen}.`;
  }
  if (lang === "en") {
    return `⚠️ We noted an allergy to ${input.allergen}. ${input.productName} contains ${input.allergen}.`;
  }
  return `⚠️ Primetili smo da imate alergiju na ${input.allergen}. ${input.productName} sadrži ${input.allergen}.`;
}

function buildUnavailableBlocker(productName: string, language: string): string {
  const lang = language.slice(0, 2);
  if (lang === "de") {
    return `${productName} ist gerade nicht verfügbar.`;
  }
  if (lang === "en") {
    return `${productName} is not available right now.`;
  }
  return `${productName} trenutno nije dostupan.`;
}

/** Denis pre-submit gate — allergy WARN + availability BLOCK before kitchen. */
export function validateDenisOrderSubmit(input: {
  cartItems: CartItem[];
  knownAllergens: AllergenId[];
  products: Map<string, AllergyGuardProduct> | Record<string, AllergyGuardProduct>;
  unavailableProductIds?: ReadonlySet<string>;
  language?: string;
}): DenisOrderSubmitValidation {
  const language = input.language ?? "sr";
  const warnings: string[] = [];
  const blockers: string[] = [];

  const unavailable = input.unavailableProductIds ?? new Set<string>();
  for (const line of input.cartItems) {
    if (unavailable.has(line.productId)) {
      blockers.push(buildUnavailableBlocker(line.productName, language));
    }
  }

  const allergy = checkAllergyConflict({
    cartItems: input.cartItems.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      serveSize: item.serveSize ?? null,
      modifierIds: item.modifiers.map((modifier) => modifier.modifierId),
      notes: item.notes,
      lineTotal: item.itemTotal,
      menuSection: item.menuSection ?? null,
      productTaxRate: item.productTaxRate ?? null,
    })),
    knownAllergens: input.knownAllergens,
    products: input.products,
    language,
  });

  if (!allergy.safe && allergy.conflicts[0]) {
    const primary = allergy.conflicts[0];
    warnings.push(
      buildAllergySubmitWarning({
        productName: primary.productName,
        allergen: primary.allergen,
        language,
      })
    );
  }

  return {
    ok: blockers.length === 0,
    warnings,
    blockers,
  };
}

export function applyDenisOrderSessionOpened(input: {
  slug: string;
  tableToken: string;
  locationId: string;
  tableId: string;
  tableName: string;
  sessionOpened: NonNullable<DenisOrderSubmitPayload["sessionOpened"]>;
}) {
  setStoredDeviceToken(
    input.locationId,
    input.tableId,
    input.sessionOpened.deviceToken
  );
  syncTableSessionStores(
    input.slug,
    input.tableToken,
    {
      sessionId: input.sessionOpened.sessionId,
      sessionToken: input.sessionOpened.sessionToken,
      tableId: input.tableId,
      tableName: input.tableName,
      locationId: input.locationId,
    },
    input.tableId
  );
}

export function pollDenisApprovalPin(input: {
  orderId: string;
  tableToken: string;
  slug: string;
  locationId: string;
  tableId: string;
  tableName: string;
  onPin: (tablePin: string) => void;
  onRejected?: (reason: string | null) => void;
}): () => void {
  let cancelled = false;
  let pollIntervalId: ReturnType<typeof setInterval> | undefined;
  const fingerprint = getOrCreateDeviceFingerprint();

  function stopPolling() {
    if (pollIntervalId !== undefined) {
      clearInterval(pollIntervalId);
      pollIntervalId = undefined;
    }
  }

  async function poll() {
    if (cancelled) return;

    const params = new URLSearchParams({
      tableToken: input.tableToken,
      deviceFingerprint: fingerprint,
    });

    const res = await fetch(
      `/api/orders/${input.orderId}/approval-status?${params}`
    );
    if (!res.ok || cancelled) return;

    const json = (await res.json()) as {
      data?: {
        status: string;
        rejectionReason?: string | null;
        sessionToken?: string;
        sessionId?: string;
        deviceToken?: string;
        tablePin?: string | null;
      };
    };

    const data = json.data;
    if (!data) return;

    if (data.status === "rejected") {
      stopPolling();
      input.onRejected?.(data.rejectionReason ?? null);
      return;
    }

    if (data.status === "approved" && data.sessionToken && data.sessionId) {
      if (data.deviceToken) {
        setStoredDeviceToken(input.locationId, input.tableId, data.deviceToken);
      }
      syncTableSessionStores(
        input.slug,
        input.tableToken,
        {
          sessionId: data.sessionId,
          sessionToken: data.sessionToken,
          tableId: input.tableId,
          tableName: input.tableName,
          locationId: input.locationId,
        },
        input.tableId
      );
      if (data.tablePin) {
        stopPolling();
        input.onPin(data.tablePin);
      }
    }
  }

  void poll();
  pollIntervalId = setInterval(poll, REALTIME_FALLBACK_POLL_MS);

  return () => {
    cancelled = true;
    stopPolling();
  };
}
