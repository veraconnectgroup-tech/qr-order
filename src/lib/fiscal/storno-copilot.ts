const STORNO_GUEST_PATTERN =
  /\b(otka[žz]i\w*|poni[šs]t\w*|stornir\w*|storno|cancel(?:led)?|abbrechen|don't want|do not want|ne treba mi|obriši porud[žz]bin\w*|ukloni porud[žz]bin\w*|odustao|odustala|odustajem|refund|geld zur[üu]ck)\b/i;

const WRONG_ORDER_PATTERN =
  /\b(pogre[šs]n\w*|wrong order|falsch|nicht bestellt|nije moja|nije to|la[šs]no)\b/i;

export type StornoCopilotOrderContext = {
  orderId: string;
  orderNumber: number;
  tseSigned: boolean;
  hasStorno: boolean;
  paymentMethod: string;
  total: number;
};

export type StornoCopilotSignal = {
  orderId: string;
  orderNumber: number;
  reason: string;
  confidence: "high" | "medium";
  source: "guest_cancel" | "wrong_order" | "frustrated_guest";
};

export function guestRequestedStorno(message: string): boolean {
  return STORNO_GUEST_PATTERN.test(message.trim());
}

export function guestReportedWrongOrder(message: string): boolean {
  return WRONG_ORDER_PATTERN.test(message.trim());
}

/** Denis detects order problems → storno suggestion for staff approval. */
export function detectStornoCopilotSignal(input: {
  recentGuestMessages: string[];
  sessionOrder: StornoCopilotOrderContext | null | undefined;
  guestFrustrated?: boolean;
}): StornoCopilotSignal | null {
  const order = input.sessionOrder;
  if (!order || !order.tseSigned || order.hasStorno) {
    return null;
  }

  const messages = input.recentGuestMessages.map((m) => m.trim()).filter(Boolean);
  const cancelMessage = messages.find((message) => guestRequestedStorno(message));
  if (cancelMessage) {
    return {
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      reason: cancelMessage.slice(0, 200),
      confidence: "high",
      source: "guest_cancel",
    };
  }

  const wrongOrderMessage = messages.find((message) =>
    guestReportedWrongOrder(message)
  );
  if (wrongOrderMessage) {
    return {
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      reason: wrongOrderMessage.slice(0, 200),
      confidence: "high",
      source: "wrong_order",
    };
  }

  if (input.guestFrustrated && messages.length >= 2) {
    return {
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      reason: "Gost frustriran — provjeri da li treba storno/refund.",
      confidence: "medium",
      source: "frustrated_guest",
    };
  }

  return null;
}

export function formatStornoCopilotMessage(
  signal: StornoCopilotSignal,
  tableName: string
): string {
  return `Sto ${tableName} — predloži storno #${signal.orderNumber} (staff odobrenje)`;
}

export function stornoApprovalPath(orderId: string): string {
  return `/api/orders/${orderId}/storno`;
}
