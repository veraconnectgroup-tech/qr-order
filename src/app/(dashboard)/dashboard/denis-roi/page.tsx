import { DenisRoiView } from "@/components/dashboard/denis-roi-view";
import { requireAdmin } from "@/lib/auth/session";

export default async function DenisRoiPage() {
  await requireAdmin();
  return <DenisRoiView />;
}
