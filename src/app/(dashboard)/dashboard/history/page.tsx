import { Suspense } from "react";
import {
  OrderHistoryList,
  OrderHistoryListSkeleton,
} from "@/components/dashboard/order-history-list";

export default function HistoryPage() {
  return (
    <Suspense fallback={<OrderHistoryListSkeleton />}>
      <OrderHistoryList />
    </Suspense>
  );
}
