import { loadDenisManifestAdminState } from "@/lib/admin/denis-manifest-actions";
import { loadDenisRolloutAdminState } from "@/lib/admin/denis-rollout-actions";
import {
  computeDenisSystemStatusEval,
  type DenisSystemStatusEval,
} from "@/lib/admin/denis-system-status-eval";

export type DenisSystemStatus = DenisSystemStatusEval & {
  rollout: {
    mode: string;
    narrateWithLlm: boolean;
    timelineEnabled: boolean;
    guestSeesLegacy: boolean;
  } | null;
  manifest: {
    activeVersion: number | null;
    historyCount: number;
  } | null;
  gaps: DenisSystemStatusEval["gaps"] & {
    guestSeesNewBrain: boolean;
  };
};

/** Admin read — eval (pure) + rollout/manifest (auth). */
export async function loadDenisSystemStatus(): Promise<
  DenisSystemStatus | { error: string }
> {
  const base = computeDenisSystemStatusEval();

  const rolloutState = await loadDenisRolloutAdminState();
  const manifestState = await loadDenisManifestAdminState();

  if ("error" in rolloutState) {
    return { error: rolloutState.error };
  }

  const rollout = {
    mode: rolloutState.effective.rolloutMode,
    narrateWithLlm: rolloutState.effective.narrateWithLlm,
    timelineEnabled: rolloutState.timelineEnabled,
    guestSeesLegacy: rolloutState.guestSeesLegacy,
  };

  const manifest =
    manifestState && !("error" in manifestState)
      ? {
          activeVersion: manifestState.activeVersion,
          historyCount: manifestState.history.length,
        }
      : null;

  return {
    ...base,
    rollout,
    manifest,
    gaps: {
      ...base.gaps,
      guestSeesNewBrain:
        rollout.mode === "denis_only" && rollout.narrateWithLlm,
    },
  };
}

export { computeDenisSystemStatusEval };
