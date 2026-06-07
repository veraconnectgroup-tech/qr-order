import type { NudgePerformanceSnapshot } from "@/lib/admin/load-nudge-performance";

export type WeeklyNudgeDigest = {
  subject: string;
  text: string;
  html: string;
};

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function kindLabel(kind: string): string {
  return kind.replace(/_/g, " ");
}

/** Template digest for owner email (ADR-039 L4). */
export function buildWeeklyNudgeDigest(
  snapshot: NudgePerformanceSnapshot
): WeeklyNudgeDigest {
  const top = snapshot.topProducts[0];
  const topLine = top
    ? `Najuspešniji predlog: ${top.productName} (${pct(top.acceptRate)} accept, ${top.accepts}/${top.impressions}).`
    : "Još nema dovoljno podataka po proizvodu.";

  const text = [
    `Denis — nedeljni izveštaj (${snapshot.locationName})`,
    `Period: ${snapshot.fromDate} → ${snapshot.toDate}`,
    "",
    `Prikazano: ${snapshot.nudgeImpressions} nudge-ova`,
    `Prihvaćeno: ${snapshot.offerConversions} (${pct(snapshot.conversionRate)})`,
    `Odbijeno: ${snapshot.nudgeDeclined} · Ignorisano: ${snapshot.nudgeIgnored} · Isteklo: ${snapshot.nudgeExpired}`,
    "",
    topLine,
    snapshot.suggestedAction ? `Preporuka: ${snapshot.suggestedAction}` : "",
    "",
    "Detalji: Admin → Denis Insights",
  ]
    .filter(Boolean)
    .join("\n");

  const kindRows = Object.entries(snapshot.byNudgeKind)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(
      ([kind, count]) =>
        `<li><strong>${kindLabel(kind)}</strong>: ${count} događaja</li>`
    )
    .join("");

  const productRows = snapshot.topProducts
    .slice(0, 5)
    .map(
      (row) =>
        `<tr><td style="padding:6px 8px;border-top:1px solid #eee;">${row.productName}</td><td style="padding:6px 8px;border-top:1px solid #eee;text-align:right;">${pct(row.acceptRate)}</td><td style="padding:6px 8px;border-top:1px solid #eee;text-align:right;">${row.accepts}/${row.impressions}</td></tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Inter,Segoe UI,sans-serif;color:#111;max-width:560px;">
      <h2 style="margin:0 0 8px;">Denis — nedeljni nudge izveštaj</h2>
      <p style="margin:0 0 16px;color:#555;">${snapshot.locationName} · ${snapshot.fromDate} → ${snapshot.toDate}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <tr><td style="padding:8px;background:#f8fafc;">Prikazano</td><td style="padding:8px;background:#f8fafc;text-align:right;"><strong>${snapshot.nudgeImpressions}</strong></td></tr>
        <tr><td style="padding:8px;">Prihvaćeno</td><td style="padding:8px;text-align:right;"><strong>${snapshot.offerConversions}</strong> (${pct(snapshot.conversionRate)})</td></tr>
        <tr><td style="padding:8px;background:#f8fafc;">Odbijeno / Ignor / Isteklo</td><td style="padding:8px;background:#f8fafc;text-align:right;">${snapshot.nudgeDeclined} / ${snapshot.nudgeIgnored} / ${snapshot.nudgeExpired}</td></tr>
      </table>
      ${kindRows ? `<p style="margin:0 0 8px;font-weight:600;">Po tipu nudge-a</p><ul style="margin:0 0 16px;padding-left:18px;">${kindRows}</ul>` : ""}
      ${productRows ? `<p style="margin:0 0 8px;font-weight:600;">Top proizvodi</p><table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:14px;"><thead><tr><th style="text-align:left;padding:6px 8px;">Proizvod</th><th style="text-align:right;padding:6px 8px;">Accept</th><th style="text-align:right;padding:6px 8px;">Stats</th></tr></thead><tbody>${productRows}</tbody></table>` : ""}
      ${snapshot.suggestedAction ? `<p style="margin:0;padding:12px;background:#fff7ed;border-radius:8px;"><strong>Preporuka:</strong> ${snapshot.suggestedAction}</p>` : ""}
      <p style="margin:16px 0 0;color:#777;font-size:12px;">Admin → Denis Insights</p>
    </div>
  `;

  return {
    subject: `Denis nudge izveštaj — ${snapshot.locationName} (${pct(snapshot.conversionRate)} accept)`,
    text,
    html,
  };
}
