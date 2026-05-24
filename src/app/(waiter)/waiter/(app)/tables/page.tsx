import { WaiterTableGrid } from "@/components/waiter/waiter-table-grid";

export default function WaiterTablesPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold text-dash-text">Tables</h1>
      <WaiterTableGrid />
    </div>
  );
}
