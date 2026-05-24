export function DashboardPlaceholder({ title }: { title: string }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-dash-text">{title}</h2>
      <p className="mt-2 text-dash-text-disabled">Coming soon</p>
    </div>
  );
}
