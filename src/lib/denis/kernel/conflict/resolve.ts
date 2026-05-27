import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { DenisCartDraft, DenisCartLine } from "@/lib/denis/kernel/cart-projection";
import { detectCartConflicts } from "@/lib/denis/kernel/conflict/detect";
import {
  cloneLine,
  lineFingerprint,
  unitPrice,
} from "@/lib/denis/kernel/conflict/line-match";
import {
  buildConflictGuestPrompt,
  buildConflictSummary,
} from "@/lib/denis/kernel/conflict/prompts";
import type {
  ConflictResolution,
  ResolutionStrategy,
  UnifiedCartView,
} from "@/lib/denis/kernel/conflict/types";
import { combineManualDrafts } from "@/lib/denis/venue/party/merge-peer-manual";
import { buildPeerAddedPrompt } from "@/lib/denis/venue/party/peer-prompts";

export type ResolveCartConflictInput = {
  ai: DenisCartDraft;
  manual: DenisCartDraft;
  peerManual?: DenisCartDraft;
  config: Pick<ConciergeConfig, "context">;
  strategyOverride?: ResolutionStrategy;
};

function resolveStrategy(
  config: Pick<ConciergeConfig, "context">,
  override?: ResolutionStrategy
): ResolutionStrategy {
  if (override) return override;
  if (!config.context.manualCart) return "prefer_ai_for_submit";
  return "offer_merge_recap";
}

/** Build hypothetical merge preview — sum qty for matching lines, union unique lines. */
export function buildProposedMerge(
  ai: DenisCartDraft,
  manual: DenisCartDraft,
  strategy: ResolutionStrategy
): DenisCartLine[] {
  if (strategy === "prefer_ai_for_submit") {
    return ai.items.map(cloneLine);
  }
  if (strategy === "manual_authoritative") {
    return manual.items.map(cloneLine);
  }

  const merged = new Map<string, DenisCartLine>();

  for (const line of manual.items) {
    merged.set(lineFingerprint(line), cloneLine(line));
  }

  for (const aiLine of ai.items) {
    const fp = lineFingerprint(aiLine);
    const existing = merged.get(fp);
    if (!existing) {
      merged.set(fp, cloneLine(aiLine));
      continue;
    }

    const qty = existing.quantity + aiLine.quantity;
    const price = unitPrice(existing);
    merged.set(fp, {
      ...existing,
      quantity: qty,
      lineTotal: Number((price * qty).toFixed(2)),
    });
  }

  return [...merged.values()];
}

function buildUnifiedView(
  ai: DenisCartDraft,
  manual: DenisCartDraft,
  strategy: ResolutionStrategy,
  conflicts: ReturnType<typeof detectCartConflicts>
): UnifiedCartView {
  const hasConflict = conflicts.length > 0;
  const proposedMerge = hasConflict
    ? buildProposedMerge(ai, manual, strategy)
    : buildProposedMerge(ai, manual, "offer_merge_recap");

  let primaryLines: DenisCartLine[];
  switch (strategy) {
    case "manual_authoritative":
      primaryLines = manual.items;
      break;
    case "prefer_ai_for_submit":
      primaryLines = ai.items;
      break;
    default:
      primaryLines = hasConflict ? manual.items : proposedMerge;
  }

  return {
    aiLines: ai.items.map(cloneLine),
    manualLines: manual.items.map(cloneLine),
    proposedMerge: hasConflict ? proposedMerge.map(cloneLine) : null,
    summary: hasConflict
      ? buildConflictSummary(conflicts)
      : `unified:${primaryLines.length}_lines`,
  };
}

/** M6 — one reality for guest (ADR-004 §6). Never silently merge. */
export function resolveCartConflict(
  input: ResolveCartConflictInput
): ConflictResolution {
  const strategy = resolveStrategy(input.config, input.strategyOverride);
  const peerManual = input.peerManual;
  const effectiveManual =
    peerManual?.items.length
      ? combineManualDrafts(input.manual, peerManual)
      : input.manual;

  const conflicts = detectCartConflicts(input.ai, effectiveManual);
  const hasConflict = conflicts.length > 0;

  const unifiedView = buildUnifiedView(
    input.ai,
    effectiveManual,
    strategy,
    conflicts
  );

  let guestPrompt: string | null = null;
  if (hasConflict) {
    if (strategy === "offer_merge_recap") {
      guestPrompt = buildConflictGuestPrompt(conflicts);
    } else if (strategy === "manual_authoritative") {
      guestPrompt = buildConflictGuestPrompt(
        conflicts.filter((c) => c.kind === "ai_only" || c.kind === "duplicate_line")
      );
    }
  }

  if (peerManual?.items.length) {
    const peerConflicts = detectCartConflicts(input.ai, peerManual);
    const peerLines: DenisCartLine[] = peerConflicts
      .filter(
        (conflict): conflict is Extract<typeof conflict, { kind: "manual_only" }> =>
          conflict.kind === "manual_only"
      )
      .map((conflict) => conflict.line);
    const peerPrompt = buildPeerAddedPrompt(peerLines);
    if (peerPrompt) {
      guestPrompt = peerPrompt;
    }
  }

  return {
    conflicts,
    strategy,
    guestPrompt,
    unifiedView,
    hasConflict,
  };
}
