import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";
import {
  dayLabel,
  type VenueRhythmAdminSnapshot,
} from "@/lib/admin/load-venue-rhythm-admin";

function trendLabel(trend: "up" | "flat" | "down"): string {
  if (trend === "up") return "↑ rast";
  if (trend === "down") return "↓ pad";
  return "→ stabilno";
}

function heatLevel(sampleSessions: number): string {
  if (sampleSessions >= 12) return "bg-orange-500/80";
  if (sampleSessions >= 6) return "bg-orange-500/50";
  if (sampleSessions >= 2) return "bg-orange-500/25";
  if (sampleSessions >= 1) return "bg-orange-500/10";
  return "bg-muted/40";
}

export function DenisVenueRhythmPanel({
  snapshot,
}: {
  snapshot: VenueRhythmAdminSnapshot | null;
}) {
  if (!snapshot) {
    return (
      <QrCard>
        <QrCardTitle>Venue rhythm</QrCardTitle>
        <QrCardDescription>
          Nema podataka — pokreni migracije 00122–00123 i sačekaj zatvorene sesije.
        </QrCardDescription>
      </QrCard>
    );
  }

  const hours = Array.from({ length: 24 }, (_, hour) => hour);
  const days = [1, 2, 3, 4, 5, 6, 0];

  const cellMap = new Map(
    snapshot.heatmap.map((cell) => [`${cell.dayOfWeek}:${cell.hour}`, cell])
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <DenisMarkBadge size="md" className="mt-0.5 bg-dash-accent-muted ring-dash-border" />
        <div>
          <h2 className="text-lg font-semibold">Venue rhythm</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ADR-042 VRP — slot heatmap, RevPASH i comparative (admin only).
            {snapshot.priorsUpdatedAt
              ? ` Ažurirano: ${snapshot.priorsUpdatedAt.slice(0, 10)}.`
              : null}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Slotova učeno" value={String(snapshot.slotCount)} />
        <Metric label="Ukupno mesta" value={String(snapshot.totalSeats)} />
        <Metric
          label="Rhythm config"
          value={snapshot.rhythmEnabled ? "enabled" : "off"}
        />
        {snapshot.comparative ? (
          <Metric
            label="Sesije (7d)"
            value={`${snapshot.comparative.recentSessions} (${trendLabel(snapshot.comparative.trend)})`}
            accent
          />
        ) : (
          <Metric label="Sesije (7d)" value="—" />
        )}
      </div>

      {snapshot.comparative && snapshot.comparative.vsBaselinePct != null ? (
        <p className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm">
          Poslednjih 7 dana: {snapshot.comparative.recentSessions} sesija,{" "}
          {snapshot.comparative.recentRevenue.toFixed(0)} € prihod.
          Baseline: ~{snapshot.comparative.baselineSessionsPerDay} sesija/dan
          ({snapshot.comparative.vsBaselinePct >= 0 ? "+" : ""}
          {snapshot.comparative.vsBaselinePct}% vs 8-ned. prosek).
        </p>
      ) : null}

      <QrCard className="p-0 overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <QrCardTitle className="text-base">Heatmap (dan × sat)</QrCardTitle>
          <QrCardDescription className="mt-1">
            Intenzitet = broj učenih sesija po slotu. Hover za detalje u tabeli ispod.
          </QrCardDescription>
        </div>
        <div className="overflow-x-auto p-4">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[3rem_repeat(24,minmax(1.25rem,1fr))] gap-0.5 text-[10px] text-muted-foreground">
              <div />
              {hours.map((hour) => (
                <div key={hour} className="text-center tabular-nums">
                  {hour}
                </div>
              ))}
              {days.map((dow) => (
                <div key={`row-${dow}`} className="contents">
                  <div className="flex items-center font-medium text-foreground">
                    {dayLabel(dow)}
                  </div>
                  {hours.map((hour) => {
                    const cell = cellMap.get(`${dow}:${hour}`);
                    const sessions = cell?.sampleSessions ?? 0;
                    return (
                      <div
                        key={`${dow}-${hour}`}
                        className={`aspect-square rounded-sm ${heatLevel(sessions)}`}
                        title={
                          cell
                            ? `${dayLabel(dow)} ${hour}:00 — ${sessions} sesija`
                            : `${dayLabel(dow)} ${hour}:00 — nema podataka`
                        }
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </QrCard>

      <QrCard className="p-0 overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <QrCardTitle className="text-base">Top slotovi (RevPASH)</QrCardTitle>
        </div>
        {snapshot.topSlots.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Premalo zatvorenih sesija — heatmap se puni posle commerce.session.completed.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Slot</th>
                  <th className="px-4 py-3">Sesije</th>
                  <th className="px-4 py-3">Desert +min</th>
                  <th className="px-4 py-3">RevPASH</th>
                  <th className="px-4 py-3">Top proizvod</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.topSlots.map((cell) => (
                  <tr key={cell.slotKey} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">
                      {dayLabel(cell.dayOfWeek)} {cell.hour}:00
                    </td>
                    <td className="px-4 py-3 tabular-nums">{cell.sampleSessions}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {cell.dessertDelayP50Min != null
                        ? `${Math.round(cell.dessertDelayP50Min)} min`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-blue-700">
                      {cell.revpash != null ? `${cell.revpash.toFixed(0)} €` : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {cell.topProductName ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QrCard>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <QrCard className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          accent ? "text-blue-700" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </QrCard>
  );
}
