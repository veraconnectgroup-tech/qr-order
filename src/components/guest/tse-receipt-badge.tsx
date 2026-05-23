"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ShieldCheck } from "lucide-react";

type TseData = {
  tss_serial?: string;
  signature_counter?: number;
  signature?: string;
  start_time?: number;
  end_time?: number;
  qr_code_data?: string;
};

export function TseReceiptBadge({
  tseSignature,
  tseData,
}: {
  tseSignature: string | null;
  tseData: TseData | null;
}) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const qrPayload = tseData?.qr_code_data?.trim() || null;

  useEffect(() => {
    if (!qrPayload) {
      setQrUrl(null);
      return;
    }

    let cancelled = false;
    QRCode.toDataURL(qrPayload, { width: 160, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [qrPayload]);

  if (!tseSignature) return null;

  const counter = tseData?.signature_counter;
  const tssSerial = tseData?.tss_serial;

  return (
    <div className="mt-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-green-300">
        <ShieldCheck className="size-4 shrink-0" />
        TSE signiert (KassenSichV)
      </div>

      {(tssSerial || counter != null) && (
        <p className="mt-1 text-xs text-green-200/80">
          {tssSerial && <>TSS {tssSerial.slice(0, 12)}…</>}
          {tssSerial && counter != null && " · "}
          {counter != null && <>Signatur #{counter}</>}
        </p>
      )}

      {qrUrl && (
        <div className="mt-3 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt="TSE QR code for KassenSichV receipt"
            className="rounded-md bg-white p-2"
            width={160}
            height={160}
          />
          <p className="text-center text-[10px] leading-relaxed text-zinc-500">
            QR-Code enthält alle TSE-Pflichtangaben für Finanzamt-Prüfungen
          </p>
        </div>
      )}
    </div>
  );
}
