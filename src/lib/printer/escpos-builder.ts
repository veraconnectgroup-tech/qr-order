export type PaperWidth = 58 | 80;

export type TextAlign = "left" | "center" | "right";

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export function paperLineWidth(paperWidth: PaperWidth): number {
  return paperWidth === 58 ? 32 : 48;
}

export function separatorLine(
  paperWidth: PaperWidth,
  char = "-"
): string {
  return char.repeat(paperLineWidth(paperWidth));
}

export class EscPosBuilder {
  private chunks: Uint8Array[] = [];

  private pushBytes(...bytes: number[]) {
    this.chunks.push(Uint8Array.from(bytes));
  }

  private pushText(str: string) {
    this.chunks.push(new TextEncoder().encode(str));
  }

  initialize() {
    this.pushBytes(ESC, 0x40);
    return this;
  }

  textSize(width: number, height: number) {
    const w = Math.min(8, Math.max(1, Math.round(width)));
    const h = Math.min(8, Math.max(1, Math.round(height)));
    const n = (w - 1) * 16 + (h - 1);
    this.pushBytes(GS, 0x21, n);
    return this;
  }

  bold(on: boolean) {
    this.pushBytes(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  align(alignment: TextAlign) {
    const n = alignment === "center" ? 1 : alignment === "right" ? 2 : 0;
    this.pushBytes(ESC, 0x61, n);
    return this;
  }

  text(str: string) {
    this.pushText(str);
    return this;
  }

  newline(count = 1) {
    for (let i = 0; i < count; i++) {
      this.pushBytes(LF);
    }
    return this;
  }

  separator(char = "-", paperWidth: PaperWidth = 80) {
    this.text(separatorLine(paperWidth, char));
    this.newline();
    return this;
  }

  cut() {
    this.pushBytes(GS, 0x56, 0x42, 0x03);
    return this;
  }

  /** ESC/POS QR Code (model 2) — TSE verification on receipt printers. */
  qrCode(data: string, moduleSize = 6) {
    const payload = new TextEncoder().encode(data);
    const size = Math.min(16, Math.max(1, moduleSize));

    this.pushBytes(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    this.pushBytes(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size);

    const storeLen = payload.length + 3;
    this.pushBytes(
      GS,
      0x28,
      0x6b,
      storeLen % 256,
      Math.floor(storeLen / 256),
      0x31,
      0x50,
      0x30
    );
    this.chunks.push(payload);
    this.pushBytes(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    this.newline();
    return this;
  }

  openCashDrawer() {
    this.pushBytes(ESC, 0x70, 0x00, 0x19, 0xfa);
    return this;
  }

  build(): Uint8Array {
    const total = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

export function formatAlignedLine(
  left: string,
  right: string,
  paperWidth: PaperWidth
): string {
  const width = paperLineWidth(paperWidth);
  const space = width - left.length - right.length;
  if (space >= 1) {
    return `${left}${" ".repeat(space)}${right}`;
  }
  return `${left} ${right}`.slice(0, width);
}

export function wrapText(text: string, paperWidth: PaperWidth): string[] {
  const width = paperLineWidth(paperWidth);
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word.length > width ? word.slice(0, width) : word;
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}
