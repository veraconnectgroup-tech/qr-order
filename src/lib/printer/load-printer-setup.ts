"use client";

import type { PrinterSetup } from "@/lib/printer/types";

let cachedSetup: PrinterSetup | null = null;
let loadingPromise: Promise<PrinterSetup> | null = null;

const EMPTY_SETUP: PrinterSetup = {
  configs: [],
  productTargets: {},
  location: {
    address: null,
    city: null,
    in_person_payment_location: "bar",
  },
};

export function invalidatePrinterSetup() {
  cachedSetup = null;
  loadingPromise = null;
}

export async function loadPrinterSetup(force = false): Promise<PrinterSetup> {
  if (!force && cachedSetup) return cachedSetup;
  if (!force && loadingPromise) return loadingPromise;

  loadingPromise = fetch("/api/printer/configs")
    .then(async (res) => {
      const json = (await res.json()) as {
        data?: PrinterSetup;
        error?: string;
      };

      if (!res.ok || !json.data) {
        throw new Error(json.error ?? "Failed to load printer settings.");
      }

      cachedSetup = json.data;
      return json.data;
    })
    .catch(() => {
      cachedSetup = EMPTY_SETUP;
      return EMPTY_SETUP;
    })
    .finally(() => {
      loadingPromise = null;
    });

  return loadingPromise;
}

export function getCachedPrinterSetup() {
  return cachedSetup;
}
