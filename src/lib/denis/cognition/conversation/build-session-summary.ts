import type { ConversationModel } from "@/lib/denis/cognition/conversation/conversation-types";
import { isGuestMisunderstandingDecline } from "@/lib/denis/cognition/conversation/guest-continuity";

/** Deterministic session memory for LLM — no extra model call. */
export function buildSessionSummary(model: ConversationModel): string | null {
  const parts: string[] = [];

  if (model.attention.deferCount > 0) {
    parts.push(
      model.attention.followUpDelaySeconds
        ? `Guest asked for pause; comeback in ~${Math.round(model.attention.followUpDelaySeconds / 60)} min.`
        : `Guest still browsing (${model.attention.deferCount} defer signal${model.attention.deferCount > 1 ? "s" : ""}).`
    );
  }

  if (model.awaiting === "browse_decision") {
    parts.push("Denis asked if they have decided.");
  } else if (model.awaiting === "confirm") {
    parts.push("Denis awaiting order confirmation.");
  } else if (model.awaiting === "serve_size" || model.awaiting === "modifier") {
    parts.push(`Denis awaiting ${model.awaiting} answer.`);
  } else if (model.awaiting === "recommendation_pick") {
    parts.push("Denis offered a choice — guest should pick or defer.");
  } else if (model.awaiting === "product") {
    parts.push("Denis asked which product — guest should name one.");
  }

  if (model.thread.lastDenisText) {
    parts.push(`Last Denis: "${model.thread.lastDenisText.slice(0, 100)}".`);
  }

  if (model.thread.lastGuestText) {
    parts.push(`Last guest: "${model.thread.lastGuestText.slice(0, 120)}".`);
    if (isGuestMisunderstandingDecline(model.thread.lastGuestText)) {
      parts.push("Guest said no — Denis should apologize and re-ask.");
    }
  }

  if (parts.length === 0) return null;
  return parts.join(" ");
}
