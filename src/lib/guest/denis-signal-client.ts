import type { ClientAccessibilitySignals } from "@/lib/denis/cognition/mental-model/accessibility-types";
import type { GuestManualCartSnapshot } from "@/lib/guest/manual-cart-snapshot";
import type { DenisSignalRequest } from "@/lib/denis/ingress/signal-types";
import type { GuestIntent } from "@/lib/denis/platform/timeline-types";
import type { TableSessionView } from "@/lib/denis/loop/view-types";
import type { SelectablePaymentMethod } from "@/lib/payment-methods";
import type { ProductRecommendation } from "@/components/guest/product-recommendation-card";

export type DenisSignalResponse = {
  signalId?: string;
  ingested?: boolean;
  viewVersion?: number;
  view?: TableSessionView;
  message?: string | null;
  handoff?: unknown;
  sense?: Record<string, unknown>;
  recommendations?: ProductRecommendation[];
  sessionId?: string;
  quickReplies?: string[];
  cartActions?: unknown[];
  submitOrder?: boolean;
  voice?: { speakText: string; ttsRecommended: boolean };
  denis?: unknown;
  orderSubmit?: unknown;
  /** M28 — open session bill sheet for online payment. */
  openPaymentSheet?: boolean;
};

export type PostDenisMessageTurnInput = {
  tableToken: string;
  tableSessionToken?: string;
  locationId: string;
  tableId: string;
  message: string;
  language: string;
  aiSessionId?: string;
  preferences?: { allergies: string[]; mood: string };
  allowOrdering?: boolean;
  browsingContext?: string;
  manualCartSnapshot?: GuestManualCartSnapshot;
  deviceFingerprint?: string;
  deviceToken?: string;
  structuredIntent?: GuestIntent;
  handoffPaymentMethod?: SelectablePaymentMethod;
  surface?: "chat" | "voice";
  includeOrderContext?: boolean;
  accessibilitySignals?: ClientAccessibilitySignals;
};

export async function postDenisSignal(
  body: DenisSignalRequest
): Promise<DenisSignalResponse> {
  const res = await fetch("/api/denis/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as {
    data?: DenisSignalResponse & Record<string, unknown>;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(json.error ?? "signal_failed");
  }

  return (json.data ?? {}) as DenisSignalResponse;
}

export type DenisThinkingPreviewResponse = {
  steps: string[];
  planKind: string;
  planReason: string;
  requiresLlm: boolean;
};

/** Fast TDE preview — what Denis is working on (no LLM). */
export async function postDenisThinkingPreview(
  input: PostDenisMessageTurnInput,
  init?: RequestInit
): Promise<DenisThinkingPreviewResponse | null> {
  try {
    const res = await fetch("/api/denis/thinking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      ...init,
      body: JSON.stringify({
        type: "message",
        text: input.message,
        tableToken: input.tableToken,
        tableSessionToken: input.tableSessionToken,
        locationId: input.locationId,
        tableId: input.tableId,
        language: input.language,
        aiSessionId: input.aiSessionId,
        preferences: input.preferences,
        allowOrdering: input.allowOrdering,
        browsingContext: input.browsingContext,
        manualCartSnapshot: input.manualCartSnapshot,
        deviceFingerprint: input.deviceFingerprint,
        deviceToken: input.deviceToken,
        structuredIntent: input.structuredIntent,
        handoffPaymentMethod: input.handoffPaymentMethod,
        surface: input.surface,
        includeOrderContext: input.includeOrderContext,
      }),
    });

    const json = (await res.json()) as {
      data?: DenisThinkingPreviewResponse;
      error?: string;
    };

    if (!res.ok || !json.data?.steps?.length) return null;
    return json.data;
  } catch {
    return null;
  }
}

/** Chat/voice turn via unified signal ingress (ADR-019 Phase C). */
export async function postDenisMessageTurn(
  input: PostDenisMessageTurnInput,
  init?: RequestInit
): Promise<Response> {
  return fetch("/api/denis/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...init,
    body: JSON.stringify({
      type: "message",
      text: input.message,
      tableToken: input.tableToken,
      tableSessionToken: input.tableSessionToken,
      locationId: input.locationId,
      tableId: input.tableId,
      language: input.language,
      aiSessionId: input.aiSessionId,
      preferences: input.preferences,
      allowOrdering: input.allowOrdering,
      browsingContext: input.browsingContext,
      manualCartSnapshot: input.manualCartSnapshot,
      deviceFingerprint: input.deviceFingerprint,
      deviceToken: input.deviceToken,
      structuredIntent: input.structuredIntent,
      handoffPaymentMethod: input.handoffPaymentMethod,
      surface: input.surface,
      includeOrderContext: input.includeOrderContext,
      accessibilitySignals: input.accessibilitySignals,
    } satisfies DenisSignalRequest),
  });
}

type StreamedDoneLine = {
  type: "done";
  status: number;
  body: { data?: DenisSignalResponse & Record<string, unknown>; error?: string } | null;
};

export type DenisSignalStreamResult = {
  ok: boolean;
  status: number;
  json: { data?: DenisSignalResponse & Record<string, unknown>; error?: string };
};

/**
 * Streaming variant of `postDenisMessageTurn` — calls `onDelta` with the
 * guest-facing message text as it's generated. Resolves with the same
 * `{ok, status, json}` shape a caller would derive from the non-streaming
 * `Response` (so existing error handling keeps working unchanged), covering
 * both real NDJSON streams and the plain-JSON early-error case (e.g. rate
 * limiting, which returns before any streaming starts).
 */
export async function postDenisMessageTurnStreaming(
  input: PostDenisMessageTurnInput,
  onDelta: (text: string) => void,
  init?: RequestInit
): Promise<DenisSignalStreamResult> {
  const res = await fetch("/api/denis/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...init,
    body: JSON.stringify({
      type: "message",
      text: input.message,
      tableToken: input.tableToken,
      tableSessionToken: input.tableSessionToken,
      locationId: input.locationId,
      tableId: input.tableId,
      language: input.language,
      aiSessionId: input.aiSessionId,
      preferences: input.preferences,
      allowOrdering: input.allowOrdering,
      browsingContext: input.browsingContext,
      manualCartSnapshot: input.manualCartSnapshot,
      deviceFingerprint: input.deviceFingerprint,
      deviceToken: input.deviceToken,
      structuredIntent: input.structuredIntent,
      handoffPaymentMethod: input.handoffPaymentMethod,
      surface: input.surface,
      includeOrderContext: input.includeOrderContext,
      accessibilitySignals: input.accessibilitySignals,
      stream: true,
    } satisfies DenisSignalRequest),
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("ndjson") || !res.body) {
    // Early error before streaming started (e.g. rate limit, invalid input) —
    // a normal JSON error envelope, not the NDJSON stream.
    const json = (await res.json().catch(() => ({}))) as DenisSignalStreamResult["json"];
    return { ok: res.ok, status: res.status, json };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done: StreamedDoneLine | null = null;

  while (true) {
    const { done: streamDone, value } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      let parsed: { type?: string; text?: string } | StreamedDoneLine;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }

      if (parsed.type === "delta" && typeof (parsed as { text?: string }).text === "string") {
        onDelta((parsed as { text: string }).text);
      } else if (parsed.type === "done") {
        done = parsed as StreamedDoneLine;
      }
    }
  }

  if (!done) {
    return {
      ok: false,
      status: 500,
      json: { error: "signal_stream_incomplete" },
    };
  }

  return {
    ok: done.status >= 200 && done.status < 300,
    status: done.status,
    json: done.body ?? {},
  };
}
