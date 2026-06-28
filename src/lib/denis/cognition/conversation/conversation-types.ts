import type { TranscriptEntry } from "@/lib/denis/loop/view-types";
import type { ConversationAwaiting } from "@/lib/denis/cognition/beliefs/belief-types";
import type { ConversationGraph } from "@/lib/denis/cognition/conversation/conversation-graph";

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
  /** Non-linear topic graph (Prompt 93). */
  graph: ConversationGraph;
};
