import type { TranscriptEntry } from "@/lib/denis/loop/view-types";
import type { ConversationAwaiting } from "@/lib/denis/cognition/beliefs/belief-types";

export type ConversationThread = {
  guestTurns: number;
  denisTurns: number;
  lastGuestText: string | null;
  lastDenisText: string | null;
  denisAskedQuestion: boolean;
};

export type ConversationAttention = {
  browsingDeferred: boolean;
  deferCount: number;
  followUpRequestedAt: string | null;
  followUpDelaySeconds: number | null;
  followUpEmitted: boolean;
};

/** Folded conversation state — single source for beliefs + FSP (C6). */
export type ConversationModel = {
  transcript: TranscriptEntry[];
  thread: ConversationThread;
  awaiting: ConversationAwaiting;
  summary: string | null;
  attention: ConversationAttention;
};
