import { requireAdmin } from "@/lib/auth/session";
import { DenisMenuAgentChat } from "@/components/admin/denis-menu-agent-chat";

export default async function DenisMenuAgentPage() {
  await requireAdmin();
  return <DenisMenuAgentChat />;
}
