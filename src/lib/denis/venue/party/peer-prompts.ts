import type { DenisCartLine } from "@/lib/denis/kernel/cart-projection";

function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} i ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} i ${names[names.length - 1]}`;
}

/** Guest prompt when another device at the table added items (M12). */
export function buildPeerAddedPrompt(lines: DenisCartLine[]): string | null {
  if (lines.length === 0) return null;

  const names = [...new Set(lines.map((line) => line.productName.trim()).filter(Boolean))];
  if (names.length === 0) return null;

  return `Tvoj drug je dodao ${joinNames(names)} — da uključim u narudžbinu?`;
}
