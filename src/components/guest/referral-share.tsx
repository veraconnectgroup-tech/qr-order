"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Copy, MessageCircle, Share2 } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { Button } from "@/components/ui/button";
import {
  buildReferralShareMessage,
  REFERRAL_BONUS_POINTS,
} from "@/lib/denis/commerce/loyalty/referral-system";
import { hapticClick } from "@/lib/haptics";

type ReferralInfo = {
  referralCode: string;
  shareUrl: string | null;
  referralCount: number;
  maxReferrals: number;
  bonusPoints: number;
};

type Props = {
  locationId: string;
  guestToken: string;
  slug: string;
  tableToken: string;
  venueName: string;
  orgId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  compact?: boolean;
};

export function ReferralShare({
  locationId,
  guestToken,
  slug,
  tableToken,
  venueName,
  orgId,
  open = true,
  onOpenChange,
  compact = false,
}: Props) {
  const { menuLocale, isEnglish } = useAppLocale();
  const language = isEnglish ? "en" : menuLocale;
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const baseUrl = useMemo(
    () => (typeof window !== "undefined" ? window.location.origin : ""),
    []
  );

  useEffect(() => {
    if (!open || !locationId || !guestToken) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          locationId,
          guestToken,
          slug,
          tableToken,
          baseUrl,
        });
        if (orgId) params.set("orgId", orgId);

        const res = await fetch(`/api/commerce/referral?${params.toString()}`);
        const json = (await res.json()) as {
          ok?: boolean;
          data?: ReferralInfo;
        };
        if (!cancelled && json.ok && json.data) {
          setInfo(json.data);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, locationId, guestToken, slug, tableToken, baseUrl, orgId]);

  useEffect(() => {
    const url = info?.shareUrl;
    if (!url) {
      setQrUrl(null);
      return;
    }

    let cancelled = false;
    QRCode.toDataURL(url, { width: 180, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setQrUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [info?.shareUrl]);

  const shareMessage = useMemo(() => {
    if (!info?.shareUrl) return "";
    return buildReferralShareMessage({
      venueName,
      shareUrl: info.shareUrl,
      bonusPoints: info.bonusPoints ?? REFERRAL_BONUS_POINTS,
      language,
    });
  }, [info, venueName, language]);

  const handleCopy = useCallback(async () => {
    if (!info?.shareUrl) return;
    hapticClick();
    try {
      await navigator.clipboard.writeText(shareMessage || info.shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [info, shareMessage]);

  const handleWhatsApp = useCallback(() => {
    if (!shareMessage) return;
    hapticClick();
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareMessage)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, [shareMessage]);

  const handleSms = useCallback(() => {
    if (!shareMessage) return;
    hapticClick();
    window.location.href = `sms:?body=${encodeURIComponent(shareMessage)}`;
  }, [shareMessage]);

  if (!open) return null;

  if (loading && !info) {
    return (
      <div className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/80 p-5">
        <div className="mx-auto h-4 w-48 rounded bg-zinc-800" />
        <div className="mx-auto mt-4 size-[180px] rounded bg-zinc-800" />
      </div>
    );
  }

  if (!info) return null;

  const atCap = info.referralCount >= info.maxReferrals;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleWhatsApp}
          disabled={!info.shareUrl || atCap}
          className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100"
        >
          <MessageCircle className="me-1.5 size-4" />
          WhatsApp
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          disabled={!info.shareUrl || atCap}
          className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100"
        >
          <Copy className="me-1.5 size-4" />
          {copied ? "Kopirano!" : "Kopiraj"}
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-zinc-100">
            Podelite sa prijateljima
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Oboje dobijate {info.bonusPoints} bonus poena!
            {info.referralCount > 0
              ? ` (${info.referralCount}/${info.maxReferrals} poziva)`
              : null}
          </p>
        </div>
        <Share2 className="size-5 shrink-0 text-orange-400" aria-hidden />
      </div>

      {atCap ? (
        <p className="text-sm text-amber-400">
          Dostigli ste maksimum od {info.maxReferrals} poziva.
        </p>
      ) : null}

      {qrUrl ? (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt="Referral QR kod"
            width={180}
            height={180}
            className="rounded-lg bg-white p-2"
          />
        </div>
      ) : null}

      <p className="text-center font-mono text-sm tracking-wider text-orange-400">
        {info.referralCode}
      </p>

      <div className="grid grid-cols-3 gap-2">
        <Button
          type="button"
          onClick={handleWhatsApp}
          disabled={!info.shareUrl || atCap}
          className="h-12 rounded-xl bg-[#25D366] text-sm font-semibold text-white hover:bg-[#20bd5a]"
        >
          WhatsApp
        </Button>
        <Button
          type="button"
          onClick={handleSms}
          disabled={!info.shareUrl || atCap}
          className="h-12 rounded-xl bg-zinc-800 text-sm font-semibold text-zinc-100 hover:bg-zinc-700"
        >
          SMS
        </Button>
        <Button
          type="button"
          onClick={handleCopy}
          disabled={!info.shareUrl || atCap}
          className="h-12 rounded-xl bg-orange-500 text-sm font-semibold text-white hover:bg-orange-600"
        >
          {copied ? "Kopirano!" : "Kopiraj"}
        </Button>
      </div>

      {onOpenChange ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          className="h-10 w-full text-zinc-400"
        >
          Zatvori
        </Button>
      ) : null}
    </section>
  );
}
