"use client";

import { QrMark } from "@/lib/pwa/qr-mark";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-950 px-6 text-center">
      <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-orange-500">
        <QrMark scale={1.1} />
      </div>
      <p className="text-sm font-medium uppercase tracking-widest text-orange-500">
        QR Order
      </p>
      <h1 className="mt-3 text-2xl font-semibold text-zinc-50">
        You&apos;re offline
      </h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-400">
        Please check your connection.
      </p>
      <Button
        className="mt-8 bg-orange-500 hover:bg-orange-600"
        onClick={() => window.location.reload()}
      >
        Try again
      </Button>
    </div>
  );
}
