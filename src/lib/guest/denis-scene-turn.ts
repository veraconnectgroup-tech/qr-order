import {
  AI_SHEET_ALLERGY_OPTIONS,
  AI_SHEET_MOOD_OPTIONS,
  apiPreferencesFromSheet,
  buildSmartMenuPrompt,
  type AiSheetAllergyId,
  type AiSheetMoodId,
  type AiSheetSelections,
} from "@/lib/ai/guest-sheet-preferences";
import { resolveGuestAiContextToken, readAiSessionIdForGuest, writeAiSessionIdForGuest } from "@/lib/ai/guest-ai-token";
import type { ProductRecommendation } from "@/components/guest/product-recommendation-card";

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

export async function postGuestWaiterCall(input: {
  tableToken: string;
  sessionToken: string;
}): Promise<void> {
  const res = await fetch("/api/waiter-calls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tableToken: input.tableToken,
      sessionToken: input.sessionToken,
    }),
  });

  if (!res.ok) {
    throw new Error("waiter-call-failed");
  }
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
}): Promise<GuestDenisTurnResult> {
  const aiContextToken = resolveGuestAiContextToken(
    input.tableToken,
    input.sessionToken
  );
  if (!aiContextToken) {
    throw new Error("session-unavailable");
  }

  const sessionId =
    readAiSessionIdForGuest(input.locationId, input.tableToken, [
      input.sessionToken,
    ]) ?? undefined;

  const preferences =
    input.preferences ??
    (input.selections
      ? apiPreferencesFromSheet(input.selections)
      : { allergies: [], mood: "" });

  const message =
    input.selections != null
      ? buildSmartMenuPrompt(input.selections)
      : input.message;

  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locationId: input.locationId,
      tableId: input.tableId,
      sessionToken: aiContextToken,
      message,
      language: input.language,
      sessionId,
      preferences,
      includeOrderContext: true,
      allowOrdering: input.allowOrdering ?? true,
      browsingContext: input.browsingContext,
    }),
  });

  const json = (await res.json()) as {
    error?: string;
    data?: {
      message: string;
      recommendations?: ProductRecommendation[];
      sessionId?: string;
    };
  };

  if (!res.ok) {
    throw new Error(json.error ?? "denis-turn-failed");
  }

  const data = json.data!;
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
    message: data.message,
  };
}
