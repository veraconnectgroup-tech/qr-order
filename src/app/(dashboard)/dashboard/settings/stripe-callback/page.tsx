"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

function StripeCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    const stripeParam = searchParams.get("stripe") ?? "complete";

    async function finish() {
      try {
        const res = await fetch("/api/stripe/connect");
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? "Stripe sync failed");
        }

        const isOnboarded = Boolean(json.data?.onboarded);
        setOnboarded(isOnboarded);
        setStatus("done");

        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            {
              type: "STRIPE_CONNECT_DONE",
              onboarded: isOnboarded,
              stripe: stripeParam,
            },
            window.location.origin
          );
          window.setTimeout(() => window.close(), 1500);
          return;
        }

        router.replace(
          `/dashboard/settings?stripe=${stripeParam === "refresh" ? "refresh" : "complete"}`
        );
      } catch {
        setStatus("error");
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            { type: "STRIPE_CONNECT_ERROR" },
            window.location.origin
          );
          window.setTimeout(() => window.close(), 2000);
        } else {
          router.replace("/dashboard/settings");
        }
      }
    }

    finish();
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center">
      {status === "loading" && (
        <>
          <Loader2 className="size-10 animate-spin text-orange-500" />
          <p className="mt-4 text-sm text-zinc-400">Proveravamo Stripe nalog…</p>
        </>
      )}
      {status === "done" && (
        <>
          <CheckCircle2 className="size-12 text-green-400" />
          <p className="mt-4 text-xl font-semibold text-zinc-50">
            {onboarded ? "Uspešno ste se povezali!" : "Stripe setup sačuvan"}
          </p>
          <p className="mt-2 max-w-sm text-sm text-zinc-400">
            {onboarded
              ? "Kartična plaćanja su aktivna. Novac ide na vaš bankovni račun."
              : "Završite preostale korake u Stripe-u kada budete spremni."}
          </p>
          <p className="mt-6 text-xs text-zinc-600">Prozor se zatvara…</p>
        </>
      )}
      {status === "error" && (
        <>
          <XCircle className="size-12 text-red-400" />
          <p className="mt-4 text-lg font-semibold text-zinc-50">
            Povezivanje nije uspelo
          </p>
          <p className="mt-2 text-sm text-zinc-400">Zatvorite prozor i pokušajte ponovo.</p>
        </>
      )}
    </div>
  );
}

export default function StripeCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950">
          <Loader2 className="size-10 animate-spin text-orange-500" />
        </div>
      }
    >
      <StripeCallbackContent />
    </Suspense>
  );
}
