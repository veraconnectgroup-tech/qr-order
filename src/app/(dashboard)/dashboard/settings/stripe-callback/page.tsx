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
    <div className="flex min-h-screen flex-col items-center justify-center bg-dash-bg px-4 text-center">
      {status === "loading" && (
        <>
          <Loader2 className="size-10 animate-spin text-dash-accent" />
          <p className="mt-4 text-sm text-dash-text-muted">Verifying Stripe account…</p>
        </>
      )}
      {status === "done" && (
        <>
          <CheckCircle2 className="size-12 text-green-400" />
          <p className="mt-4 text-xl font-semibold text-dash-text">
            {onboarded ? "Successfully connected!" : "Stripe setup saved"}
          </p>
          <p className="mt-2 max-w-sm text-sm text-dash-text-muted">
            {onboarded
              ? "Card payments are active. Payouts go to your bank account."
              : "Finish any remaining steps in Stripe when you're ready."}
          </p>
          <p className="mt-6 text-xs text-dash-text-disabled">Closing window…</p>
        </>
      )}
      {status === "error" && (
        <>
          <XCircle className="size-12 text-red-400" />
          <p className="mt-4 text-lg font-semibold text-dash-text">
            Connection failed
          </p>
          <p className="mt-2 text-sm text-dash-text-muted">
            Close this window and try again.
          </p>
        </>
      )}
    </div>
  );
}

export default function StripeCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-dash-bg">
          <Loader2 className="size-10 animate-spin text-dash-accent" />
        </div>
      }
    >
      <StripeCallbackContent />
    </Suspense>
  );
}
