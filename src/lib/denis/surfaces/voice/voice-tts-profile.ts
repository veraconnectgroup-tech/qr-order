import type { VenuePlaybookTone } from "@/lib/admin/generate-venue-playbook";

export type VoiceTtsProfile = {
  rate: number;
  pitch: number;
};

/** Playbook tone → Web Speech Synthesis pacing (M18 voice out). */
export function resolveVoiceTtsProfile(
  tone?: VenuePlaybookTone | null
): VoiceTtsProfile {
  switch (tone) {
    case "formal":
      return { rate: 0.85, pitch: 1.0 };
    case "efficient":
      return { rate: 1.05, pitch: 1.0 };
    case "playful_luxury":
      return { rate: 0.92, pitch: 1.04 };
    case "friendly":
      return { rate: 1.1, pitch: 1.03 };
    default:
      return { rate: 1.08, pitch: 1.02 };
  }
}
