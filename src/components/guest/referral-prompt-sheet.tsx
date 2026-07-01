"use client";

import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { ReferralShare } from "@/components/guest/referral-share";
import { buildDenisReferralPrompt } from "@/lib/denis/commerce/loyalty/referral-system";
import { useAppLocale } from "@/components/guest/app-locale-provider";

const PROMPT_AT_KEY = "denis_referral_prompt_at";
const DISMISS_AT_KEY = "denis_referral_dismiss_at";
const COOLDOWN_DAYS = 14;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  return (Date.now() - parsed) / 86_400_000;
}

function localBlocksPrompt(): boolean {
  const sincePrompt = daysSince(
    typeof window !== "undefined"
      ? window.localStorage.getItem(PROMPT_AT_KEY)
      : null
  );
  if (sincePrompt != null && sincePrompt < COOLDOWN_DAYS) return true;

  const sinceDismiss = daysSince(
    typeof window !== "undefined"
      ? window.localStorage.getItem(DISMISS_AT_KEY)
      : null
  );
  if (sinceDismiss != null && sinceDismiss < COOLDOWN_DAYS) return true;

  return false;
}

export function ReferralPromptSheet({
  locationId,
  guestToken,
  slug,
  tableToken,
  venueName,
  orgId,
  trigger = false,
}: {
  locationId: string;
  guestToken: string;
  slug: string;
  tableToken: string;
  venueName: string;
  orgId?: string;
  trigger?: boolean;
}) {
  const { menuLocale, isEnglish } = useAppLocale();
  const language = isEnglish ? "en" : menuLocale;
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!trigger || localBlocksPrompt()) return;
    setVisible(true);
    window.localStorage.setItem(PROMPT_AT_KEY, new Date().toISOString());
  }, [trigger]);

  if (!visible) return null;

  const message = buildDenisReferralPrompt(language);

  function dismiss() {
    window.localStorage.setItem(DISMISS_AT_KEY, new Date().toISOString());
    setVisible(false);
    setExpanded(false);
  }

  if (!expanded) {
    return (
      <section className="mb-5 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-5">
        <div className="flex items-start gap-3">
          <Share2 className="mt-0.5 size-5 shrink-0 text-orange-400" />
          <div className="flex-1">
            <p className="text-base font-medium text-zinc-100">{message}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="h-11 flex-1 rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Podeli link
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="h-11 rounded-xl px-4 text-sm text-zinc-400 hover:text-zinc-200"
              >
                Ne sada
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="mb-5">
      <ReferralShare
        locationId={locationId}
        guestToken={guestToken}
        slug={slug}
        tableToken={tableToken}
        venueName={venueName}
        orgId={orgId}
        open
        onOpenChange={(open) => {
          if (!open) dismiss();
        }}
      />
    </div>
  );
}
