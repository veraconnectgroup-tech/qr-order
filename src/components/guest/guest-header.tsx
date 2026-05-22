export function GuestHeader({
  orgName,
  logoUrl,
  subtitle,
  tableName,
  trailing,
}: {
  orgName: string;
  logoUrl?: string | null;
  subtitle: string;
  tableName: string;
  trailing?: React.ReactNode;
}) {
  const initial = orgName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 pt-safe backdrop-blur-sm">
      <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="size-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-zinc-100 sm:text-lg">
            {orgName}
          </p>
          <p className="truncate text-xs text-zinc-500">{subtitle}</p>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300 sm:px-3 sm:py-1 sm:text-xs">
          {tableName}
        </span>
        {trailing}
      </div>
    </header>
  );
}
