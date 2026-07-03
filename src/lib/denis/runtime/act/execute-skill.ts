import { createAdminClient } from "@/lib/supabase/admin";
import { ensureTrustedDeviceForDenisSubmit } from "@/lib/denis/runtime/act/ensure-trusted-device";
import { executeDenisGuestOrderCancel } from "@/lib/denis/acl/execute-denis-guest-order-cancel";
import { executeDenisOrderModifyRequest } from "@/lib/denis/acl/execute-denis-order-modify-request";
import { executeDenisPaymentHandoff } from "@/lib/denis/acl/execute-denis-payment-handoff";
import { executeDenisWaiterHandoff } from "@/lib/denis/acl/execute-denis-waiter-handoff";
import { executeDenisOrderCommand } from "@/lib/denis/acl/execute-denis-order-command";
import {
  buildDenisOrderCommand,
  reconcileCartDraftPricesFromCatalog,
} from "@/lib/denis/runtime/act/build-order-command";
import type { ActSkillResult } from "@/lib/denis/runtime/act/act-types";
import type { DenisSkillId } from "@/lib/denis/kernel/skill-registry";
import { resolveSkill } from "@/lib/denis/kernel/skill-registry";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { DenisCartDraft } from "@/lib/denis/kernel/cart-projection";
import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";
import type { SelectablePaymentMethod } from "@/lib/payment-methods";

export type ExecuteSkillContext = {
  config: ConciergeConfig;
  dryRun: boolean;
  allowSubmit: boolean;
  liveHandoff: boolean;
  skillId: DenisSkillId;
  aiSessionId?: string;
  tableId?: string;
  locationId?: string;
  tableToken?: string;
  sessionToken?: string;
  deviceFingerprint?: string;
  deviceToken?: string;
  cartDraft?: DenisCartDraft;
  catalog?: AiCatalog;
  handoffPaymentMethod?: SelectablePaymentMethod | null;
};

export async function executePlannedSkill(
  ctx: ExecuteSkillContext
): Promise<ActSkillResult> {
  const skill = resolveSkill(ctx.skillId);
  const riskClass = skill?.riskClass ?? "R0";

  if (ctx.skillId === "handoff.waiter") {
    if (!ctx.liveHandoff || !ctx.config.handoff.waiterCall) {
      return {
        skillId: ctx.skillId,
        riskClass,
        dryRun: true,
        ok: true,
        detail: { previewOnly: true, reason: "handoff_disabled" },
      };
    }

    if (!ctx.tableId || !ctx.locationId || !ctx.tableToken) {
      return {
        skillId: ctx.skillId,
        riskClass,
        dryRun: false,
        ok: false,
        error: "missing_handoff_context",
      };
    }

    const admin = createAdminClient();
    const result = await executeDenisWaiterHandoff(admin, {
      tableId: ctx.tableId,
      locationId: ctx.locationId,
      tableToken: ctx.tableToken,
      sessionToken: ctx.sessionToken,
    });

    if (!result.ok) {
      return {
        skillId: ctx.skillId,
        riskClass,
        dryRun: false,
        ok: false,
        error: result.error,
      };
    }

    return {
      skillId: ctx.skillId,
      riskClass,
      dryRun: false,
      ok: true,
      detail: { tableName: result.tableName },
    };
  }

  if (ctx.skillId === "handoff.payment") {
    if (!ctx.liveHandoff || !ctx.config.handoff.paymentHint) {
      return {
        skillId: ctx.skillId,
        riskClass,
        dryRun: true,
        ok: true,
        detail: { previewOnly: true, reason: "handoff_disabled" },
      };
    }

    if (!ctx.tableId || !ctx.locationId || !ctx.sessionToken) {
      return {
        skillId: ctx.skillId,
        riskClass,
        dryRun: false,
        ok: false,
        error: "missing_handoff_context",
      };
    }

    const admin = createAdminClient();
    const result = await executeDenisPaymentHandoff(admin, {
      tableId: ctx.tableId,
      locationId: ctx.locationId,
      sessionToken: ctx.sessionToken,
      paymentMethod: ctx.handoffPaymentMethod ?? null,
    });

    if (!result.ok) {
      return {
        skillId: ctx.skillId,
        riskClass,
        dryRun: false,
        ok: false,
        error: result.error,
      };
    }

    if (result.needsMethod) {
      return {
        skillId: ctx.skillId,
        riskClass,
        dryRun: false,
        ok: true,
        detail: { needsMethod: true },
      };
    }

    return {
      skillId: ctx.skillId,
      riskClass,
      dryRun: false,
      ok: true,
      detail: {
        needsMethod: false,
        paymentMethod: result.paymentMethod,
        openPaymentSheet: result.openPaymentSheet ?? false,
      },
    };
  }

  if (ctx.skillId === "order.cancel") {
    if (!ctx.tableId || !ctx.locationId || !ctx.sessionToken) {
      return {
        skillId: ctx.skillId,
        riskClass,
        dryRun: ctx.dryRun,
        ok: false,
        error: "missing_order_change_context",
      };
    }

    if (ctx.dryRun) {
      return {
        skillId: ctx.skillId,
        riskClass,
        dryRun: true,
        ok: true,
        detail: { previewOnly: true },
      };
    }

    const admin = createAdminClient();
    const result = await executeDenisGuestOrderCancel(admin, {
      tableId: ctx.tableId,
      locationId: ctx.locationId,
      sessionToken: ctx.sessionToken,
    });

    if (!result.ok) {
      return {
        skillId: ctx.skillId,
        riskClass,
        dryRun: false,
        ok: false,
        error: result.error,
      };
    }

    return {
      skillId: ctx.skillId,
      riskClass,
      dryRun: false,
      ok: true,
      detail: {
        kind: result.kind,
        orderNumber:
          result.kind === "cancelled" ? result.orderNumber : result.orderNumber,
        orderId: result.kind === "cancelled" ? result.orderId : undefined,
      },
    };
  }

  if (ctx.skillId === "order.modify.request") {
    if (
      !ctx.tableId ||
      !ctx.locationId ||
      !ctx.sessionToken ||
      !ctx.tableToken
    ) {
      return {
        skillId: ctx.skillId,
        riskClass,
        dryRun: ctx.dryRun,
        ok: false,
        error: "missing_order_change_context",
      };
    }

    if (ctx.dryRun) {
      return {
        skillId: ctx.skillId,
        riskClass,
        dryRun: true,
        ok: true,
        detail: { previewOnly: true },
      };
    }

    const admin = createAdminClient();
    const result = await executeDenisOrderModifyRequest(admin, {
      tableId: ctx.tableId,
      locationId: ctx.locationId,
      tableToken: ctx.tableToken,
      sessionToken: ctx.sessionToken,
    });

    if (!result.ok) {
      return {
        skillId: ctx.skillId,
        riskClass,
        dryRun: false,
        ok: false,
        error: result.error,
      };
    }

    return {
      skillId: ctx.skillId,
      riskClass,
      dryRun: false,
      ok: true,
      detail: {
        kind: result.kind,
        orderNumber: result.orderNumber,
      },
    };
  }

  if (ctx.skillId === "order.submit") {
    if (!ctx.aiSessionId || !ctx.tableToken || !ctx.deviceFingerprint) {
      return {
        skillId: ctx.skillId,
        riskClass,
        dryRun: ctx.dryRun,
        ok: false,
        error: "missing_submit_context",
      };
    }

    const rawCart = ctx.cartDraft ?? { items: [], cartRevision: 0 };
    const pricedCart =
      ctx.catalog != null
        ? reconcileCartDraftPricesFromCatalog(rawCart, ctx.catalog)
        : rawCart;

    const command = buildDenisOrderCommand({
      aiSessionId: ctx.aiSessionId,
      tableToken: ctx.tableToken,
      sessionToken: ctx.sessionToken,
      deviceFingerprint: ctx.deviceFingerprint,
      deviceToken: ctx.deviceToken,
      cartDraft: pricedCart,
    });

    if (!command) {
      return {
        skillId: ctx.skillId,
        riskClass,
        dryRun: ctx.dryRun,
        ok: false,
        error: "empty_cart",
      };
    }

    if (ctx.dryRun || !ctx.allowSubmit || !ctx.catalog) {
      return {
        skillId: ctx.skillId,
        riskClass,
        dryRun: true,
        ok: true,
        detail: {
          lineCount: command.lines.length,
          idempotencyKey: command.idempotencyKey,
          previewOnly: true,
        },
      };
    }

    const admin = createAdminClient();
    const trusted = await ensureTrustedDeviceForDenisSubmit(admin, {
      tableToken: ctx.tableToken!,
      sessionToken: ctx.sessionToken,
      deviceFingerprint: ctx.deviceFingerprint,
      deviceToken: ctx.deviceToken,
    });
    if ("error" in trusted) {
      return {
        skillId: ctx.skillId,
        riskClass,
        dryRun: false,
        ok: false,
        error: trusted.error,
      };
    }

    const trustedCommand = {
      ...command,
      sessionToken: trusted.sessionToken,
      deviceToken: trusted.deviceToken,
    };

    const result = await executeDenisOrderCommand({
      command: trustedCommand,
      catalog: ctx.catalog,
    });

    if (!result.ok) {
      return {
        skillId: ctx.skillId,
        riskClass,
        dryRun: false,
        ok: false,
        error: result.error,
        detail: { status: result.status },
      };
    }

    return {
      skillId: ctx.skillId,
      riskClass,
      dryRun: false,
      ok: true,
      detail: {
        orderId: result.data.orderId,
        orderNumber: result.data.orderNumber,
        awaitingApproval: result.data.awaitingApproval ?? false,
        sessionOpened: result.data.sessionOpened ?? null,
        idempotentReplay: result.idempotentReplay ?? false,
      },
    };
  }

  return {
    skillId: ctx.skillId,
    riskClass,
    dryRun: ctx.dryRun,
    ok: true,
    detail: { noop: true, reason: "act_shadow_only" },
  };
}
