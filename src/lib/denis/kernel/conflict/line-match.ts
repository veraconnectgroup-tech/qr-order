import type { DenisCartLine } from "@/lib/denis/kernel/cart-projection";

export function lineFingerprint(line: DenisCartLine): string {
  const mods = [...line.modifierIds].sort().join(",");
  const notes = line.notes.trim().toLowerCase();
  return `${line.productId}|${line.serveSize ?? ""}|${mods}|${notes}`;
}

export function unitPrice(line: DenisCartLine): number {
  if (line.quantity <= 0) return line.lineTotal;
  return Number((line.lineTotal / line.quantity).toFixed(2));
}

export function linesEqual(a: DenisCartLine, b: DenisCartLine): boolean {
  return (
    lineFingerprint(a) === lineFingerprint(b) &&
    a.quantity === b.quantity &&
    unitPrice(a) === unitPrice(b)
  );
}

export function cloneLine(line: DenisCartLine): DenisCartLine {
  return { ...line, modifierIds: [...line.modifierIds] };
}
