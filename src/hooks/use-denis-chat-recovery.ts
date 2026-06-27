"use client";

import { useCallback } from "react";
import {
  bumpGuestRecoveryFailureCount,
  resolveGuestRecoveryResponse,
  type GuestRecoveryResult,
} from "@/lib/guest/denis-guest-recovery";
import { requestGuestPaymentHandoff } from "@/lib/guest/request-payment-handoff";
import { requestGuestWaiterCall } from "@/lib/guest/request-waiter-call";
import type { SceneSituation } from "@/lib/scene/types";

export function useDenisChatRecovery(input: {
  recoveryScopeKey: string;
  token: string;
  sessionToken: string | null;
  locationId: string;
  tableId: string;
  currency: string;
  cartItemCount: number;
  cartTotal: number;
  situation?: SceneSituation | null;
  tUI: (key: string) => string;
  onOpenPaymentSheet?: () => void;
}) {
  const buildRecovery = useCallback(
    (guestMessage: string, failureCount: number, language: string) =>
      resolveGuestRecoveryResponse({
        guestMessage,
        failureCount,
        language,
        situation: input.situation,
        cartItemCount: input.cartItemCount,
        cartTotal: input.cartTotal,
        currency: input.currency,
      }),
    [
      input.situation,
      input.cartItemCount,
      input.cartTotal,
      input.currency,
    ]
  );

  const fireRecoveryAction = useCallback(
    async (action: GuestRecoveryResult["action"]) => {
      if (!action) return;
      try {
        if (action.tryPaymentHandoff) {
          const result = await requestGuestPaymentHandoff({
            tableToken: input.token,
            sessionToken: input.sessionToken,
            locationId: input.locationId,
            tableId: input.tableId,
            method: action.tryPaymentHandoff,
            label: action.tryPaymentHandoff,
          });
          if (result.openPaymentSheet || action.openPaymentSheet) {
            input.onOpenPaymentSheet?.();
          }
        } else if (action.tryWaiterCall) {
          await requestGuestWaiterCall({
            tableToken: input.token,
            sessionToken: input.sessionToken,
            locationId: input.locationId,
            tableId: input.tableId,
            label: input.tUI("scene.situation.chipWaiter"),
          });
        }
      } catch {
        /* guest still sees local narration */
      }
    },
    [
      input.token,
      input.sessionToken,
      input.locationId,
      input.tableId,
      input.tUI,
      input.onOpenPaymentSheet,
    ]
  );

  const bumpFailureCount = useCallback(
    () => bumpGuestRecoveryFailureCount(input.recoveryScopeKey),
    [input.recoveryScopeKey]
  );

  return {
    buildRecovery,
    fireRecoveryAction,
    bumpFailureCount,
    recoveryScopeKey: input.recoveryScopeKey,
  };
}

export type DenisChatRecovery = ReturnType<typeof useDenisChatRecovery>;
