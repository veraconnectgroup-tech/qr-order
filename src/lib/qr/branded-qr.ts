import QRCode from "qrcode";

export type BrandedQrOptions = {
  scanUrl: string;
  brandColor?: string;
  logoDataUrl?: string | null;
  width?: number;
};

function normalizeHexColor(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "#f97316";
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
  return "#f97316";
}

export async function generateBrandedQrDataUrl(
  options: BrandedQrOptions
): Promise<string> {
  const width = options.width ?? 280;
  const brandColor = normalizeHexColor(options.brandColor);

  const qrDataUrl = await QRCode.toDataURL(options.scanUrl, {
    width,
    margin: 2,
    color: { dark: brandColor, light: "#ffffff" },
    errorCorrectionLevel: "H",
  });

  if (!options.logoDataUrl || typeof document === "undefined") {
    return qrDataUrl;
  }

  return compositeLogoOnQr(qrDataUrl, options.logoDataUrl, width);
}

export async function compositeLogoOnQr(
  qrDataUrl: string,
  logoDataUrl: string,
  width: number
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = width;
  const ctx = canvas.getContext("2d");
  if (!ctx) return qrDataUrl;

  const qrImage = await loadImage(qrDataUrl);
  ctx.drawImage(qrImage, 0, 0, width, width);

  const logoSize = Math.round(width * 0.22);
  const logoX = (width - logoSize) / 2;
  const logoY = (width - logoSize) / 2;

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(width / 2, width / 2, logoSize / 2 + 4, 0, Math.PI * 2);
  ctx.fill();

  const logoImage = await loadImage(logoDataUrl);
  ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);

  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image."));
    image.src = src;
  });
}

export function decodeDataUrl(dataUrl: string): { mime: string; bytes: Buffer } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URL.");
  return {
    mime: match[1]!,
    bytes: Buffer.from(match[2]!, "base64"),
  };
}

export function normalizeHexColorForPdf(value: string | undefined): string {
  return normalizeHexColor(value);
}
