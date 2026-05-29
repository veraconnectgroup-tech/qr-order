import { redirect } from "next/navigation";
import { KitchenBoard } from "@/components/dashboard/kitchen-board";
import { getEffectiveStaff } from "@/lib/auth/session";

export default async function KitchenPage() {
  const staff = await getEffectiveStaff();
  if (staff.role === "kitchen") {
    redirect("/kitchen");
  }
  return <KitchenBoard />;
}
