import type { DenisRolloutFormState } from "@/lib/denis/config/rollout-cutover";
import type { ConciergeRolloutMode } from "@/lib/denis/config/rollout";

export type GaGateMetrics = {
  /** Shadow parity 0–100 from logs or eval; omit if unknown. */
  shadowParityPct?: number | null;
  /** Latest eval suite pass for this location/org. */
  recentEvalPass?: boolean | null;
};

export type GaGateCheck = {
  id: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  detail?: string;
};

export type GaGateReport = {
  ready: boolean;
  checks: GaGateCheck[];
  /** Suggested next rollout mode for ops (informational). */
  recommendedNextMode: ConciergeRolloutMode | null;
};

const MODE_ORDER: ConciergeRolloutMode[] = [
  "legacy",
  "shadow",
  "canary",
  "denis_only",
];

function nextRolloutMode(
  mode: ConciergeRolloutMode
): ConciergeRolloutMode | null {
  const idx = MODE_ORDER.indexOf(mode);
  if (idx < 0 || idx >= MODE_ORDER.length - 1) return null;
  return MODE_ORDER[idx + 1] ?? null;
}

function check(
  id: string,
  label: string,
  passed: boolean,
  blocking: boolean,
  detail?: string
): GaGateCheck {
  return { id, label, passed, blocking, detail };
}

/**
 * ADR-010 F8-1 — deterministic promotion readiness for admin rollout UI.
 * Does not block saves; surfaces blocking checks before risky cutover.
 */
export function evaluateGaGate(
  form: DenisRolloutFormState,
  metrics: GaGateMetrics = {}
): GaGateReport {
  const checks: GaGateCheck[] = [];
  const { rolloutMode } = form;

  if (rolloutMode === "legacy") {
    checks.push(
      check(
        "legacy-exit",
        "Move to shadow before Denis guest path",
        false,
        false,
        "Use a shadow preset to enable kernel + timeline."
      )
    );
  }

  if (rolloutMode !== "legacy") {
    checks.push(
      check(
        "timeline-on",
        "Kernel timeline enabled for this mode",
        rolloutMode === "shadow" ||
          rolloutMode === "canary" ||
          rolloutMode === "denis_only",
        true
      )
    );
  }

  if (rolloutMode === "canary" || rolloutMode === "denis_only") {
    checks.push(
      check(
        "narrate-with-llm",
        "Denis narration (narrateWithLlm) enabled",
        form.narrateWithLlm,
        rolloutMode === "denis_only",
        rolloutMode === "denis_only"
          ? "Required for denis_only guest path."
          : "Recommended for canary cohort."
      )
    );
  }

  if (rolloutMode === "canary" || rolloutMode === "denis_only") {
    const parity = metrics.shadowParityPct;
    if (parity != null && Number.isFinite(parity)) {
      checks.push(
        check(
          "shadow-parity",
          "Shadow parity ≥ 99%",
          parity >= 99,
          rolloutMode === "denis_only",
          `Current: ${parity.toFixed(1)}%`
        )
      );
    } else {
      checks.push(
        check(
          "shadow-parity-unknown",
          "Shadow parity not recorded",
          rolloutMode !== "denis_only",
          rolloutMode === "denis_only",
          "Run shadow mode and review logs before denis_only."
        )
      );
    }
  }

  if (!form.legacyOrderingEnabled) {
    checks.push(
      check(
        "kernel-ordering-act",
        "Kernel ordering requires act layer enabled",
        form.actLayerEnabled,
        true,
        "Enable act layer when legacy ordering is off (F8-2)."
      )
    );
  }

  const actSubmitLive =
    form.actSubmitEnabled && form.actLayerEnabled && !form.actDryRun;

  if (actSubmitLive) {
    checks.push(
      check(
        "act-submit-mode",
        "Act submit only in denis_only rollout",
        rolloutMode === "denis_only",
        true,
        "Set rollout to denis_only before live order submit via ACL."
      )
    );
    checks.push(
      check(
        "act-submit-narrate",
        "Narrate with LLM when act submit is live",
        form.narrateWithLlm,
        true
      )
    );
    if (metrics.recentEvalPass != null) {
      checks.push(
        check(
          "eval-green",
          "Latest eval suite passed",
          metrics.recentEvalPass === true,
          true
        )
      );
    } else {
      checks.push(
        check(
          "eval-unknown",
          "Eval status unknown for act submit",
          false,
          true,
          "Run pnpm eval:denis before enabling live act submit."
        )
      );
    }
  } else if (form.actSubmitEnabled) {
    checks.push(
      check(
        "act-submit-dry-run",
        "Act submit flag set but dry-run still on",
        !form.actDryRun || !form.actLayerEnabled,
        false,
        "Enable act layer and disable dry-run only after F8-3 sign-off."
      )
    );
  }

  const blockingFailed = checks.some((c) => c.blocking && !c.passed);
  const ready = checks.length === 0 || !blockingFailed;

  return {
    ready,
    checks,
    recommendedNextMode: nextRolloutMode(rolloutMode),
  };
}
