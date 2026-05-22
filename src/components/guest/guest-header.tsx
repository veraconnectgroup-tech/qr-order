export function GuestHeader({
  orgName,
  logoUrl,
  subtitle,
  tableName,
}: {
  orgName: string;
  logoUrl?: string | null;
  subtitle: string;
  tableName: string;
}) {
  const initial = orgName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-3">
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
          <p className="truncate text-lg font-semibold text-zinc-100">
            {orgName}
          </p>
          <p className="truncate text-xs text-zinc-500">{subtitle}</p>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300">
          {tableName}
        </span>
      </div>
    </header>
  );
}
