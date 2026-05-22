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
    <header className="sticky top-0 z-40 bg-[#09090b]/95 backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="size-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-lg font-bold text-orange-500">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold text-zinc-50">{orgName}</p>
          <p className="truncate text-sm text-zinc-400">{subtitle}</p>
        </div>
        <span className="shrink-0 rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-500">
          {tableName}
        </span>
      </div>
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />
    </header>
  );
}
