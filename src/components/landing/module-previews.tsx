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
        "landing-preview-shimmer relative h-[148px] overflow-hidden rounded-lg border border-[#e3e7ee] bg-[#fbfcfd] sm:h-[156px]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ModulePreviewQr() {
  return (
    <PreviewFrame>
      <div className="flex h-full items-center justify-center gap-3 p-3">
        <div className="size-12 rounded-md border border-[#dfe5ed] bg-white p-1">
          <div className="grid h-full grid-cols-3 grid-rows-3 gap-px">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-[1px]",
                  [0, 2, 6, 8, 4].includes(i) ? "bg-[#1f2328]" : "bg-[#cfd6df]"
                )}
              />
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="h-2 w-16 rounded bg-[#d8dee8]" />
          <div className="h-2 w-12 rounded bg-emerald-200" />
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
          <div key={n} className="rounded-md border border-[#e3e7ee] bg-white p-1.5">
            <div className="h-1.5 w-8 rounded bg-[#d8dee8]" />
            <div className="mt-1 h-1 w-6 rounded bg-emerald-200" />
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
              i === 2 ? "bg-orange-50 text-orange-700 ring-1 ring-orange-200" : "bg-white text-[#596273] ring-1 ring-[#e3e7ee]",
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
            className={cn("rounded border border-[#e3e7ee] border-l-2 bg-white p-1", c)}
          >
            <div className="text-[8px] font-bold text-[#1f2328]">{t}</div>
            <div className="mt-1 h-1 w-full rounded bg-[#d8dee8]" />
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
        <div className="flex items-center gap-2 rounded-md bg-orange-50 px-2 py-1.5 ring-1 ring-orange-200">
          <div className="size-2 rounded-full bg-orange-500" />
          <span className="text-[9px] font-medium text-orange-700">Table 8 · Call</span>
        </div>
        <div className="rounded-md border border-[#e3e7ee] bg-white px-2 py-1.5 text-[9px] text-[#596273]">
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
        <div className="h-6 w-full rounded-md bg-[#635bff]/90" />
        <span className="text-[8px] text-[#6b7280]">Stripe Connect</span>
      </div>
    </PreviewFrame>
  );
}

export function ModulePreviewInPerson() {
  return (
    <PreviewFrame>
      <div className="flex h-full items-center justify-around p-3">
        {["Bar", "Table", "Card"].map((l) => (
          <div key={l} className="rounded-full border border-[#dfe5ed] bg-white px-2 py-1 text-[8px] text-[#596273]">
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
            className="flex-1 rounded-t bg-[#1f2328]/30"
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
            className="flex flex-1 flex-col items-center rounded-md border border-[#e3e7ee] bg-white py-2"
          >
            <span className="text-[8px] text-[#6b7280]">Part {n}</span>
            <span className="text-[9px] font-bold text-[#1f2328]">€14</span>
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
                i === 2 ? "bg-[#1f2328] text-white" : "bg-white text-[#596273] ring-1 ring-[#e3e7ee]"
              )}
            >
              {p}
            </div>
          ))}
        </div>
        <div className="text-center text-[8px] text-[#6b7280]">Trinkgeld · MwSt-frei</div>
      </div>
    </PreviewFrame>
  );
}

export function ModulePreviewAi() {
  return (
    <PreviewFrame>
      <div className="flex h-full flex-col justify-center gap-2 p-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
          <p className="text-[9px] leading-snug text-emerald-800">
            <span className="mr-1">🤖</span>
            &quot;Dessert is a good next move.&quot;
          </p>
        </div>
        <div className="space-y-1 pl-2">
          <div className="flex items-start gap-1.5 text-[8px] text-[#596273]">
            <span className="text-[#8b95a4]">├─</span>
            <span>
              <span className="mr-0.5">🍷</span>
              Aperol Spritz — matches your mood
            </span>
          </div>
          <div className="flex items-start gap-1.5 text-[8px] text-[#596273]">
            <span className="text-[#8b95a4]">└─</span>
            <span>
              <span className="mr-0.5">🥗</span>
              Caesar Salad — allergen-free
            </span>
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}
