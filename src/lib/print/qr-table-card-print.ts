import QRCode from "qrcode";
import { generateBrandedQrDataUrl } from "@/lib/qr/branded-qr";
import { DEFAULT_THEME } from "@/lib/theme/types";
import { normalizeHexColor } from "@/lib/theme/color-utils";

export type QrTableCardLocale = "de" | "en";

export type QrTableCardItem = {
  tableName: string;
  zoneName?: string | null;
  scanUrl: string;
  qrDataUrl: string;
};

export type QrBrandingOptions = {
  brandColor?: string;
  logoUrl?: string | null;
  displayName?: string;
  productSubline?: string;
};

const COPY = {
  de: {
    sheetTitle: (venue: string) => `${venue} — Tischbestellung`,
    action: "Scannen zum Bestellen & Bezahlen",
    zoneFallback: "Ohne Bereich",
    subline: `${DEFAULT_THEME.displayName} · ${DEFAULT_THEME.productSubline}`,
  },
  en: {
    sheetTitle: (venue: string) => `${venue} — Table ordering`,
    action: "Scan to order & pay",
    zoneFallback: "Unassigned",
    subline: `${DEFAULT_THEME.displayName} · ${DEFAULT_THEME.productSubline}`,
  },
} as const;

export function formatBrandSubline(
  displayName = DEFAULT_THEME.displayName,
  productSubline = DEFAULT_THEME.productSubline
): string {
  return `${displayName} · ${productSubline}`;
}

export function resolveQrTableCardLocale(
  menuLocale?: string | null
): QrTableCardLocale {
  return menuLocale === "en" ? "en" : "de";
}

export function getQrTableCardCopy(locale: QrTableCardLocale = "de") {
  return COPY[locale];
}

export function denisTableMarkPrintSvg(brandColor = DEFAULT_THEME.primaryColor): string {
  const stroke = escapeHtml(normalizeHexColor(brandColor));
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="6" y1="4" x2="6" y2="20" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/><line x1="6" y1="4" x2="16" y2="4" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="4" x2="16" y2="13" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/></svg>`;
}

/** @deprecated Use denisTableMarkPrintSvg(brandColor) */
export const DENIS_TABLE_MARK_PRINT_SVG = denisTableMarkPrintSvg();

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatTableLabel(
  tableName: string,
  zoneName: string | null | undefined,
  locale: QrTableCardLocale = "de"
): string {
  const zone = zoneName?.trim() || COPY[locale].zoneFallback;
  return `${tableName} · ${zone}`;
}

export async function generateTableQrDataUrl(
  scanUrl: string,
  width = 200,
  branding?: Pick<QrBrandingOptions, "brandColor" | "logoUrl">
): Promise<string> {
  const brandColor = branding?.brandColor
    ? normalizeHexColor(branding.brandColor)
    : undefined;

  if (typeof document !== "undefined" && (brandColor || branding?.logoUrl)) {
    return generateBrandedQrDataUrl({
      scanUrl,
      brandColor,
      logoDataUrl: branding?.logoUrl ?? null,
      width,
    });
  }

  return QRCode.toDataURL(scanUrl, {
    width,
    margin: 2,
    color: { dark: brandColor ?? "#000000", light: "#ffffff" },
    errorCorrectionLevel: "H",
  });
}

export async function prepareQrTableCardItems(
  entries: Array<{
    tableName: string;
    zoneName?: string | null;
    scanUrl: string;
  }>,
  qrWidth = 200,
  branding?: Pick<QrBrandingOptions, "brandColor" | "logoUrl">
): Promise<QrTableCardItem[]> {
  return Promise.all(
    entries.map(async (entry) => ({
      tableName: entry.tableName,
      zoneName: entry.zoneName,
      scanUrl: entry.scanUrl,
      qrDataUrl: await generateTableQrDataUrl(entry.scanUrl, qrWidth, branding),
    }))
  );
}

function renderQrTableCard(
  item: QrTableCardItem,
  venueName: string,
  locale: QrTableCardLocale,
  subline: string,
  brandColor: string
) {
  const copy = COPY[locale];
  const venue = escapeHtml(venueName);
  const tableLabel = escapeHtml(
    formatTableLabel(item.tableName, item.zoneName, locale)
  );
  const tableName = escapeHtml(item.tableName);

  return `<article class="card">
  <p class="venue">${venue}</p>
  <p class="table-label">${tableLabel}</p>
  <img src="${item.qrDataUrl}" alt="QR code for ${tableName}" width="160" height="160" />
  <p class="action">${escapeHtml(copy.action)}</p>
  <p class="subline">${denisTableMarkPrintSvg(brandColor)}<span>${escapeHtml(subline)}</span></p>
</article>`;
}

export function buildQrTableCardPrintHtml(options: {
  venueName: string;
  items: QrTableCardItem[];
  locale?: QrTableCardLocale;
  autoPrint?: boolean;
  brandColor?: string;
  brandSubline?: string;
}): string {
  const locale = options.locale ?? "de";
  const copy = COPY[locale];
  const brandColor = normalizeHexColor(
    options.brandColor,
    DEFAULT_THEME.primaryColor
  );
  const subline = options.brandSubline ?? copy.subline;
  const title = escapeHtml(copy.sheetTitle(options.venueName));
  const cards = options.items
    .map((item) =>
      renderQrTableCard(item, options.venueName, locale, subline, brandColor)
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px;
    font-family: Inter, system-ui, sans-serif;
    color: #0a0a0a;
    background: #ffffff;
  }
  .sheet-title {
    margin: 0 0 24px;
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 24px;
  }
  .card {
    position: relative;
    page-break-inside: avoid;
    overflow: hidden;
    border: 1px solid #e4e4e7;
    border-radius: 12px;
    padding: 20px 16px 16px;
    text-align: center;
    background: #ffffff;
  }
  .card::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    background: ${brandColor};
  }
  .venue {
    margin: 0 0 4px;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }
  .table-label {
    margin: 0 0 16px;
    font-size: 13px;
    color: #52525b;
  }
  .card img {
    display: block;
    width: 160px;
    height: 160px;
    margin: 0 auto;
  }
  .action {
    margin: 14px 0 0;
    font-size: 12px;
    font-weight: 500;
    color: #0a0a0a;
  }
  .subline {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin: 8px 0 0;
    font-size: 9px;
    color: #71717a;
  }
  @media print {
    body { padding: 12mm; }
    .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12mm; }
  }
</style>
</head>
<body>
  <h1 class="sheet-title">${title}</h1>
  <div class="grid">
${cards}
  </div>
  ${options.autoPrint ? "<script>window.onload = () => window.print();</script>" : ""}
</body>
</html>`;
}

export function openQrTableCardPrintWindow(html: string): Window | null {
  const win = window.open("", "_blank");
  if (!win) return null;
  win.document.write(html);
  win.document.close();
  return win;
}
