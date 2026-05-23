import { cn } from "@/lib/utils";

function PreviewFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "landing-preview-shimmer relative h-[148px] overflow-hidden rounded-lg border border-zinc-800/80 bg-[#09090b] sm:h-[156px]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-900/80 via-transparent to-transparent" />
      {children}
    </div>
  );
}

export function ModulePreviewQr() {
  return (
    <PreviewFrame>
      <div className="flex h-full items-center justify-center gap-3 p-3">
        <div className="size-12 rounded-md border border-zinc-700 bg-zinc-900 p-1">
          <div className="grid h-full grid-cols-3 grid-rows-3 gap-px">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-[1px]",
                  [0, 2, 6, 8, 4].includes(i) ? "bg-orange-500" : "bg-zinc-700"
                )}
              />
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="h-2 w-16 rounded bg-zinc-700" />
          <div className="h-2 w-12 rounded bg-orange-500/60" />
        </div>
      </div>
    </PreviewFrame>
  );
}

export function ModulePreviewSession() {
  return (
    <PreviewFrame>
      <div className="grid h-full grid-cols-2 gap-1.5 p-2.5">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="rounded-md bg-zinc-900 p-1.5">
            <div className="h-1.5 w-8 rounded bg-zinc-700" />
            <div className="mt-1 h-1 w-6 rounded bg-orange-500/50" />
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

export function ModulePreviewFloor() {
  return (
    <PreviewFrame>
      <div className="grid h-full grid-cols-4 gap-1 p-2.5">
        {["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"].map((t, i) => (
          <div
            key={t}
            className={cn(
              "flex items-center justify-center rounded text-[8px] font-bold",
              i === 2 ? "bg-orange-500/30 text-orange-300" : "bg-zinc-800 text-zinc-500",
              i === 0 && "pulse-dot"
            )}
          >
            {t}
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

export function ModulePreviewKitchen() {
  return (
    <PreviewFrame>
      <div className="grid h-full grid-cols-3 gap-1 p-2">
        {[
          { t: "8", c: "border-l-orange-500" },
          { t: "3", c: "border-l-emerald-500" },
          { t: "B1", c: "border-l-blue-500" },
        ].map(({ t, c }) => (
          <div
            key={t}
            className={cn("rounded border border-zinc-800 border-l-2 bg-zinc-900 p-1", c)}
          >
            <div className="text-[8px] font-bold text-zinc-300">{t}</div>
            <div className="mt-1 h-1 w-full rounded bg-zinc-700" />
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

export function ModulePreviewWaiter() {
  return (
    <PreviewFrame>
      <div className="flex h-full flex-col justify-center gap-1.5 p-3">
        <div className="flex items-center gap-2 rounded-md bg-orange-500/15 px-2 py-1.5">
          <div className="size-2 rounded-full bg-orange-500" />
          <span className="text-[9px] font-medium text-orange-300">Table 8 · Call</span>
        </div>
        <div className="rounded-md bg-zinc-900 px-2 py-1.5 text-[9px] text-zinc-500">
          Table 3 · Bill
        </div>
      </div>
    </PreviewFrame>
  );
}

export function ModulePreviewStripe() {
  return (
    <PreviewFrame>
      <div className="flex h-full flex-col items-center justify-center gap-2 p-3">
        <div className="h-7 w-full rounded-md bg-black" />
        <div className="h-6 w-full rounded-md bg-orange-500/80" />
        <span className="text-[8px] text-zinc-600">Stripe Connect</span>
      </div>
    </PreviewFrame>
  );
}

export function ModulePreviewInPerson() {
  return (
    <PreviewFrame>
      <div className="flex h-full items-center justify-around p-3">
        {["Bar", "Table", "Card"].map((l) => (
          <div key={l} className="rounded-full border border-zinc-700 px-2 py-1 text-[8px] text-zinc-400">
            {l}
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

export function ModulePreviewAnalytics() {
  return (
    <PreviewFrame>
      <div className="flex h-full items-end gap-1 p-3 pt-6">
        {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-orange-500/40"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </PreviewFrame>
  );
}

export function ModulePreviewSplit() {
  return (
    <PreviewFrame>
      <div className="flex h-full items-center justify-center gap-2 p-3">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="flex flex-1 flex-col items-center rounded-md border border-zinc-800 bg-zinc-900 py-2"
          >
            <span className="text-[8px] text-zinc-500">Part {n}</span>
            <span className="text-[9px] font-bold text-orange-400">€14</span>
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

export function ModulePreviewTips() {
  return (
    <PreviewFrame>
      <div className="flex h-full flex-col justify-center gap-1.5 p-3">
        <div className="flex gap-1">
          {["0%", "5%", "10%", "15%"].map((p, i) => (
            <div
              key={p}
              className={cn(
                "flex-1 rounded-full py-1 text-center text-[7px] font-medium",
                i === 2 ? "bg-orange-500 text-white" : "bg-zinc-800 text-zinc-500"
              )}
            >
              {p}
            </div>
          ))}
        </div>
        <div className="text-center text-[8px] text-zinc-500">Trinkgeld · MwSt-frei</div>
      </div>
    </PreviewFrame>
  );
}
