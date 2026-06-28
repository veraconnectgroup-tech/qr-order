import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { AiStructuredResponse } from "@/lib/ai/types";
import {
  applySafetyGuard,
  applyToneGuard,
  buildAllergyPreSkillBlock,
  buildCartStatePreSkillBlock,
  buildMenuFilterPreSkillBlock,
  formatPrice,
} from "@/lib/denis/kernel/safety/tone-guard";
import type { ConversationLeadershipContext } from "@/lib/ai/conversation-leadership";
import {
  DEFAULT_POST_PIPELINE_SKILLS,
  DEFAULT_PRE_PIPELINE_SKILLS,
  type PipelineSkillId,
  resolveActivePipelineSkills,
} from "@/lib/denis/kernel/skill-registry";

export type PipelineSkillTrace = {
  id: PipelineSkillId;
  phase: "pre" | "post";
  action: string;
  detail?: string;
};

export type PreSkillPipelineInput = {
  config: ConciergeConfig;
  guestMessage: string;
  language: string;
  allergyLabels?: string[];
  allergyGuardMessage?: string | null;
  cartDraftText?: string;
  unavailableProductIds?: string[];
  catalog?: Record<string, AiCatalogProduct>;
  /** Reflex/T0 hints — enrich prompt, never skip LLM */
  reflexIntent?: string | null;
};

export type PreSkillPipelineResult = {
  promptBlocks: string[];
  fired: PipelineSkillTrace[];
};

export type PostSkillPipelineInput = {
  config: ConciergeConfig;
  structured: AiStructuredResponse;
  language: string;
  guestMessage: string;
  catalog?: Record<string, AiCatalogProduct>;
  productMap?: Record<string, { id: string; name: string; price: number }>;
  currency?: string;
  leadershipContext?: ConversationLeadershipContext;
};

export type PostSkillPipelineResult = {
  structured: AiStructuredResponse;
  fired: PipelineSkillTrace[];
};

function activePreSkills(config: ConciergeConfig): PipelineSkillId[] {
  const { pre } = resolveActivePipelineSkills(config);
  return pre.length ? pre : DEFAULT_PRE_PIPELINE_SKILLS;
}

function activePostSkills(config: ConciergeConfig): PipelineSkillId[] {
  const { post } = resolveActivePipelineSkills(config);
  return post.length ? post : DEFAULT_POST_PIPELINE_SKILLS;
}

/** Pre-skills: enrich LLM context before perceive call. */
export function runPreSkillPipeline(
  input: PreSkillPipelineInput
): PreSkillPipelineResult {
  const fired: PipelineSkillTrace[] = [];
  const promptBlocks: string[] = [];
  const skills = activePreSkills(input.config);

  for (const skillId of skills) {
    if (skillId === "pre.allergy_guard") {
      const block = buildAllergyPreSkillBlock({
        allergyLabels: input.allergyLabels ?? [],
        guardMessage: input.allergyGuardMessage,
      });
      if (block) {
        promptBlocks.push(block);
        fired.push({
          id: skillId,
          phase: "pre",
          action: "inject_allergy_context",
          detail: input.allergyLabels?.join(", "),
        });
      }
      continue;
    }

    if (skillId === "pre.cart_state") {
      const block = buildCartStatePreSkillBlock(input.cartDraftText ?? "");
      if (block) {
        promptBlocks.push(block);
        fired.push({
          id: skillId,
          phase: "pre",
          action: "inject_cart_state",
        });
      }
      continue;
    }

    if (skillId === "pre.menu_filter") {
      const catalog = input.catalog ?? {};
      const unavailable = (input.unavailableProductIds ?? [])
        .map((id) => catalog[id]?.name)
        .filter((name): name is string => Boolean(name));
      const block = buildMenuFilterPreSkillBlock(unavailable);
      if (block) {
        promptBlocks.push(block);
        fired.push({
          id: skillId,
          phase: "pre",
          action: "filter_unavailable_menu",
          detail: unavailable.join(", "),
        });
      }
    }
  }

  if (input.reflexIntent && input.reflexIntent !== "UNKNOWN") {
    promptBlocks.push(
      `REFLEX HINT (pipeline — does not skip LLM): guest reflex intent=${input.reflexIntent}`
    );
  }

  return { promptBlocks, fired };
}

/** Post-skills: validate/enhance LLM output — never replace non-trivial turns pre-emptively. */
export function runPostSkillPipeline(
  input: PostSkillPipelineInput
): PostSkillPipelineResult {
  const fired: PipelineSkillTrace[] = [];
  let structured = input.structured;
  const skills = activePostSkills(input.config);

  for (const skillId of skills) {
    if (skillId === "post.order_validator") {
      const catalog = input.catalog ?? {};
      const validIds = new Set(Object.keys(catalog));
      const before = structured.proposedItems.length;
      const filtered = structured.proposedItems.filter((item) =>
        validIds.has(item.productId)
      );
      if (filtered.length !== before) {
        structured = { ...structured, proposedItems: filtered };
        fired.push({
          id: skillId,
          phase: "post",
          action: "drop_invalid_proposed_items",
          detail: `${before - filtered.length} removed`,
        });
      }
      continue;
    }

    if (skillId === "post.price_check") {
      const productMap = input.productMap ?? {};
      const currency = input.currency ?? "EUR";
      let message = structured.message;
      let corrected = false;

      for (const product of Object.values(productMap)) {
        const wrongPatterns = [
          new RegExp(
            `${product.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\d]{0,20}(\\d+[,.]\\d{2})`,
            "i"
          ),
        ];
        for (const pattern of wrongPatterns) {
          const match = message.match(pattern);
          if (!match?.[1]) continue;
          const mentioned = parseFloat(match[1].replace(",", "."));
          if (Math.abs(mentioned - product.price) > 0.05) {
            message = message.replace(
              match[0],
              `${product.name} ${formatPrice(product.price, currency)}`
            );
            corrected = true;
          }
        }
      }

      if (corrected) {
        structured = { ...structured, message };
        fired.push({
          id: skillId,
          phase: "post",
          action: "correct_price_mention",
        });
      }
      continue;
    }

    if (skillId === "post.tone_guard") {
      const tone = applyToneGuard({
        structured,
        language: input.language,
        guestMessage: input.guestMessage,
        forbiddenPhrases: input.config.persona.forbiddenPhrases,
        context: input.leadershipContext,
      });
      if (tone.corrected) {
        structured = tone.structured;
        fired.push({
          id: skillId,
          phase: "post",
          action: "tone_corrected",
          detail: tone.reason,
        });
      }
      continue;
    }

    if (skillId === "post.safety_guard") {
      const safety = applySafetyGuard({
        structured,
        language: input.language,
      });
      if (safety.blocked) {
        structured = safety.structured;
        fired.push({
          id: skillId,
          phase: "post",
          action: "blocked_harmful",
          detail: safety.reason,
        });
      }
    }
  }

  return { structured, fired };
}

export type SkillPipelineEvalFixture = {
  id: string;
  phase: "pre" | "post";
  skillId: PipelineSkillId;
  expectFired: boolean;
};

export function runSkillPipelineTransparencyEval(
  fixtures: SkillPipelineEvalFixture[],
  runners: Record<
    string,
    () => { fired: PipelineSkillTrace[] }
  >
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const row of fixtures) {
    const result = runners[row.id]?.();
    if (!result) {
      errors.push(`${row.id}: no runner`);
      continue;
    }
    const hit = result.fired.some((trace) => trace.id === row.skillId);
    if (hit !== row.expectFired) {
      errors.push(
        `${row.id}: expected ${row.skillId} fired=${row.expectFired}, got ${hit}`
      );
    }
  }
  return { ok: errors.length === 0, errors };
}
