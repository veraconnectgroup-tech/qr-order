"use client";

import { useState, useTransition } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { guestTableUrl } from "@/lib/app-url";
import { buildQrPrintPdf } from "@/lib/qr/qr-print-pdf";
import { toast } from "sonner";

type TableRow = { id: string; name: string; qr_token: string };

export function QrPrintSheet({
  orgSlug,
  venueName,
  brandColor,
  tables,
  appUrl,
}: {
  orgSlug: string;
  venueName: string;
  brandColor: string;
  tables: TableRow[];
  appUrl: string;
}) {
  const [pending, startTransition] = useTransition();
  const [lastPdfUrl, setLastPdfUrl] = useState<string | null>(null);

  function downloadPdf() {
    if (!tables.length) {
      toast.error("Create tables first.");
      return;
    }

    startTransition(async () => {
      try {
        const cards = tables.map((table) => ({
          tableName: table.name,
          venueName,
          scanUrl: guestTableUrl(orgSlug, table.qr_token, appUrl),
          brandColor,
        }));
        const pdfBuffer = await buildQrPrintPdf(cards);
        const blob = new Blob([new Uint8Array(pdfBuffer)], {
          type: "application/pdf",
        });
        const url = URL.createObjectURL(blob);
        if (lastPdfUrl) URL.revokeObjectURL(lastPdfUrl);
        setLastPdfUrl(url);

        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${venueName.replace(/\s+/g, "-").toLowerCase()}-qr-cards.pdf`;
        anchor.click();
        toast.success("QR print PDF downloaded (6 cards per A4 page).");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not generate PDF."
        );
      }
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-dash-border bg-dash-surface/60 p-4">
      <p className="text-sm text-dash-text-muted">
        Branded QR codes with your accent color — A4 sheet with 6 table cards per
        page, ready to print.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={downloadPdf}
          disabled={pending || !tables.length}
          className="bg-dash-accent hover:bg-dash-accent-hover"
        >
          <Download className="me-2 size-4" />
          {pending ? "Generating…" : "Download PDF"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!lastPdfUrl}
          onClick={() => {
            if (!lastPdfUrl) return;
            window.open(lastPdfUrl, "_blank");
          }}
          className="border-dash-surface-overlay"
        >
          <Printer className="me-2 size-4" />
          Preview PDF
        </Button>
      </div>
      <p className="text-xs text-dash-text-disabled">
        {tables.length} table{tables.length === 1 ? "" : "s"} · brand{" "}
        {brandColor}
      </p>
    </div>
  );
}
