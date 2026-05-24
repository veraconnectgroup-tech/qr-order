"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function truncateTssId(id: string) {
  return id.length <= 12 ? id : `${id.slice(0, 8)}…`;
}

function SummaryRow({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-2 text-sm text-dash-text-secondary">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
      ) : (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
      )}
      <span>
        <span className="font-medium text-dash-text">{label}:</span> {detail}
      </span>
    </li>
  );
}

export function OnboardingFiscalStep({
  tssId,
  steuernummer,
  ustIdNr,
  onChange,
}: {
  tssId: string | null;
  steuernummer: string;
  ustIdNr: string;
  onChange: (patch: { steuernummer?: string; ustIdNr?: string }) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-dash-border bg-dash-surface/60 p-4">
        <p className="text-sm font-medium text-dash-text-secondary">TSE-Status</p>
        {tssId ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              TSE aktiv
            </span>
            <span className="font-mono text-xs text-dash-text-muted">
              {truncateTssId(tssId)}
            </span>
          </div>
        ) : (
          <div className="mt-3 space-y-1">
            <span className="inline-block rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
              TSE wird eingerichtet…
            </span>
            <p className="text-xs text-dash-text-disabled">Automatische Einrichtung läuft</p>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="steuernummer">Steuernummer</Label>
        <Input
          id="steuernummer"
          value={steuernummer}
          onChange={(e) => onChange({ steuernummer: e.target.value })}
          placeholder="22/123/45678"
          className="mt-1.5 border-dash-surface-overlay bg-dash-surface"
        />
        <p className="mt-1.5 text-xs text-dash-text-disabled">Pflichtangabe für Kassenbons</p>
      </div>

      <div>
        <Label htmlFor="ustIdNr">USt-IdNr (optional)</Label>
        <Input
          id="ustIdNr"
          value={ustIdNr}
          onChange={(e) => onChange({ ustIdNr: e.target.value })}
          placeholder="DE123456789"
          className="mt-1.5 border-dash-surface-overlay bg-dash-surface"
        />
      </div>

      <div className="rounded-xl border border-dash-border bg-dash-surface/40 p-4 text-sm text-dash-text-muted">
        Diese Angaben erscheinen auf jedem gesetzlichen Beleg (§14 UStG).
      </div>
    </div>
  );
}

export function OnboardingGoLiveStep({
  venueName,
  venueAddress,
  venueCity,
  productCount,
  categoryCount,
  tableCount,
  stripeOnboarded,
  tssId,
  steuernummer,
}: {
  venueName: string;
  venueAddress: string;
  venueCity: string;
  productCount: number;
  categoryCount: number;
  tableCount: number;
  stripeOnboarded: boolean;
  tssId: string | null;
  steuernummer: string;
}) {
  const venueOk = Boolean(venueName.trim() && venueAddress.trim());

  return (
    <div className="space-y-5">
      <p className="text-sm text-dash-text-muted">
        Prüfen Sie Ihre Einstellungen, bevor Sie live gehen.
      </p>
      <ul className="space-y-3 rounded-xl border border-dash-border bg-dash-surface/60 p-4">
        <SummaryRow
          ok={venueOk}
          label="Venue"
          detail={
            venueOk
              ? `${venueName}${venueCity ? `, ${venueCity}` : ""}`
              : "Name oder Adresse fehlt"
          }
        />
        <SummaryRow
          ok={productCount > 0}
          label="Menu"
          detail={`${productCount} Produkte in ${categoryCount} Kategorien`}
        />
        <SummaryRow
          ok={tableCount > 0}
          label="Tables"
          detail={`${tableCount} Tische mit QR-Codes`}
        />
        <SummaryRow
          ok={stripeOnboarded}
          label="Payment"
          detail={
            stripeOnboarded
              ? "Stripe verbunden"
              : "Zahlung an der Bar (Stripe nicht verbunden)"
          }
        />
        <SummaryRow
          ok={Boolean(tssId && steuernummer.trim())}
          label="Fiscal"
          detail={[
            tssId ? "TSE aktiv" : "TSE wird eingerichtet",
            steuernummer.trim()
              ? `Steuernummer ${steuernummer.trim()}`
              : "Steuernummer fehlt",
          ].join(" · ")}
        />
      </ul>
      {!steuernummer.trim() && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>Ohne Steuernummer sind Kassenbons nicht gesetzeskonform.</p>
        </div>
      )}
    </div>
  );
}
