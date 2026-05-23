"use client";

import { sendToLan } from "@/lib/printer/drivers/lan-driver";
import { sendToUsb } from "@/lib/printer/drivers/usb-driver";
import type { PrinterConfig } from "@/lib/printer/types";

export type PrintResult = {
  ok: boolean;
  error?: string;
};

async function dispatchPrint(
  data: Uint8Array,
  config: PrinterConfig
): Promise<void> {
  if (config.type === "usb") {
    await sendToUsb(data, config.id);
    return;
  }

  if (!config.ip_address) {
    throw new Error("LAN printer IP address is not configured.");
  }

  await sendToLan(data, config);
}

export async function printTicket(
  data: Uint8Array,
  config: PrinterConfig
): Promise<PrintResult> {
  try {
    await dispatchPrint(data, config);
    return { ok: true };
  } catch (firstError) {
    try {
      await dispatchPrint(data, config);
      return { ok: true };
    } catch (retryError) {
      const message =
        retryError instanceof Error
          ? retryError.message
          : firstError instanceof Error
            ? firstError.message
            : "Print failed.";
      return { ok: false, error: message };
    }
  }
}
