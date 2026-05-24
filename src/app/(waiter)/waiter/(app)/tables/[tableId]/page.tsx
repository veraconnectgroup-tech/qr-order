import { WaiterTableDetail } from "@/components/waiter/waiter-table-detail";

export default async function WaiterTableDetailPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const { tableId } = await params;
  return <WaiterTableDetail tableId={tableId} />;
}
