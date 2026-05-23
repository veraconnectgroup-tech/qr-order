"use client";

export function AiMenuLoading() {
  return (
    <div className="border-b border-zinc-800 px-3 py-4 sm:px-4">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-40 rounded bg-zinc-800" />
        <div className="flex gap-3 overflow-hidden">
          <div className="h-48 w-64 shrink-0 rounded-2xl bg-zinc-800/80" />
          <div className="h-48 w-64 shrink-0 rounded-2xl bg-zinc-800/60" />
        </div>
      </div>
    </div>
  );
}
