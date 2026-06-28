import {
  drinkClarifySnippet,
  isGenericBeerSegment,
  type GuestSubstitutionRequest,
} from "@/lib/denis/cognition/conversation/guest-substitution";
import type { DenisCartLine } from "@/lib/denis/kernel/cart-projection";
import type { PendingSlotKind } from "@/lib/denis/platform/pending-slot-types";
import type { TranscriptEntry } from "@/lib/denis/loop/view-types";
import {
  extractOrderMessageMeta,
  isOrderPlacementMessage,
} from "@/lib/ai/ordering/order-message-backfill";
import {
  emptyWaiterObligation,
  type WaiterGap,
  type WaiterGapKind,
  type WaiterNextAction,
  type WaiterObligation,
} from "@/lib/denis/cognition/waiter/waiter-obligation-types";
import type { AllergyGuardResult } from "@/lib/denis/cognition/safety/allergy-guard";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import type { LocationPrepTimePriorsJson } from "@/lib/denis/config/prep-time-priors";
import {
  formatPerItemPrepCommunication,
  locationPrepTimePriorsFromJson,
} from "@/lib/denis/config/prep-time-priors";
import {
  estimateParallelPrepMinutes,
  type KitchenLoadSnapshot,
} from "@/lib/denis/venue/ops/kitchen-load-model";

/** Typed drink only — generic pivo/beer/bier does not close drink_unspecified (ADR-033). */
const TYPED_DRINK_IN_CART =
  /\b(pilsner|weizen|lager|radler|kisel\w*|cola|sprite|sok|juice|vino|wine|wein|espresso|latte|kafa|čaj|caj)\b/i;

export function lastOrderPlacementFromTranscript(
  transcript: TranscriptEntry[]
): string | null {
  for (let i = transcript.length - 1; i >= 0; i--) {
    const entry = transcript[i];
    if (entry.role !== "guest") continue;
    const text = entry.text.trim();
    if (text && isOrderPlacementMessage(text)) return text;
  }
  return null;
}

function lineSatisfiesDrinkGap(line: DenisCartLine): boolean {
  const name = line.productName.trim();
  if (TYPED_DRINK_IN_CART.test(name)) return true;
  if (line.menuSection === "drinks" && !isGenericBeerSegment(name)) {
    return true;
  }
  return false;
}

function cartHasDrink(lines: DenisCartLine[]): boolean {
  return lines.some(lineSatisfiesDrinkGap);
}

function formatCartLine(line: DenisCartLine): string {
  const size = line.serveSize ? ` ${line.serveSize}` : "";
  if (line.quantity === 1) return `${line.productName}${size}`.trim();
  return `${line.quantity}× ${line.productName}${size}`.trim();
}

function gapForSubstitution(
  sub: GuestSubstitutionRequest,
  lines: DenisCartLine[],
  language: string
): WaiterGap | null {
  const noted = lines.some((line) =>
    line.notes?.toLowerCase().includes(sub.insteadOf.toLowerCase())
  );
  if (noted) return null;
  const lang = language.slice(0, 2);
  const prompt =
    lang === "de"
      ? `Hinweis: ${sub.requested} statt ${sub.insteadOf} — ich gebe das an die Küche weiter.`
      : lang === "en"
        ? `Note: ${sub.requested} instead of ${sub.insteadOf} — I'll pass that to the kitchen.`
        : `Napomena: ${sub.requested} umesto ${sub.insteadOf} — proveravam sa kuhinjom.`;
  return { kind: "substitution_note", prompt };
}

function gapForPendingSlot(
  slot: PendingSlotKind,
  language: string
): WaiterGap {
  const lang = language.slice(0, 2);
  if (slot === "serve_size") {
    return {
      kind: "serve_size",
      prompt:
        lang === "de"
          ? "Welche Größe soll es sein — 0.3L oder 0.5L?"
          : lang === "en"
            ? "What size — 0.3L or 0.5L?"
            : "Koju veličinu — 0.3L ili 0.5L?",
    };
  }
  return {
    kind: "modifier",
    prompt:
      lang === "de"
        ? "Welche Variante möchten Sie?"
        : lang === "en"
          ? "Which option would you like?"
          : "Koju varijantu želite?",
  };
}

function learnedSubstitutionGaps(
  patterns: unknown,
  lines: DenisCartLine[],
  language: string
): WaiterGap[] {
  if (!Array.isArray(patterns)) return [];
  const out: WaiterGap[] = [];

  for (const line of lines) {
    const pattern = patterns.find((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const row = entry as Record<string, unknown>;
      return (
        row.productId === line.productId &&
        typeof row.original === "string" &&
        typeof row.replacement === "string" &&
        Number(row.percentage) >= 0.5
      );
    }) as Record<string, unknown> | undefined;

    if (!pattern) continue;
    const original = String(pattern.original);
    const replacement = String(pattern.replacement);
    const notes = line.notes?.toLowerCase() ?? "";
    if (
      notes.includes(original.toLowerCase()) ||
      notes.includes(replacement.toLowerCase())
    ) {
      continue;
    }

    const lang = language.slice(0, 2);
    out.push({
      kind: "serve_size",
      prompt:
        lang === "de"
          ? `Mit ${original} oder ${replacement}?`
          : lang === "en"
            ? `With ${original} or ${replacement}?`
            : `Sa ${original} ili ${replacement}?`,
    });
  }

  return out;
}

function guestMemoryModifierGaps(
  memory: GuestMemoryProjection | null | undefined,
  lines: DenisCartLine[],
  language: string
): WaiterGap[] {
  const prefs = (memory?.modifierPreferences ?? [])
    .map((pref) => pref.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (prefs.length === 0 || lines.length === 0) return [];

  const notes = lines.map((line) => line.notes?.toLowerCase() ?? "").join(" ");
  const missing = prefs.filter((pref) => !notes.includes(pref.toLowerCase()));
  if (missing.length === 0) return [];

  const lang = language.slice(0, 2);
  return [
    {
      kind: "modifier",
      prompt:
        lang === "de"
          ? `Wie beim letzten Mal: ${missing.join(", ")}?`
          : lang === "en"
            ? `Like last time: ${missing.join(", ")}?`
            : `Kao prošli put: ${missing.join(", ")}?`,
    },
  ];
}

function mergeMessageMeta(messages: Array<string | null | undefined>) {
  let substitution: GuestSubstitutionRequest | null = null;
  let needsDrinkClarify = false;

  for (const raw of messages) {
    const text = raw?.trim();
    if (!text || !isOrderPlacementMessage(text)) continue;
    const meta = extractOrderMessageMeta(text);
    if (meta.substitution && !substitution) substitution = meta.substitution;
    if (meta.needsDrinkClarify) needsDrinkClarify = true;
  }

  return { substitution, needsDrinkClarify };
}

function resolveNextAction(input: {
  gaps: WaiterGap[];
  cartCount: number;
  atRecap: boolean;
  pendingSlot: PendingSlotKind | null;
}): WaiterNextAction {
  if (input.pendingSlot) return "await_slot";
  if (input.gaps.length > 0) return "clarify_gap";
  if (input.atRecap && input.cartCount > 0) return "confirm_order";
  if (input.cartCount > 0) return "continue_ordering";
  return "continue_browse";
}

function buildPrepTimeCommunication(
  input: AssessWaiterObligationInput
): string | null {
  if (!input.prepTimePriorsJson || input.cartLines.length === 0) return null;

  const priors = locationPrepTimePriorsFromJson(input.prepTimePriorsJson);

  const estimate = estimateParallelPrepMinutes({
    items: input.cartLines.map((line) => ({
      productId: line.productId,
      productName: line.productName,
      menuSection: line.menuSection ?? null,
    })),
    priors,
    load: input.kitchenLoad ?? null,
  });

  const perItem = estimate.perItem
    .filter((row) => row.etaMinutes > 0)
    .map((row) => ({
      productName: row.productName,
      etaMinutes: row.etaMinutes,
    }));

  if (perItem.length === 0) return null;

  return formatPerItemPrepCommunication({
    perItem,
    language: input.language,
  });
}

export type AssessWaiterObligationInput = {
  guestMessage?: string | null;
  orderContextMessage?: string | null;
  cartLines: DenisCartLine[];
  pendingSlot: PendingSlotKind | null;
  language: string;
  atRecap?: boolean;
  allergyGuard?: AllergyGuardResult | null;
  allergyAcknowledged?: boolean;
  substitutionPatterns?: unknown;
  guestMemory?: GuestMemoryProjection | null;
  kitchenLoad?: KitchenLoadSnapshot | null;
  prepTimePriorsJson?: LocationPrepTimePriorsJson | null;
};
/**
 * ADR-032 — deterministic waiter contract from cart + order context.
 * Gaps persist until cart has a typed drink — generic pivo/beer does not close drink_unspecified.
 */
export function assessWaiterObligation(
  input: AssessWaiterObligationInput
): WaiterObligation {
  const lines = input.cartLines;
  const inCart = lines.map(formatCartLine);
  const { substitution, needsDrinkClarify } = mergeMessageMeta([
    input.orderContextMessage,
    input.guestMessage,
  ]);

  const gaps: WaiterGap[] = [];

  if (input.pendingSlot) {
    gaps.push(gapForPendingSlot(input.pendingSlot, input.language));
  }

  if (needsDrinkClarify && !cartHasDrink(lines)) {
    gaps.push({
      kind: "drink_unspecified",
      prompt: drinkClarifySnippet(input.language),
    });
  }

  if (substitution) {
    const subGap = gapForSubstitution(substitution, lines, input.language);
    if (subGap) gaps.push(subGap);
  }

  gaps.push(
    ...learnedSubstitutionGaps(
      input.substitutionPatterns,
      lines,
      input.language
    )
  );
  gaps.push(...guestMemoryModifierGaps(input.guestMemory, lines, input.language));

  if (
    input.allergyGuard &&
    !input.allergyGuard.safe &&
    !input.allergyAcknowledged
  ) {
    gaps.push({
      kind: "allergy_warning",
      prompt:
        input.allergyGuard.message ??
        "Allergy warning: please review this with staff before ordering.",
    });
  }

  const primaryGap = gaps[0]?.kind ?? null;
  const cartCount = lines.length;
  const atRecap = input.atRecap === true;
  const canConfirm = cartCount > 0 && gaps.length === 0 && !input.pendingSlot;

  if (!canConfirm && atRecap && cartCount > 0 && gaps.length > 0) {
    // Recap with holes — Denis must clarify before kitchen.
  }

  const nextAction = resolveNextAction({
    gaps,
    cartCount,
    atRecap,
    pendingSlot: input.pendingSlot,
  });

  if (!lines.length && !gaps.length) {
    return emptyWaiterObligation();
  }

  const understood: string[] = [];
  if (substitution) {
    understood.push(`${substitution.requested} umesto ${substitution.insteadOf}`);
  }
  if (needsDrinkClarify) {
    understood.push("piće (tip nije preciziran)");
  }

  return {
    understood,
    inCart,
    gaps,
    nextAction,
    canConfirm,
    primaryGap,
    prepTimeCommunication: buildPrepTimeCommunication(input),
  };
}

export function obligationToBeliefs(obligation: WaiterObligation) {
  return {
    gapCount: obligation.gaps.length,
    canConfirm: obligation.canConfirm,
    primaryGap: obligation.primaryGap,
    nextAction: obligation.nextAction,
  };
}

export function waiterGapTemplateKey(
  primaryGap: WaiterGapKind | null
): string {
  if (primaryGap === "drink_unspecified") return "waiter.gap_clarify.drink";
  if (primaryGap === "serve_size") return "waiter.gap_clarify.serve_size";
  if (primaryGap === "substitution_note") return "waiter.gap_clarify.substitution";
  return "waiter.gap_clarify.generic";
}
