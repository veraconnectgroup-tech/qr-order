import {
  EscPosBuilder,
  type PaperWidth,
  separatorLine,
} from "@/lib/printer/escpos-builder";

export function buildTestTicketEscPos(
  printerName: string,
  paperWidth: PaperWidth = 80
): Uint8Array {
  const now = new Date().toLocaleString("de-DE");

  return new EscPosBuilder()
    .initialize()
    .align("center")
    .bold(true)
    .textSize(2, 2)
    .text("TEST PRINT")
    .newline()
    .bold(false)
    .textSize(1, 1)
    .text(printerName)
    .newline()
    .text(now)
    .newline()
    .text(separatorLine(paperWidth))
    .newline()
    .align("left")
    .text("QR Order printer OK")
    .newline(2)
    .cut()
    .build();
}
