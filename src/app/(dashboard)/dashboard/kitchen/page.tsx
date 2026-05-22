import { KitchenGrid } from "@/components/dashboard/kitchen-grid";
import { KitchenHeader } from "@/components/dashboard/kitchen-header";

export default function KitchenPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <KitchenHeader />
      <KitchenGrid />
    </div>
  );
}
