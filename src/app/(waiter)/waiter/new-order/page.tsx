import { StaffOrderEntry } from "@/components/dashboard/staff-order-entry";

export default async function WaiterNewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ tableId?: string }>;
}) {
  const { tableId } = await searchParams;

  return (
    <div className="-mx-3 -mt-4">
      <StaffOrderEntry initialTableId={tableId} />
    </div>
  );
}
