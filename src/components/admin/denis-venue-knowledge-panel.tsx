import type { VenueKnowledgeSnapshot } from "@/lib/denis/platform/venue-knowledge-types";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";

export type VenueKnowledgeAdminSnapshot = {
  locationId: string;
  updatedAt: string | null;
  knowledge: VenueKnowledgeSnapshot | null;
};

function retentionLabel(tier: VenueKnowledgeSnapshot["retentionTier"]): string {
  if (tier === "full") return "90d full detail";
  if (tier === "aggregated") return "90–180d aggregated";
  return ">180d trend only";
}

export function DenisVenueKnowledgePanel({
  snapshot,
}: {
  snapshot: VenueKnowledgeAdminSnapshot | null;
}) {
  if (!snapshot?.knowledge) {
    return (
      <QrCard>
        <QrCardTitle>Venue knowledge</QrCardTitle>
        <QrCardDescription>
          Nema akumuliranog znanja — potrebne su isporučene narudžbine i rhythm
          rollup.
        </QrCardDescription>
      </QrCard>
    );
  }

  const knowledge = snapshot.knowledge;
  const mix = knowledge.tasteProfile.drinkMix;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <DenisMarkBadge size="md" className="mt-0.5 bg-dash-accent-muted ring-dash-border" />
        <div>
          <h2 className="text-lg font-semibold">Venue knowledge</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            L2 per-venue accumulation — GDPR-safe agregati, bez ličnih podataka.
            {snapshot.updatedAt
              ? ` Ažurirano: ${snapshot.updatedAt.slice(0, 10)}.`
              : null}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Retention" value={retentionLabel(knowledge.retentionTier)} />
        <Metric label="Order lines" value={String(knowledge.orderSampleCount)} />
        <Metric
          label="Default jezik"
          value={knowledge.defaultGreetingLanguage}
        />
        <Metric
          label="Auto-pairs"
          value={String(knowledge.itemPairLearnings.length)}
        />
      </div>

      <QrCard>
        <QrCardTitle>Taste profile</QrCardTitle>
        <QrCardDescription className="space-y-2">
          <p>
            Piće: {mix.beer}% pivo · {mix.wine}% vino · {mix.cocktail}% cocktail ·{" "}
            {mix.other}% ostalo
          </p>
          {knowledge.tasteProfile.weekendDessertLiftPct != null ? (
            <p>
              Vikend desert lift: +{knowledge.tasteProfile.weekendDessertLiftPct}%
            </p>
          ) : null}
          {Object.entries(knowledge.tasteProfile.topItemByDow).map(([dow, name]) => (
            <p key={dow}>
              DOW {dow}: {name}
            </p>
          ))}
        </QrCardDescription>
      </QrCard>

      {knowledge.languageDistribution.length > 0 ? (
        <QrCard>
          <QrCardTitle>Guest languages</QrCardTitle>
          <QrCardDescription>
            {knowledge.languageDistribution
              .map((row) => `${row.sharePct}% ${row.code}`)
              .join(" · ")}
          </QrCardDescription>
        </QrCard>
      ) : null}

      {knowledge.itemPairLearnings.length > 0 ? (
        <QrCard>
          <QrCardTitle>Menu learnings</QrCardTitle>
          <QrCardDescription className="space-y-1">
            {knowledge.itemPairLearnings.slice(0, 6).map((pair) => (
              <p key={`${pair.anchorProductId}-${pair.pairedProductId}`}>
                {pair.anchorProductName} → {pair.pairedProductName} ({pair.pairRatePct}
                %)
              </p>
            ))}
            {knowledge.modifierLearnings.slice(0, 4).map((mod) => (
              <p key={`${mod.productId}-${mod.modifierLabel}`}>
                {mod.productName}: {mod.modifierLabel} ({mod.requestRatePct}%)
              </p>
            ))}
          </QrCardDescription>
        </QrCard>
      ) : null}

      {knowledge.peakHourProfiles.length > 0 ? (
        <QrCard>
          <QrCardTitle>Peak hour behavior</QrCardTitle>
          <QrCardDescription className="space-y-1">
            {knowledge.peakHourProfiles.slice(0, 6).map((slot) => (
              <p key={slot.slotKey}>
                {slot.label}: {slot.stress}
                {slot.avgWaitMinutes != null ? ` · ~${slot.avgWaitMinutes} min` : ""}
                {slot.behavior.shortenReplies ? " · short mode" : ""}
              </p>
            ))}
          </QrCardDescription>
        </QrCard>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
