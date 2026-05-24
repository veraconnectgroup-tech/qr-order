export function normalizePrinterMac(mac: string): string {
  const compact = mac.trim().toUpperCase().replace(/[^0-9A-F]/g, "");
  if (compact.length !== 12) {
    return mac.trim().toUpperCase();
  }
  return compact.match(/.{1,2}/g)!.join(":");
}

export function encodePrintPayload(data: Uint8Array): string {
  return `\\x${Buffer.from(data).toString("hex")}`;
}

export function decodePrintPayload(raw: string): Uint8Array {
  if (raw.startsWith("\\x")) {
    return Uint8Array.from(Buffer.from(raw.slice(2), "hex"));
  }
  if (raw.startsWith("\\\\x")) {
    return Uint8Array.from(Buffer.from(raw.slice(3), "hex"));
  }
  return Uint8Array.from(Buffer.from(raw, "base64"));
}
