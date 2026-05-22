export default function AdminOverviewPage() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Revenue", value: "€0" },
          { label: "Orders", value: "0" },
          { label: "Avg Order", value: "€0" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm text-neutral-600">{stat.label}</p>
            <p className="text-stat mt-2">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
