"use client";

import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { useAppLocale } from "@/components/guest/app-locale-provider";

/** Placeholder while guest_scene loads — same rail grammar as DenisSceneShell. */
export function DenisSceneShellSkeleton({
  tableName,
  venueName,
}: {
  tableName?: string;
  venueName?: string;
}) {
  const { tUI } = useAppLocale();

  return (
    <section
      className="denis-scene-shell relative mx-4 mb-3 overflow-hidden rounded-2xl border border-[var(--qr-elevated)] bg-[var(--qr-surface)] shadow-[0_0_40px_rgba(232,93,4,0.06)]"
      aria-busy
      aria-label="Denis"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[var(--qr-ember)]"
        aria-hidden
      />
      <div className="flex items-center gap-3 px-4 py-3">
        <DenisMarkBadge size="md" markState="think" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-sm font-semibold tracking-tight text-[var(--qr-ivory)]">
              Denis
            </p>
            {tableName && venueName ? (
              <span className="text-[11px] text-[var(--qr-muted)]">
                {tableName} · {venueName}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[13px] text-[var(--qr-muted)]">
            {tUI("scene.loading")}
          </p>
        </div>
      </div>
    </section>
  );
}
