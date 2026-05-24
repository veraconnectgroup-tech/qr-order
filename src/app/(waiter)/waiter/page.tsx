import { WaiterTableGrid } from "@/components/waiter/waiter-table-grid";
import { WaiterHomeSummary } from "@/components/waiter/waiter-home-summary";

export default function WaiterHomePage() {
  return (
    <div className="space-y-4">
      <WaiterHomeSummary />
      <WaiterTableGrid />
    </div>
  );
}
