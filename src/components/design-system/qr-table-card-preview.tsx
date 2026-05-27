import {
  formatTableLabel,
  getQrTableCardCopy,
  resolveQrTableCardLocale,
} from "@/lib/print/qr-table-card-print";
import { cn } from "@/lib/utils";

export function QrTableCardPreview({
  venueName,
  tableName,
  zoneName,
  qrDataUrl,
  locale,
  className,
}: {
  venueName: string;
  tableName: string;
  zoneName?: string | null;
  qrDataUrl?: string | null;
  locale?: string | null;
  className?: string;
}) {
  const cardLocale = resolveQrTableCardLocale(locale);
  const copy = getQrTableCardCopy(cardLocale);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-white px-4 pb-4 pt-5 text-center text-[#0a0a0a]",
        className
      )}
    >
      <span
        className="absolute inset-x-0 top-0 h-[3px] bg-[var(--qr-ember,#f97316)]"
        aria-hidden
      />
      <p className="text-lg font-semibold tracking-[-0.02em]">{venueName}</p>
      <p className="mt-1 text-sm text-[#52525b]">
        {formatTableLabel(tableName, zoneName, cardLocale)}
      </p>
      {qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrDataUrl}
          alt={`QR code for ${tableName}`}
          className="mx-auto mt-4 size-40 rounded-sm bg-white"
          width={160}
          height={160}
        />
      ) : (
        <div className="mx-auto mt-4 size-40 animate-pulse rounded-sm bg-neutral-100" />
      )}
      <p className="mt-3 text-xs font-medium">{copy.action}</p>
      <p className="mt-1 text-[11px] text-[#71717a]">{copy.subline}</p>
    </div>
  );
}
