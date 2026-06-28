import QRCode from "qrcode";
import { normalizeHexColorForPdf } from "@/lib/qr/branded-qr";

export type QrPrintCardInput = {
  tableName: string;
  venueName: string;
  scanUrl: string;
  brandColor?: string;
};

export type QrPrintLayout = {
  cardsPerPage: number;
  columns: number;
  rows: number;
};

export const A4_QR_PRINT_LAYOUT: QrPrintLayout = {
  cardsPerPage: 6,
  columns: 2,
  rows: 3,
};

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 36;

function pdfEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdfStream(content: string): string {
  return `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}endstream`;
}

function chunkCards<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages.length ? pages : [[]];
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = normalizeHexColorForPdf(hex).slice(1);
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

async function buildQrRgbSamples(
  scanUrl: string,
  brandColor: string | undefined,
  moduleSize: number
): Promise<{ size: number; rgb: Buffer }> {
  const qr = QRCode.create(scanUrl, { errorCorrectionLevel: "H" });
  const modules = qr.modules;
  const count = modules.size;
  const border = 2;
  const totalModules = count + border * 2;
  const pixelSize = totalModules * moduleSize;
  const [r, g, b] = hexToRgb(brandColor ?? "#f97316");
  const rgb = Buffer.alloc(pixelSize * pixelSize * 3, 255);

  for (let y = 0; y < pixelSize; y += 1) {
    for (let x = 0; x < pixelSize; x += 1) {
      const moduleX = Math.floor(x / moduleSize) - border;
      const moduleY = Math.floor(y / moduleSize) - border;
      const dark =
        moduleX >= 0 &&
        moduleY >= 0 &&
        moduleX < count &&
        moduleY < count &&
        modules.get(moduleX, moduleY);
      const offset = (y * pixelSize + x) * 3;
      if (dark) {
        rgb[offset] = r;
        rgb[offset + 1] = g;
        rgb[offset + 2] = b;
      }
    }
  }

  return { size: pixelSize, rgb };
}

function buildRgbImageObject(id: number, size: number, rgb: Buffer): string {
  return `${id} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${size} /Height ${size} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${rgb.length} >>\nstream\n${rgb.toString("binary")}\nendstream\nendobj\n`;
}

export async function buildQrPrintPdf(
  cards: QrPrintCardInput[],
  layout: QrPrintLayout = A4_QR_PRINT_LAYOUT
): Promise<Buffer> {
  const cardWidth =
    (A4_WIDTH - PAGE_MARGIN * 2 - (layout.columns - 1) * 12) / layout.columns;
  const cardHeight =
    (A4_HEIGHT - PAGE_MARGIN * 2 - (layout.rows - 1) * 12) / layout.rows;
  const qrDisplaySize = Math.min(cardWidth - 24, cardHeight - 56, 180);
  const moduleSize = 4;
  const images = await Promise.all(
    cards.map((card) => buildQrRgbSamples(card.scanUrl, card.brandColor, moduleSize))
  );

  const pages = chunkCards(cards, layout.cardsPerPage);
  const bodyObjects: Array<{ id: number; body: string }> = [];
  let nextId = 1;

  const fontId = nextId++;
  bodyObjects.push({
    id: fontId,
    body: `${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
  });

  const imageIds = images.map(() => nextId++);
  images.forEach((image, index) => {
    bodyObjects.push({
      id: imageIds[index]!,
      body: buildRgbImageObject(imageIds[index]!, image.size, image.rgb),
    });
  });

  const pageEntries: Array<{
    pageId: number;
    contentId: number;
    content: string;
    xObjectRefs: string;
  }> = [];

  for (const pageCards of pages) {
    const pageId = nextId++;
    const contentId = nextId++;

    let yCursor = A4_HEIGHT - PAGE_MARGIN - cardHeight;
    let xCursor = PAGE_MARGIN;
    let col = 0;
    const contentParts: string[] = [];
    const usedImages = new Set<number>();

    pageCards.forEach((card) => {
      const globalIndex = cards.indexOf(card);
      const imageId = imageIds[globalIndex]!;
      const image = images[globalIndex]!;
      usedImages.add(imageId);

      const qrX = xCursor + (cardWidth - qrDisplaySize) / 2;
      const qrY = yCursor + 28;

      contentParts.push(
        "q",
        `${qrDisplaySize} 0 0 ${qrDisplaySize} ${qrX.toFixed(2)} ${qrY.toFixed(2)} cm`,
        `/Im${imageId} Do`,
        "Q",
        "BT",
        `/F1 10 Tf`,
        `1 0 0 1 ${(xCursor + 8).toFixed(2)} ${(yCursor + cardHeight - 12).toFixed(2)} Tm`,
        `(${pdfEscape(card.venueName.slice(0, 40))}) Tj`,
        `/F1 12 Tf`,
        `1 0 0 1 ${(xCursor + 8).toFixed(2)} ${(yCursor + 8).toFixed(2)} Tm`,
        `(${pdfEscape(card.tableName.slice(0, 40))}) Tj`,
        "ET"
      );

      col += 1;
      if (col >= layout.columns) {
        col = 0;
        xCursor = PAGE_MARGIN;
        yCursor -= cardHeight + 12;
      } else {
        xCursor += cardWidth + 12;
      }

      void image;
    });

    const xObjectRefs = [...usedImages]
      .sort((a, b) => a - b)
      .map((id) => `/Im${id} ${id} 0 R`)
      .join(" ");

    pageEntries.push({
      pageId,
      contentId,
      content: contentParts.join("\n"),
      xObjectRefs,
    });
  }

  pageEntries.forEach((entry) => {
    bodyObjects.push({
      id: entry.contentId,
      body: `${entry.contentId} 0 obj\n${buildPdfStream(entry.content)}\nendobj\n`,
    });
    bodyObjects.push({
      id: entry.pageId,
      body: `${entry.pageId} 0 obj\n<< /Type /Page /Parent ${nextId} 0 R /MediaBox [0 0 ${A4_WIDTH} ${A4_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R >> /XObject << ${entry.xObjectRefs} >> >> /Contents ${entry.contentId} 0 R >>\nendobj\n`,
    });
  });

  const pagesObjId = nextId++;
  const catalogObjId = nextId++;

  bodyObjects.push({
    id: pagesObjId,
    body: `${pagesObjId} 0 obj\n<< /Type /Pages /Kids [${pageEntries.map((e) => `${e.pageId} 0 R`).join(" ")}] /Count ${pageEntries.length} >>\nendobj\n`,
  });
  bodyObjects.push({
    id: catalogObjId,
    body: `${catalogObjId} 0 obj\n<< /Type /Catalog /Pages ${pagesObjId} 0 R >>\nendobj\n`,
  });

  bodyObjects.sort((a, b) => a.id - b.id);

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (const obj of bodyObjects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj.body;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${bodyObjects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= bodyObjects.length; i += 1) {
    pdf += `${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${bodyObjects.length + 1} /Root ${catalogObjId} 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

export function isValidPdfBuffer(buffer: Buffer): boolean {
  const header = buffer.subarray(0, 5).toString("utf8");
  const tail = buffer.subarray(Math.max(0, buffer.length - 64)).toString("utf8");
  return header.startsWith("%PDF-") && tail.includes("%%EOF");
}

export function countPdfPages(buffer: Buffer): number {
  const text = buffer.toString("latin1");
  const match = text.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/);
  return match ? Number(match[1]) : 0;
}

export async function buildBrandedQrPngBuffer(
  scanUrl: string,
  brandColor?: string,
  moduleSize = 4
): Promise<Buffer> {
  const { rgb, size } = await buildQrRgbSamples(scanUrl, brandColor, moduleSize);
  void size;
  return rgb;
}
