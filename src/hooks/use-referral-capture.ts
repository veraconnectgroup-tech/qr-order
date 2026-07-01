"use client";

import { useEffect, useState } from "react";
import { getOrCreateDeviceFingerprint } from "@/lib/guest/device-storage";

const REF_REGISTERED_KEY = "guest_referral_registered";

function sessionKey(locationId: string, code: string): string {
  return `${REF_REGISTERED_KEY}:${locationId}:${code.toUpperCase()}`;
}

export function useReferralCapture(input: {
  locationId: string;
  guestToken: string;
  enabled?: boolean;
}) {
  const [socialProof, setSocialProof] = useState<string | null>(null);
  const [welcomeDiscountPercent, setWelcomeDiscountPercent] = useState(0);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (!input.enabled || !input.locationId || !input.guestToken) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const refCode = params.get("ref")?.trim();
    if (!refCode) return;

    const storageKey = sessionKey(input.locationId, refCode);
    if (window.sessionStorage.getItem(storageKey)) {
      setRegistered(true);
      return;
    }

    let cancelled = false;

    async function capture() {
      const deviceFingerprint = getOrCreateDeviceFingerprint();

      try {
        const res = await fetch("/api/commerce/referral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "register",
            locationId: input.locationId,
            referralCode: refCode,
            referredGuestToken: input.guestToken,
            referredDeviceFingerprint: deviceFingerprint,
          }),
        });

        const json = (await res.json()) as {
          ok?: boolean;
          data?: { welcomeDiscountPercent?: number };
        };

        if (!cancelled && json.ok) {
          window.sessionStorage.setItem(storageKey, "1");
          setRegistered(true);
          if (json.data?.welcomeDiscountPercent) {
            setWelcomeDiscountPercent(json.data.welcomeDiscountPercent);
          }
        }
      } catch {
        /* silent degrade */
      }

      try {
        const proofParams = new URLSearchParams();
        proofParams.set("locationId", input.locationId);
        proofParams.set("guestToken", input.guestToken);
        if (refCode) proofParams.set("ref", refCode);
        const proofRes = await fetch(
          `/api/commerce/referral?${proofParams.toString()}`
        );
        const proofJson = (await proofRes.json()) as {
          ok?: boolean;
          data?: { socialProof?: string | null };
        };
        if (!cancelled && proofJson.ok && proofJson.data?.socialProof) {
          setSocialProof(proofJson.data.socialProof);
        }
      } catch {
        /* silent degrade */
      }
    }

    void capture();
    return () => {
      cancelled = true;
    };
  }, [input.enabled, input.locationId, input.guestToken]);

  return { socialProof, welcomeDiscountPercent, registered };
}
