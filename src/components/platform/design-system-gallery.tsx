import {
  DenisBrandMark,
  DenisChip,
  DenisTableMark,
  FloorTile,
  QrCard,
  QrCardDescription,
  QrCardHeading,
  QrCardTitle,
} from "@/components/design-system";
import type {
  DenisTableMarkState,
  FloorTileStatus,
  FloorTileVariant,
} from "@/components/design-system";
import { cn } from "@/lib/utils";

const SPATIAL_TOKENS = [
  { name: "Void", var: "--qr-void" },
  { name: "Surface", var: "--qr-surface" },
  { name: "Elevated", var: "--qr-elevated" },
  { name: "Ivory", var: "--qr-ivory" },
  { name: "Muted", var: "--qr-muted" },
  { name: "Ember", var: "--qr-ember" },
  { name: "Ember hover", var: "--qr-ember-hover" },
  { name: "Ember muted", var: "--qr-ember-muted" },
  { name: "Ember glow", var: "--qr-ember-glow" },
] as const;

const FLOOR_STATUSES: FloorTileStatus[] = [
  "available",
  "occupied",
  "attention",
  "payment",
  "selected",
];

const FLOOR_VARIANTS: FloorTileVariant[] = ["floor", "kpi", "chip"];

const MARK_STATES: DenisTableMarkState[] = ["idle", "listen", "think"];

const TYPE_SCALE = [
  { label: "Display / page title", className: "text-2xl font-semibold text-dash-text" },
  { label: "Section title", className: "text-lg font-semibold text-foreground" },
  { label: "Panel heading", className: "text-sm font-semibold text-dash-text-secondary" },
  { label: "Body", className: "text-sm text-dash-text-secondary" },
  { label: "Meta / caption", className: "text-xs text-dash-text-muted" },
  { label: "Disabled / hint", className: "text-xs text-dash-text-disabled" },
  { label: "KPI value", className: "text-2xl font-bold tabular-nums text-dash-text" },
  { label: "Accent KPI", className: "text-2xl font-bold tabular-nums text-[var(--qr-ember)]" },
] as const;

function GallerySection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <QrCard id={id} variant="muted" padding="lg" className="scroll-mt-6">
      <QrCardTitle className="text-base">{title}</QrCardTitle>
      {description ? <QrCardDescription>{description}</QrCardDescription> : null}
      <div className="mt-5">{children}</div>
    </QrCard>
  );
}

function TokenSwatch({ name, cssVar }: { name: string; cssVar: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card/40 p-3">
      <div
        className="size-10 shrink-0 rounded-lg border border-border"
        style={{ background: `var(${cssVar})` }}
      />
      <div className="min-w-0">
        <p className="truncate font-mono text-xs text-dash-text-secondary">{cssVar}</p>
        <p className="text-xs text-dash-text-muted">{name}</p>
      </div>
    </div>
  );
}

function FloorTileMatrix() {
  return (
    <div className="space-y-8">
      {FLOOR_VARIANTS.map((variant) => (
        <div key={variant}>
          <QrCardHeading className="mb-3 capitalize">{variant} variant</QrCardHeading>
          <div
            className={cn(
              "grid gap-3",
              variant === "chip"
                ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
                : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
            )}
          >
            {FLOOR_STATUSES.map((status) => (
              <FloorTile
                key={`${variant}-${status}`}
                variant={variant}
                status={status}
                label={variant === "kpi" ? "€88.08" : variant === "chip" ? "Chip" : "T12"}
                sublabel={variant === "kpi" ? "Revenue" : undefined}
                value={variant === "kpi" ? "+12%" : undefined}
                highlight={variant === "kpi" && status === "selected"}
                className={variant === "floor" ? "min-h-20" : undefined}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DesignSystemGallery() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-dash-text-disabled">
          Denis Spatial v4
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Design system gallery</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Living reference for QA and platform admins. Primitives ship from{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">src/components/design-system/</code>
          . Spec:{" "}
          <span className="text-dash-text-secondary">docs/design/ADR-007-visual-system.md</span>
          .
        </p>
        <nav className="mt-4 flex flex-wrap gap-2">
          {[
            ["#tokens", "Tokens"],
            ["#typography", "Typography"],
            ["#floor-tile", "FloorTile"],
            ["#denis-brand", "Denis brand"],
            ["#qr-card", "QrCard"],
            ["#denis-chips", "Denis chips"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-full border border-border bg-card/50 px-3 py-1 text-xs font-medium text-dash-text-secondary transition hover:border-[var(--qr-ember)] hover:text-[var(--qr-ember)]"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>

      <GallerySection
        id="tokens"
        title="Spatial tokens"
        description="Core palette on admin-theme. Ember stays #f97316 until DS-10 palette shift approval."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SPATIAL_TOKENS.map((token) => (
            <TokenSwatch key={token.var} name={token.name} cssVar={token.var} />
          ))}
        </div>
      </GallerySection>

      <GallerySection
        id="typography"
        title="Typography scale"
        description="Use semantic dash-text-* in ops surfaces; avoid raw zinc in feature code."
      >
        <div className="space-y-4">
          {TYPE_SCALE.map((row) => (
            <div
              key={row.label}
              className="flex flex-col gap-1 border-b border-border pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between"
            >
              <span className="text-xs text-dash-text-disabled">{row.label}</span>
              <span className={row.className}>Skyline Lounge · Table 12</span>
            </div>
          ))}
        </div>
      </GallerySection>

      <GallerySection
        id="floor-tile"
        title="FloorTile matrix"
        description="Atomic spatial unit — floor, kpi, and chip variants across all statuses."
      >
        <FloorTileMatrix />
      </GallerySection>

      <GallerySection
        id="denis-brand"
        title="Denis brand marks"
        description="Table D mark replaces Sparkles. Subline: Part of Vera Group."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <QrCardHeading className="mb-3">Lockup</QrCardHeading>
            <DenisBrandMark />
          </div>
          <div>
            <QrCardHeading className="mb-3">Mark only</QrCardHeading>
            <DenisBrandMark markOnly />
          </div>
        </div>

        <div className="mt-8">
          <QrCardHeading className="mb-3">Presence states</QrCardHeading>
          <div className="grid gap-4 sm:grid-cols-3">
            {MARK_STATES.map((state) => (
              <div
                key={state}
                className="rounded-lg border border-border bg-card/40 p-4"
              >
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-dash-text-disabled">
                  {state}
                </p>
                <DenisBrandMark markState={state} />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <QrCardHeading className="mb-3">Table D sizes</QrCardHeading>
          <div className="flex flex-wrap items-end gap-6">
            {([24, 32, 40] as const).map((size) => (
              <div key={size} className="text-center">
                <DenisTableMark size={size} />
                <p className="mt-2 font-mono text-xs text-dash-text-muted">{size}px</p>
              </div>
            ))}
          </div>
        </div>
      </GallerySection>

      <GallerySection
        id="qr-card"
        title="QrCard"
        description="Panel primitive replacing ad-hoc rounded-xl border wrappers."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <QrCard variant="default" padding="md">
            <QrCardTitle className="text-base">Default</QrCardTitle>
            <QrCardDescription>bg-card · padding md</QrCardDescription>
          </QrCard>
          <QrCard variant="muted" padding="md">
            <QrCardTitle className="text-base">Muted</QrCardTitle>
            <QrCardDescription>bg-card/50 · dashboard panels</QrCardDescription>
          </QrCard>
        </div>
      </GallerySection>

      <GallerySection
        id="denis-chips"
        title="Denis chips"
        description="Quick replies in guest Denis panel — FloorTile chip variant."
      >
        <div className="flex flex-wrap gap-2">
          <DenisChip label="Empfehlung" />
          <DenisChip label="Selected" selected />
          <DenisChip label="Disabled" disabled />
        </div>
      </GallerySection>
    </div>
  );
}
