import { executeDenisOrderCommand } from "@/lib/denis/acl/execute-denis-order-command";
import { buildDenisOrderCommand } from "@/lib/denis/runtime/act/build-order-command";
import type { ActSkillResult } from "@/lib/denis/runtime/act/act-types";
import type { DenisSkillId } from "@/lib/denis/kernel/skill-registry";
import { resolveSkill } from "@/lib/denis/kernel/skill-registry";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { DenisCartDraft } from "@/lib/denis/kernel/cart-projection";
import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";

export type ExecuteSkillContext = {
  config: ConciergeConfig;
  dryRun: boolean;
  allowSubmit: boolean;
  skillId: DenisSkillId;
  aiSessionId?: string;
  tableToken?: string;
  sessionToken?: string;
  deviceFingerprint?: string;
  deviceToken?: string;
  cartDraft?: DenisCartDraft;
  catalog?: AiCatalog;
};

export async function executePlannedSkill(
  ctx: ExecuteSkillContext
): Promise<ActSkillResult> {
  const skill = resolveSkill(ctx.skillId);
  const riskClass = skill?.riskClass ?? "R0";

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

    const command = buildDenisOrderCommand({
      aiSessionId: ctx.aiSessionId,
      tableToken: ctx.tableToken,
      sessionToken: ctx.sessionToken,
      deviceFingerprint: ctx.deviceFingerprint,
      deviceToken: ctx.deviceToken,
      cartDraft: ctx.cartDraft ?? { items: [], cartRevision: 0 },
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

    const result = await executeDenisOrderCommand({
      command,
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
