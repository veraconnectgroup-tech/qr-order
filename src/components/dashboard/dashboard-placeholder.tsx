export function DashboardPlaceholder({ title }: { title: string }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-zinc-50">{title}</h2>
      <p className="mt-2 text-zinc-500">Coming soon</p>
    </div>
  );
}
