import { requireAdmin } from "@/lib/auth/session";
import { DenisVoiceOrbTestClient } from "./denis-voice-orb-test-client";

export default async function DenisVoiceOrbTestPage() {
  await requireAdmin();
  return <DenisVoiceOrbTestClient />;
}
