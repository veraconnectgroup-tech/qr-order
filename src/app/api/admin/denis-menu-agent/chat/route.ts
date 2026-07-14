import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { isOpenAiConfigured } from "@/lib/ai/config";
import { callOpenAiChat } from "@/lib/ai/openai-client";
import type { OpenAiChatMessage } from "@/lib/ai/types";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { assembleDenisBrainContext } from "@/lib/denis/cognition/context/assemble-denis-brain-context";
import { maybeProposeRuleFromAnswer } from "@/lib/denis/cognition/policy/maybe-propose-rule-from-answer";
import { loadMenuAgentContextBlock } from "@/lib/denis/menu-agent/load-menu-agent-context";
import {
  listMenuAgentToolDefinitions,
  toolCallToProposalDraft,
} from "@/lib/denis/menu-agent/menu-agent-tool-catalog";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      })
    )
    .max(30)
    .default([]),
});

const MENU_AGENT_SYSTEM_PROMPT_PREFIX = [
  "You are Denis, helping the restaurant owner/manager work on their menu through conversation.",
  "You can propose adding a product, changing a price, or rewriting a description — call the matching propose_* tool when you have a concrete, specific change in mind.",
  "Never call a propose_* tool for a vague idea — ask a clarifying question first (exact price, which item, etc.).",
  "Nothing you propose is applied automatically — the owner reviews and confirms each one separately. Say so naturally if it's not obvious from context.",
  "You may propose more than one change in a single reply when it genuinely makes sense (e.g. a batch of price updates).",
  "Reply in Serbian unless the owner writes in another language.",
].join(" ");

export type MenuAgentProposal = {
  toolCallId: string;
  proposal: Record<string, unknown>;
};

/**
 * Chat turn for the menu agent — proposes changes via tool calls, never
 * executes them. See execute-menu-change-proposal.ts (called from
 * apply/route.ts) for the only path that actually writes to the menu.
 */
export const POST = withErrorHandler(
  "admin-denis-menu-agent-chat-post",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await requireAdmin();
    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return apiError("No location assigned.", 400);
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return apiError("Invalid input.", 400, parsed.error.flatten());
    }

    if (!isOpenAiConfigured()) {
      return apiError("OpenAI is not configured.", 502);
    }

    const admin = createAdminClient();

    // Fire-and-forget — a secondary side-channel, never allowed to add
    // latency to the owner's chat turn. See maybe-propose-rule-from-answer.ts.
    void maybeProposeRuleFromAnswer(admin, {
      locationId,
      answerText: parsed.data.message,
      staffId: staff.id,
    }).catch(() => undefined);

    const [menuContext, brainContext] = await Promise.all([
      loadMenuAgentContextBlock(admin, locationId),
      assembleDenisBrainContext(locationId),
    ]);

    const systemPrompt = [
      brainContext,
      "",
      MENU_AGENT_SYSTEM_PROMPT_PREFIX,
      "",
      menuContext,
    ].join("\n");

    const messages: OpenAiChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...parsed.data.history.map(
        (row): OpenAiChatMessage => ({ role: row.role, content: row.content })
      ),
      { role: "user", content: parsed.data.message },
    ];

    const result = await callOpenAiChat(messages, {
      tools: listMenuAgentToolDefinitions(),
      toolChoice: "auto",
    });

    const proposals: MenuAgentProposal[] = [];
    for (const call of result.toolCalls ?? []) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.arguments);
      } catch {
        continue;
      }
      const draft = toolCallToProposalDraft(call.name, args);
      if (draft) proposals.push({ toolCallId: call.id, proposal: draft });
    }

    return apiSuccess({
      message: result.content || null,
      proposals,
    });
  }
);
