import { WaiterCallsBoard } from "@/components/dashboard/waiter-calls-board";
import { WaiterDenisStaffAlerts } from "@/components/waiter/waiter-denis-staff-alerts";

export default function WaiterCallsPage() {
  return (
    <div className="space-y-6">
      <WaiterDenisStaffAlerts />
      <WaiterCallsBoard variant="waiter" />
    </div>
  );
}
