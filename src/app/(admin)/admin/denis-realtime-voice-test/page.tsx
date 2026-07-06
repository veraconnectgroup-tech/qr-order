import { requireAdmin } from "@/lib/auth/session";
import { DenisRealtimeVoiceTestPanel } from "@/components/admin/denis-realtime-voice-test-panel";

export default async function DenisRealtimeVoiceTestPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-3xl">
      <DenisRealtimeVoiceTestPanel />
    </div>
  );
}
