import { KdsBoard } from "@/components/dashboard/kds-board";
import { KdsErrorBoundary } from "@/components/error/kds-error-boundary";

export default function KitchenKdsPage() {
  return (
    <KdsErrorBoundary>
      <KdsBoard />
    </KdsErrorBoundary>
  );
}
