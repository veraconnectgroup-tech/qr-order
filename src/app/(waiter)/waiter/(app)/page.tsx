import { WaiterTableGrid } from "@/components/waiter/waiter-table-grid";
import { WaiterHomeSummary } from "@/components/waiter/waiter-home-summary";
import { WaiterInstallBanner } from "@/components/waiter/waiter-install-banner";
import { WaiterDenisCopilotPanel } from "@/components/waiter/waiter-denis-copilot-panel";

export default function WaiterHomePage() {
  return (
    <div className="space-y-4">
      <WaiterInstallBanner />
      <WaiterHomeSummary />
      <WaiterDenisCopilotPanel />
      <WaiterTableGrid />
    </div>
  );
}
