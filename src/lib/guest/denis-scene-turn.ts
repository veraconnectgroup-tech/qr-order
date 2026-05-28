import {
  AI_SHEET_ALLERGY_OPTIONS,
  AI_SHEET_MOOD_OPTIONS,
  apiPreferencesFromSheet,
  buildSmartMenuPrompt,
  type AiSheetAllergyId,
  type AiSheetMoodId,
  type AiSheetSelections,
} from "@/lib/ai/guest-sheet-preferences";
import {
  legacyTokensForAiSession,
  readAiSessionIdForGuest,
  writeAiSessionIdForGuest,
} from "@/lib/ai/guest-ai-token";
import { useGuestSession } from "@/hooks/use-guest-session";
import { chipIdToHandoff } from "@/lib/denis/commands/perceive-table-guest-command";
import { postDenisMessageTurn } from "@/lib/guest/denis-signal-client";
import { requestGuestWaiterCall } from "@/lib/guest/request-waiter-call";
import type { GuestIntent } from "@/lib/denis/platform/timeline-types";
import type { ProductRecommendation } from "@/components/guest/product-recommendation-card";
import type { SelectablePaymentMethod } from "@/lib/payment-methods";

export type GuestDenisTurnResult = {
  sessionId: string | null;
  recommendations: ProductRecommendation[];
  message: string;
};

export function parseSceneChipSelections(
  chipId: string
): AiSheetSelections | null {
  if (chipId.startsWith("allergy-")) {
    const id = chipId.slice("allergy-".length) as AiSheetAllergyId;
    if (!AI_SHEET_ALLERGY_OPTIONS.some((option) => option.id === id)) {
      return null;
    }
    return { allergies: [id], mood: null };
  }

  if (chipId.startsWith("mood-")) {
    const id = chipId.slice("mood-".length) as AiSheetMoodId;
    if (!AI_SHEET_MOOD_OPTIONS.some((option) => option.id === id)) {
      return null;
    }
    return { allergies: [], mood: id };
  }

  return null;
}

/** Map scene chip to Denis structured handoff intent (M28). */
export function parseSceneHandoffChip(
  chipId: string,
  label: string
): {
  structuredIntent?: GuestIntent;
  handoffPaymentMethod?: SelectablePaymentMethod;
} | null {
  return chipIdToHandoff({ chipId, label });
}

/** @deprecated Use requestGuestWaiterCall — kept for tests. */
export async function postGuestWaiterCall(input: {
  tableToken: string;
  sessionToken?: string | null;
}): Promise<void> {
  return requestGuestWaiterCall(input);
}

/** Scene chip / banner action — Denis turn without opening the chat sheet. */
export async function runGuestDenisSceneTurn(input: {
  locationId: string;
  tableId: string;
  tableToken: string;
  sessionToken: string;
  message: string;
  language: string;
  preferences?: { allergies: string[]; mood: string };
  browsingContext?: string;
  selections?: AiSheetSelections;
  allowOrdering?: boolean;
  structuredIntent?: GuestIntent;
  handoffPaymentMethod?: SelectablePaymentMethod;
}): Promise<GuestDenisTurnResult> {
  const sessionId =
    readAiSessionIdForGuest(
      input.locationId,
      input.tableToken,
      legacyTokensForAiSession(
        input.tableId,
        input.sessionToken,
        useGuestSession.getState().tableId
      )
    ) ?? undefined;

  const preferences =
    input.preferences ??
    (input.selections
      ? apiPreferencesFromSheet(input.selections)
      : { allergies: [], mood: "" });

  const message =
    input.selections != null
      ? buildSmartMenuPrompt(input.selections)
      : input.message;

  const res = await postDenisMessageTurn({
    tableToken: input.tableToken,
    tableSessionToken: input.sessionToken,
    locationId: input.locationId,
    tableId: input.tableId,
    message,
    language: input.language,
    aiSessionId: sessionId,
    preferences,
    includeOrderContext: true,
    allowOrdering: input.allowOrdering ?? true,
    browsingContext: input.browsingContext,
    structuredIntent: input.structuredIntent,
    handoffPaymentMethod: input.handoffPaymentMethod,
  });

  const json = (await res.json()) as {
    error?: string;
    data?: {
      message?: string;
      recommendations?: ProductRecommendation[];
      sessionId?: string;
    };
  };

  if (!res.ok) {
    throw new Error(json.error ?? "denis-turn-failed");
  }

  const data = json.data ?? {};
  if (data.sessionId) {
    writeAiSessionIdForGuest(
      input.locationId,
      input.tableToken,
      data.sessionId
    );
  }

  return {
    sessionId: data.sessionId ?? null,
    recommendations: data.recommendations ?? [],
    message: data.message ?? "",
  };
}
