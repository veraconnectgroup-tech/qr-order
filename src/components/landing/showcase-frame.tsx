import { Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";

/** Cursor-style app window chrome */
export function ShowcaseWindow({
  children,
  url,
  title,
  className,
}: {
  children: React.ReactNode;
  url?: string;
  title?: string;
  className?: string;
}) {
  const barLabel = url ?? title;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-950",
        "shadow-[0_20px_70px_-16px_rgba(0,0,0,0.75)]",
        className
      )}
    >
      <div className="flex items-center gap-2.5 border-b border-zinc-800 bg-zinc-900/90 px-3 py-2">
        <div className="flex shrink-0 gap-1.5">
          <div className="size-2.5 rounded-full bg-zinc-600" />
          <div className="size-2.5 rounded-full bg-zinc-600" />
          <div className="size-2.5 rounded-full bg-zinc-600" />
        </div>
        {barLabel && (
          <div className="min-w-0 flex-1 truncate rounded-md bg-zinc-950/90 px-2.5 py-0.5 text-center text-[10px] text-zinc-500">
            {barLabel}
          </div>
        )}
      </div>
      <div className="bg-[#09090b]">{children}</div>
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
    <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-zinc-600 sm:text-xs">
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
        "relative mx-auto w-full max-w-[min(100%,720px)]",
        "aspect-[5/4] min-h-[340px] sm:aspect-[16/11] sm:min-h-[400px] lg:min-h-[440px]",
        className
      )}
    >
      {children}
    </div>
  );
}

function StatusBar({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-3 py-2">
      <div className="flex shrink-0 gap-1">
        <div className="size-1.5 rounded-full bg-zinc-700 sm:size-2" />
        <div className="size-1.5 rounded-full bg-zinc-700 sm:size-2" />
        <div className="size-1.5 rounded-full bg-zinc-700 sm:size-2" />
      </div>
      <div className="min-w-0 flex-1 truncate rounded-md bg-zinc-900 px-2 py-0.5 text-center text-[9px] text-zinc-500 sm:text-[10px]">
        {url}
      </div>
    </div>
  );
}

function TabletScreen({
  children,
  url,
}: {
  children: React.ReactNode;
  url?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[#09090b]">
      {url && <StatusBar url={url} />}
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
}: {
  children: React.ReactNode;
  url?: string;
  label?: string;
  shortLabel?: string;
  className?: string;
  hideCaption?: boolean;
}) {
  return (
    <div className={cn("mx-auto w-full min-w-0 max-w-full", className)}>
      <div className="w-full min-w-0 md:hidden">
        <ShowcaseWindow url={url}>{children}</ShowcaseWindow>
      </div>

      <div className="mx-auto hidden w-full max-w-[920px] md:block">
        <div className="relative rounded-[1.25rem] border-[6px] border-zinc-800 bg-zinc-900 p-2 shadow-[0_16px_48px_rgba(0,0,0,0.5)] lg:rounded-[1.35rem] lg:border-[7px] lg:p-2.5">
          <div className="absolute left-1/2 top-3.5 z-10 size-1.5 -translate-x-1/2 rounded-full bg-zinc-700 lg:top-4 lg:size-2" />
          <TabletScreen url={url}>{children}</TabletScreen>
          <div className="mx-auto mt-1.5 h-1 w-14 rounded-full bg-zinc-700 lg:mt-2 lg:w-16" />
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
}: {
  children: React.ReactNode;
  label?: string;
  shortLabel?: string;
  className?: string;
  hideLabel?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0 max-w-[min(100%,280px)] sm:max-w-[300px]",
        className
      )}
    >
      <div className="relative rounded-[2rem] border-[3px] border-zinc-700 bg-zinc-950 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] sm:rounded-[2.5rem] sm:p-2">
        <div className="absolute left-1/2 top-0 z-10 h-5 w-[96px] -translate-x-1/2 rounded-b-2xl bg-zinc-950 sm:h-6 sm:w-[108px]" />
        <div className="overflow-hidden rounded-[1.65rem] bg-[#09090b] sm:rounded-[2rem]">
          {children}
        </div>
        <div className="mx-auto mt-1.5 h-1 w-20 rounded-full bg-zinc-800 sm:mt-2 sm:w-24" />
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
}: {
  children: React.ReactNode;
  url?: string;
  className?: string;
}) {
  return (
    <ShowcaseTablet url={url} className={className} label="Staff tablet">
      {children}
    </ShowcaseTablet>
  );
}
