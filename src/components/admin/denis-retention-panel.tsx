"use client";

import { useTransition } from "react";
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";
import { Button } from "@/components/ui/button";
import type { RetentionInsight } from "@/lib/denis/retention/retention-intelligence";
import { formatRetentionDigestLines } from "@/lib/denis/retention/retention-intelligence";
import { CHURN_RISK_DAYS } from "@/lib/denis/retention/guest-engagement-loop";

type Props = {
  locationId: string;
  insight: RetentionInsight;
};

export function DenisRetentionPanel({ locationId, insight }: Props) {
  const [pending, startTransition] = useTransition();
  const lines = formatRetentionDigestLines(insight);

  function runSendTick() {
    startTransition(async () => {
      await fetch("/api/engagement/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, limit: 50 }),
      });
    });
  }

  return (
    <div className="space-y-6">
      <QrCard>
        <QrCardTitle>Guest retention loop</QrCardTitle>
        <QrCardDescription>
          Win-back, birthday, weekly specials, loyalty milestones — max 2 poruke
          mesečno po gostu (GDPR consent obavezan).
        </QrCardDescription>

        <ul className="mt-4 space-y-2 text-sm">
          {lines.map((line) => (
            <li key={line} className="text-muted-foreground">
              {line}
            </li>
          ))}
        </ul>

        {insight.churnRiskVipCount > 0 ? (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Churn risk: {insight.churnRiskVipCount} VIP gostiju nisu bili{" "}
            {CHURN_RISK_DAYS}+ dana — proverite ličnu poruku ili poseban offer.
          </p>
        ) : null}

        <Button
          type="button"
          className="mt-4"
          disabled={pending}
          onClick={runSendTick}
        >
          {pending ? "Šaljem…" : "Pokreni engagement tick"}
        </Button>
      </QrCard>

      <QrCard>
        <QrCardTitle>Pravila</QrCardTitle>
        <QrCardDescription>Denis vraća goste između poseta.</QrCardDescription>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Win-back: 30+ dana + 3+ posete — omiljena stavka</li>
          <li>Rođendan: desert na naš račun</li>
          <li>Weekly special: nova stavka u omiljenoj kategoriji</li>
          <li>Loyalty: 5 / 10 / 20 poseta</li>
          <li>Same-again chips u chatu: &quot;Da, isto&quot; / &quot;Nešto drugo&quot;</li>
        </ul>
      </QrCard>
    </div>
  );
}
