import { WaiterTableGrid } from "@/components/waiter/waiter-table-grid";
import { WaiterTransferSuggestions } from "@/components/waiter/waiter-transfer-suggestions";
import { WaiterDenisCopilotPanel } from "@/components/waiter/waiter-denis-copilot-panel";

export default function WaiterTablesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-dash-text">Tables</h1>
      <WaiterDenisCopilotPanel />
      <WaiterTransferSuggestions />
      <WaiterTableGrid />
    </div>
  );
}
