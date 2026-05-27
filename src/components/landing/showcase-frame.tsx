import { Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";

export type ShowcaseTheme = "dark" | "light";

/** Cursor-style app window chrome */
export function ShowcaseWindow({
  children,
  url,
  title,
  className,
  theme = "dark",
  presentation = "default",
}: {
  children: React.ReactNode;
  url?: string;
  title?: string;
  className?: string;
  theme?: ShowcaseTheme;
  presentation?: "default" | "cinematic";
}) {
  const barLabel = url ?? title;
  const isLight = theme === "light";
  const cinematic = presentation === "cinematic";

  return (
    <div
      className={cn(
        "overflow-hidden",
        cinematic
          ? "rounded-none bg-[#09090b]"
          : cn(
              "rounded-xl border shadow-[0_24px_80px_-24px_rgba(0,0,0,0.18)]",
              isLight
                ? "border-zinc-200/90 bg-white"
                : "border-white/[0.08] bg-[#09090b] shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85)]"
            ),
        className
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2.5 border-b",
          cinematic ? "px-4 py-2" : "px-3 py-2",
          isLight
            ? "border-zinc-200 bg-zinc-50"
            : cinematic
              ? "border-white/[0.04] bg-white/[0.015]"
              : "border-white/[0.06] bg-white/[0.02]"
        )}
      >
        <div className={cn("flex shrink-0", cinematic ? "gap-1" : "gap-1.5")}>
          <div
            className={cn(
              "rounded-full",
              cinematic ? "size-2" : "size-2.5",
              isLight ? "bg-red-400/80" : "bg-zinc-700/80"
            )}
          />
          <div
            className={cn(
              "rounded-full",
              cinematic ? "size-2" : "size-2.5",
              isLight ? "bg-amber-400/80" : "bg-zinc-700/80"
            )}
          />
          <div
            className={cn(
              "rounded-full",
              cinematic ? "size-2" : "size-2.5",
              isLight ? "bg-emerald-400/80" : "bg-zinc-700/80"
            )}
          />
        </div>
        {barLabel && (
          <div
            className={cn(
              "min-w-0 flex-1 truncate rounded-md text-center",
              cinematic ? "px-2 py-0.5 text-[9px] tracking-wide" : "px-2.5 py-0.5 text-[10px]",
              isLight
                ? "bg-white text-zinc-500 ring-1 ring-zinc-200"
                : "bg-zinc-950/90 text-zinc-500"
            )}
          >
            {barLabel}
          </div>
        )}
      </div>
      <div className={isLight ? "bg-white" : "bg-[#09090b]"}>{children}</div>
    </div>
  );
}

function DeviceCaption({
  icon: Icon,
  label,
  shortLabel,
}: {
  icon: typeof Smartphone;
  label: string;
  shortLabel?: string;
}) {
  return (
    <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-zinc-500 sm:text-xs">
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{shortLabel ?? label}</span>
    </p>
  );
}

/** Fixed-ratio stage for layered hero (Cursor-style) */
export function ShowcaseStage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[min(100%,720px)] overflow-visible",
        "aspect-[5/4] min-h-[340px] sm:aspect-[16/11] sm:min-h-[400px] lg:min-h-[460px]",
        className
      )}
    >
      {children}
    </div>
  );
}

function StatusBar({ url, theme }: { url: string; theme: ShowcaseTheme }) {
  const isLight = theme === "light";
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b px-3 py-2",
        isLight ? "border-zinc-200 bg-zinc-50" : "border-zinc-800 bg-zinc-950"
      )}
    >
      <div className="flex shrink-0 gap-1">
        <div className={cn("size-1.5 rounded-full sm:size-2", isLight ? "bg-zinc-300" : "bg-zinc-700")} />
        <div className={cn("size-1.5 rounded-full sm:size-2", isLight ? "bg-zinc-300" : "bg-zinc-700")} />
        <div className={cn("size-1.5 rounded-full sm:size-2", isLight ? "bg-zinc-300" : "bg-zinc-700")} />
      </div>
      <div
        className={cn(
          "min-w-0 flex-1 truncate rounded-md px-2 py-0.5 text-center text-[9px] sm:text-[10px]",
          isLight ? "bg-white text-zinc-500 ring-1 ring-zinc-200" : "bg-zinc-900 text-zinc-500"
        )}
      >
        {url}
      </div>
    </div>
  );
}

function TabletScreen({
  children,
  url,
  theme,
}: {
  children: React.ReactNode;
  url?: string;
  theme: ShowcaseTheme;
}) {
  const isLight = theme === "light";
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border",
        isLight ? "border-zinc-200 bg-white" : "border-zinc-800 bg-[#09090b]"
      )}
    >
      {url && <StatusBar url={url} theme={theme} />}
      {children}
    </div>
  );
}

export function ShowcaseTablet({
  children,
  url,
  label = "Staff tablet",
  shortLabel,
  className,
  hideCaption = false,
  theme = "dark",
}: {
  children: React.ReactNode;
  url?: string;
  label?: string;
  shortLabel?: string;
  className?: string;
  hideCaption?: boolean;
  theme?: ShowcaseTheme;
}) {
  const isLight = theme === "light";

  return (
    <div className={cn("mx-auto w-full min-w-0 max-w-full", className)}>
      <div className="w-full min-w-0 md:hidden">
        <ShowcaseWindow url={url} theme={theme}>
          {children}
        </ShowcaseWindow>
      </div>

      <div className="mx-auto hidden w-full max-w-[920px] md:block">
        <div
          className={cn(
            "relative rounded-[1.25rem] p-2 shadow-[0_16px_48px_rgba(0,0,0,0.12)] lg:rounded-[1.35rem] lg:p-2.5",
            isLight
              ? "border-[6px] border-zinc-200 bg-zinc-100 lg:border-[7px]"
              : "border-[6px] border-zinc-800 bg-zinc-900 lg:border-[7px] shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
          )}
        >
          <div
            className={cn(
              "absolute left-1/2 top-3.5 z-10 size-1.5 -translate-x-1/2 rounded-full lg:top-4 lg:size-2",
              isLight ? "bg-zinc-300" : "bg-zinc-700"
            )}
          />
          <TabletScreen url={url} theme={theme}>
            {children}
          </TabletScreen>
          <div
            className={cn(
              "mx-auto mt-1.5 h-1 w-14 rounded-full lg:mt-2 lg:w-16",
              isLight ? "bg-zinc-300" : "bg-zinc-700"
            )}
          />
        </div>
      </div>

      {!hideCaption && (
        <DeviceCaption
          icon={Tablet}
          label={label}
          shortLabel={shortLabel ?? "Staff tablet"}
        />
      )}
    </div>
  );
}

export function ShowcasePhone({
  children,
  label = "Guest phone",
  shortLabel,
  className,
  hideLabel = false,
  presentation = "default",
}: {
  children: React.ReactNode;
  label?: string;
  shortLabel?: string;
  className?: string;
  hideLabel?: boolean;
  presentation?: "default" | "float";
}) {
  const floating = presentation === "float";

  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0",
        floating ? "max-w-none" : "max-w-[min(100%,280px)] sm:max-w-[300px]",
        className
      )}
    >
      <div
        className={cn(
          "relative bg-zinc-950",
          floating
            ? "rounded-[1.75rem] border border-white/[0.08] p-1 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.65)] sm:rounded-[2rem] sm:p-1.5"
            : "rounded-[2rem] border-[3px] border-zinc-700 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] sm:rounded-[2.5rem] sm:p-2"
        )}
      >
        <div
          className={cn(
            "absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-b-2xl bg-zinc-950",
            floating ? "h-4 w-[72px] sm:h-5 sm:w-[84px]" : "h-5 w-[96px] sm:h-6 sm:w-[108px]"
          )}
        />
        <div
          className={cn(
            "overflow-hidden bg-[#09090b]",
            floating ? "rounded-[1.5rem] sm:rounded-[1.65rem]" : "rounded-[1.65rem] sm:rounded-[2rem]"
          )}
        >
          {children}
        </div>
        {!floating && (
          <div className="mx-auto mt-1.5 h-1 w-20 rounded-full bg-zinc-800 sm:mt-2 sm:w-24" />
        )}
      </div>
      {!hideLabel && (
        <DeviceCaption
          icon={Smartphone}
          label={label}
          shortLabel={shortLabel ?? "Guest phone"}
        />
      )}
    </div>
  );
}

/** @deprecated Use ShowcaseTablet */
export function ShowcaseBrowser({
  children,
  url,
  className = "",
  theme = "dark",
}: {
  children: React.ReactNode;
  url?: string;
  className?: string;
  theme?: ShowcaseTheme;
}) {
  return (
    <ShowcaseTablet url={url} className={className} label="Staff tablet" theme={theme}>
      {children}
    </ShowcaseTablet>
  );
}
