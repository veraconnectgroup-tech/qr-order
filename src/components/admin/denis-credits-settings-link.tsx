import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";
import { formatPrice } from "@/lib/format";

export function DenisCreditsSettingsLink({
  balance,
  lifetimeUsed,
  currency,
  lowBalance,
}: {
  balance: number;
  lifetimeUsed: number;
  currency: string;
  lowBalance: boolean;
}) {
  return (
    <QrCard variant="muted" padding="md">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--qr-ember-muted)] ring-1 ring-[var(--qr-ember)]/20">
            <Sparkles className="size-5 text-[var(--qr-ember)]" />
          </span>
          <div>
            <QrCardTitle className="text-base">Denis AI credits</QrCardTitle>
            <QrCardDescription>
              1 credit per AI-assisted guest message. Menu browse without AI is
              free. Purchase packs on the Billing page.
            </QrCardDescription>
            <div className="mt-4 flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Balance
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
                  {balance.toLocaleString("en-GB")}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Used (lifetime)
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-muted-foreground">
                  {lifetimeUsed.toLocaleString("en-GB")}
                </p>
              </div>
            </div>
            {lowBalance && (
              <p className="mt-3 text-xs font-medium text-amber-200">
                Low balance — top up before guest AI is interrupted.
              </p>
            )}
          </div>
        </div>

        <Link
          href="/dashboard/billing"
          className="group inline-flex items-center gap-2 rounded-lg bg-[var(--qr-ember)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--qr-ember-hover)]"
        >
          Buy credits
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </Link>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Starter packs from{" "}
        {formatPrice(19, currency, "en-GB")} · managed under Billing, not here.
      </p>
    </QrCard>
  );
}
