import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { executeDenisPaymentHandoff } from "@/lib/denis/acl/execute-denis-payment-handoff";
import { executeDenisWaiterHandoff } from "@/lib/denis/acl/execute-denis-waiter-handoff";
import type { ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";
import {
  handoffActEnabled,
  resolveActHandoffOutcome,
} from "@/lib/denis/runtime/act/resolve-act-handoff-outcome";
import type { ActHandoffOutcome } from "@/lib/denis/runtime/act/resolve-act-handoff-outcome";
import type { ActPhaseResult } from "@/lib/denis/runtime/act/act-types";
import type { DenisChatBody } from "@/lib/denis/runtime/turn-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function runHandoffAclFallback(
  admin: SupabaseClient,
  input: {
    config: ConciergeConfig;
    reflexTurn: ReflexTurnResult;
    parsed: DenisChatBody;
    language: string;
    actHandoffOutcome: ActHandoffOutcome;
  }
): Promise<ActHandoffOutcome> {
  if (input.actHandoffOutcome.attempted || !input.reflexTurn.handoffCommand) {
    return input.actHandoffOutcome;
  }
  if (!handoffActEnabled(input.config)) {
    return input.actHandoffOutcome;
  }

  const cmd = input.reflexTurn.handoffCommand;
  const sessionToken =
    input.parsed.tableSessionToken ?? input.parsed.sessionToken;

  if (cmd.type === "WAITER.REQUEST") {
    if (!input.parsed.tableId || !input.parsed.locationId) {
      return input.actHandoffOutcome;
    }
    const result = await executeDenisWaiterHandoff(admin, {
      tableId: input.parsed.tableId,
      locationId: input.parsed.locationId,
      tableToken: input.parsed.sessionToken,
      sessionToken,
    });
    const actPhase: ActPhaseResult = {
      enabled: true,
      dryRun: false,
      results: [
        {
          skillId: "handoff.waiter",
          riskClass: "R3",
          dryRun: false,
          ok: result.ok,
          error: result.ok ? undefined : result.error,
        },
      ],
    };
    return resolveActHandoffOutcome(actPhase, input.language);
  }

  if (!sessionToken || !input.parsed.tableId || !input.parsed.locationId) {
    return input.actHandoffOutcome;
  }

  const paymentMethod =
    cmd.type === "BILL.SET_METHOD"
      ? cmd.method
      : input.reflexTurn.handoffPaymentMethod ?? null;

  const result = await executeDenisPaymentHandoff(admin, {
    tableId: input.parsed.tableId,
    locationId: input.parsed.locationId,
    sessionToken,
    paymentMethod,
  });

  const actPhase: ActPhaseResult = {
    enabled: true,
    dryRun: false,
    results: [
      {
        skillId: "handoff.payment",
        riskClass: "R1",
        dryRun: false,
        ok: result.ok,
        error: result.ok ? undefined : result.error,
        detail: result.ok
          ? result.needsMethod
            ? { needsMethod: true }
            : {
                needsMethod: false,
                paymentMethod: result.paymentMethod,
                openPaymentSheet: result.openPaymentSheet ?? false,
              }
          : undefined,
      },
    ],
  };
  return resolveActHandoffOutcome(actPhase, input.language);
}
