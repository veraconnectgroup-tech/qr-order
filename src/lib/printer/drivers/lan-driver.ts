"use client";

import type { PrinterConfig } from "@/lib/printer/types";

function bytesToBase64(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export async function sendToLan(
  data: Uint8Array,
  config: Pick<PrinterConfig, "ip_address" | "port">
): Promise<void> {
  if (!config.ip_address) {
    throw new Error("LAN printer IP address is not configured.");
  }

  const res = await fetch("/api/printer/print", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ip: config.ip_address,
      port: config.port,
      data: bytesToBase64(data),
    }),
  });

  const json = (await res.json()) as { ok?: boolean; error?: string };

  if (!res.ok || !json.ok) {
    throw new Error(json.error ?? "LAN print failed.");
  }
}
