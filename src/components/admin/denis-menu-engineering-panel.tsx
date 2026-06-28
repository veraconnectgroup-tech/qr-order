import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { MenuEngineeringQuadrantBoard } from "@/components/admin/menu-engineering-quadrant-board";
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";
import type { MenuEngineeringSnapshot } from "@/lib/admin/load-menu-engineering";
import type { MenuEngineeringCategory } from "@/lib/denis/platform/menu-engineering";

const CATEGORY_META: Record<
  MenuEngineeringCategory,
  { emoji: string; label: string; hint: string }
> = {
  star: {
    emoji: "⭐",
    label: "Stars",
    hint: "Denis aktivno preporučuje — viši VKG priority",
  },
  puzzle: {
    emoji: "🧩",
    label: "Puzzles",
    hint: "Denis nudge: Jeste li probali…?",
  },
  workhorse: {
    emoji: "🐂",
    label: "Workhorses",
    hint: "Visok volumen — razmisli o paketu",
  },
  dog: {
    emoji: "🐕",
    label: "Dogs",
    hint: "Denis NIKAD ne preporučuje — kandidat za uklanjanje",
  },
};

function formatMoneyMajor(revenueCents: number): string {
  return `€${Math.round(revenueCents / 100).toLocaleString("de-DE")}`;
}

export function DenisMenuEngineeringPanel({
  snapshot,
}: {
  snapshot: MenuEngineeringSnapshot | null;
}) {
  if (!snapshot) {
    return (
      <QrCard>
        <QrCardTitle>Meni analiza</QrCardTitle>
        <QrCardDescription>
          Nema podataka — proveri VKG i isporučene narudžbine.
        </QrCardDescription>
      </QrCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <DenisMarkBadge size="md" className="mt-0.5 bg-dash-accent-muted ring-dash-border" />
        <div>
          <h2 className="text-lg font-semibold">Meni analiza (BCG)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {snapshot.fromDate} → {snapshot.toDate} · {snapshot.totalOrderLines}{" "}
            stavki · {snapshot.lookbackDays}-dan lookback · cena kao margin proxy
          </p>
          {!snapshot.hasEnoughData ? (
            <p className="mt-2 text-sm text-amber-700">
              Potrebno minimum 30 dana podataka pre punog BCG matriksa.
            </p>
          ) : null}
          {snapshot.revenueImpact ? (
            <p className="mt-2 text-sm font-medium text-emerald-700">
              {snapshot.revenueImpact.summaryLine}
            </p>
          ) : null}
        </div>
      </div>

      {snapshot.seasonal ? (
        <QrCard className="border-dash-accent/30 bg-dash-accent/5 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">
            {snapshot.seasonal.headline}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {snapshot.seasonal.lines.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        </QrCard>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          ["star", "puzzle", "workhorse", "dog"] as MenuEngineeringCategory[]
        ).map((category) => {
          const meta = CATEGORY_META[category];
          const count = snapshot.byCategory[category].length;
          return (
            <QrCard key={category} className="px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {meta.emoji} {meta.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{count}</p>
              <p className="mt-1 text-xs text-muted-foreground">{meta.hint}</p>
            </QrCard>
          );
        })}
      </div>

      {snapshot.hasEnoughData ? (
        <QrCard className="p-4">
          <QrCardTitle className="text-base">BCG matrica — prevuci stavke</QrCardTitle>
          <QrCardDescription className="mt-1">
            Visok volumen + visoka cena = star · nizak + visoka = puzzle · visok + nizak =
            workhorse · nizak + nizak = dog
          </QrCardDescription>
          <div className="mt-4">
            <MenuEngineeringQuadrantBoard items={snapshot.items} />
          </div>
        </QrCard>
      ) : null}

      <QrCard className="p-0 overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <QrCardTitle className="text-base">Top stavke po volumenu</QrCardTitle>
        </div>
        {snapshot.items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Nema dostupnih proizvoda u VKG-u.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {snapshot.items.slice(0, 16).map((item) => {
              const meta = CATEGORY_META[item.category];
              return (
                <li
                  key={item.productId}
                  className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <span className="font-medium">{item.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {meta.emoji} {meta.label}
                    </span>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.suggestion}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground sm:text-right">
                    {item.orderCount} nar · {formatMoneyMajor(item.revenueCents)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </QrCard>
    </div>
  );
}
