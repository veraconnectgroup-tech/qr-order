import { AiIntelligenceCard } from "@/components/dashboard/ai-intelligence-card";
import { DenisStaffCopilotBoard } from "@/components/dashboard/denis-staff-copilot-board";

export default function DenisCopilotPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <AiIntelligenceCard />
      <DenisStaffCopilotBoard />
    </div>
  );
}
