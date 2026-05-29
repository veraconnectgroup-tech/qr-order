import { apiSuccess } from "@/lib/api-response";
import type { DenisTurnMeta } from "@/lib/denis/runtime/turn-types";
import { formatDenisApiMeta } from "@/lib/denis/surfaces/format-denis-api-meta";

export type LegacyChatSuccessData = {
  message: string;
  recommendations?: unknown[];
  cartActions?: unknown[];
  quickReplies?: string[];
  intent?: string;
  submitOrder?: boolean;
  creditsRemaining?: number;
  sessionId?: string;
  orderSubmit?: {
    orderId: string;
    orderNumber?: number;
    awaitingApproval?: boolean;
    sessionOpened?: {
      sessionId: string;
      sessionToken: string;
      deviceToken: string;
      tablePin?: string;
    };
  };
  /** M28 — guest should open session bill sheet (online pay). */
  openPaymentSheet?: boolean;
};

/** L4 — chat API envelope (no business logic). */
export function formatChatTurnApiResponse(
  data: LegacyChatSuccessData,
  meta: DenisTurnMeta
) {
  return apiSuccess({
    ...data,
    denis: formatDenisApiMeta(meta),
  });
}
