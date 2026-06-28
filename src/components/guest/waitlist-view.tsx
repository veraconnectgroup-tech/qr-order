"use client";

import { readApiErrorMessage } from "@/lib/api-error-client";
import { useCallback, useEffect, useState } from "react";
import { Users, Clock, UtensilsCrossed, BellRing } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { GuestHeader } from "@/components/guest/guest-header";
import { OfflineIndicator } from "@/components/guest/offline-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildWaitlistBrowseHint } from "@/lib/denis/commerce/waitlist";
import { getOrCreateDeviceFingerprint } from "@/lib/guest/device-storage";
import { useOnlineStatus } from "@/hooks/use-online-status";
import Link from "next/link";

type Props = {
  slug: string;
  locationId: string;
  orgName: string;
  locationName: string;
  logoUrl?: string | null;
  menuBrowseUrl: string;
};

type WaitlistEntryState = {
  id: string;
  guestName: string;
  partySize: number;
  estimatedWaitMinutes: number;
  status: string;
  position: number;
  message: string;
  proactiveMessage?: string | null;
  notifyMessage?: string | null;
};

export function WaitlistView({
  slug: _slug,
  locationId,
  orgName,
  locationName,
  logoUrl,
  menuBrowseUrl,
}: Props) {
  const { tUI, menuLocale, isEnglish } = useAppLocale();
  const language = isEnglish ? "en" : menuLocale;
  const isOnline = useOnlineStatus();
  const [guestName, setGuestName] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<WaitlistEntryState | null>(null);

  const fingerprint = getOrCreateDeviceFingerprint();

  const refreshStatus = useCallback(async () => {
    if (!joined) return;
    try {
      const params = new URLSearchParams({
        locationId,
        entryId: joined.id,
        deviceFingerprint: fingerprint,
        language,
      });
      const res = await fetch(`/api/commerce/waitlist?${params.toString()}`);
      const json = (await res.json()) as {
        data?: {
          entry: WaitlistEntryState;
          position: number;
          estimatedWaitMinutes: number;
          proactiveMessage?: string | null;
          notifyMessage?: string | null;
        };
      };
      if (!res.ok || !json.data) return;

      setJoined((prev) =>
        prev
          ? {
              ...prev,
              ...json.data!.entry,
              position: json.data!.position,
              estimatedWaitMinutes: json.data!.estimatedWaitMinutes,
              proactiveMessage: json.data!.proactiveMessage,
              notifyMessage: json.data!.notifyMessage,
            }
          : prev
      );
    } catch {
      /* offline poll — keep last state */
    }
  }, [joined, locationId, fingerprint, language]);

  useEffect(() => {
    if (!joined) return;
    const timer = window.setInterval(() => void refreshStatus(), 15_000);
    return () => window.clearInterval(timer);
  }, [joined, refreshStatus]);

  const joinWaitlist = useCallback(async () => {
    if (!guestName.trim() || !isOnline) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/commerce/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          guestName: guestName.trim(),
          partySize,
          deviceFingerprint: fingerprint,
          language,
        }),
      });
      const json = (await res.json()) as {
        data?: {
          entry: {
            id: string;
            guestName: string;
            partySize: number;
            estimatedWaitMinutes: number;
            status: string;
          };
          position: number;
          message: string;
        };
        error?: string;
      };
      if (!res.ok) {
        setError(readApiErrorMessage(json, res.status, "Could not join waitlist."));
        return;
      }
      if (json.data) {
        setJoined({
          ...json.data.entry,
          position: json.data.position,
          message: json.data.message,
        });
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [guestName, isOnline, locationId, partySize, fingerprint, language]);

  const cancelWaitlist = useCallback(async () => {
    if (!joined) return;
    await fetch("/api/commerce/waitlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId,
        entryId: joined.id,
        deviceFingerprint: fingerprint,
      }),
    });
    setJoined(null);
  }, [joined, locationId, fingerprint]);

  return (
    <div className="guest-theme min-h-dvh bg-zinc-950 text-zinc-100">
      <OfflineIndicator />
      <GuestHeader
        orgName={orgName}
        subtitle={locationName}
        logoUrl={logoUrl ?? null}
        tableName={tUI("waitlist.title")}
      />

      <main className="mx-auto max-w-md px-4 py-8">
        {!joined ? (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-semibold">{tUI("waitlist.heading")}</h1>
              <p className="mt-2 text-sm text-zinc-400">{tUI("waitlist.subtitle")}</p>
            </div>

            <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
              <div>
                <Label htmlFor="waitlist-name">{tUI("waitlist.nameLabel")}</Label>
                <Input
                  id="waitlist-name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="mt-1.5 border-zinc-700 bg-zinc-950"
                  placeholder={tUI("waitlist.namePlaceholder")}
                  maxLength={80}
                />
              </div>

              <div>
                <Label htmlFor="waitlist-size">{tUI("waitlist.partySize")}</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPartySize(size)}
                      className={`min-h-12 min-w-12 rounded-xl border px-3 text-sm font-medium transition-colors ${
                        partySize === size
                          ? "border-orange-500 bg-orange-500/15 text-orange-400"
                          : "border-zinc-700 text-zinc-300"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {error ? (
                <p className="text-sm text-red-400">{error}</p>
              ) : null}

              <Button
                type="button"
                className="h-12 w-full bg-orange-500 text-base hover:bg-orange-600"
                disabled={!guestName.trim() || loading || !isOnline}
                onClick={() => void joinWaitlist()}
              >
                {loading ? tUI("waitlist.joining") : tUI("waitlist.join")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
            {joined.status === "notified" && joined.notifyMessage ? (
              <div className="flex gap-3 rounded-xl border border-orange-500/40 bg-orange-500/10 p-4">
                <BellRing className="mt-0.5 size-5 shrink-0 text-orange-400" />
                <p className="text-base leading-relaxed text-orange-100">
                  {joined.notifyMessage}
                </p>
              </div>
            ) : (
              <p className="text-base leading-relaxed text-zinc-200">{joined.message}</p>
            )}

            {joined.proactiveMessage ? (
              <p className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm leading-relaxed text-zinc-300">
                {joined.proactiveMessage}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <Stat icon={Users} label={tUI("waitlist.position")} value={`#${joined.position}`} />
              <Stat
                icon={Clock}
                label={tUI("waitlist.estimatedWait")}
                value={`~${joined.estimatedWaitMinutes} min`}
              />
              <Stat icon={Users} label={tUI("waitlist.partySize")} value={String(joined.partySize)} />
            </div>

            <p className="text-sm text-zinc-400">{buildWaitlistBrowseHint(language)}</p>

            <Link
              href={menuBrowseUrl}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-zinc-700 text-sm font-medium text-zinc-200"
            >
              <UtensilsCrossed className="h-4 w-4" />
              {tUI("waitlist.browseMenu")}
            </Link>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-zinc-400"
              onClick={() => void cancelWaitlist()}
            >
              {tUI("waitlist.cancel")}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-orange-400" />
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
      <p className="text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
