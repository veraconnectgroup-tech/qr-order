import { z } from "zod";

const browseMenuSectionSchema = z.enum(["food", "drinks", "desserts"]);

export const browseEventSchema = z.object({
  action: z.enum([
    "view_category",
    "view_product",
    "close_product",
    "add_to_cart",
    "remove_from_cart",
    "scroll_menu",
    "nudge_interaction",
  ]),
  productId: z.string().uuid().optional(),
  productName: z.string().trim().min(1).max(200).optional(),
  categoryId: z.string().trim().min(1).max(128).optional(),
  categoryPath: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  menuSection: browseMenuSectionSchema.nullable().optional(),
  dwellMs: z.number().int().nonnegative().max(3_600_000).optional(),
  unitPrice: z.number().nonnegative().max(9999).optional(),
  lineTotal: z.number().nonnegative().max(99999).optional(),
  scrollIntent: z.enum(["fast_search", "slow_category", "reached_bottom"]).optional(),
  scrollVelocityPxPerSec: z.number().nonnegative().max(50_000).optional(),
  nudgeKind: z.string().trim().min(1).max(64).optional(),
  nudgeVariant: z.enum(["A", "B"]).optional(),
  nudgeAction: z.enum(["shown", "click", "dismiss"]).optional(),
  timestamp: z.string().datetime({ offset: true }),
});

export function parseBrowseEventFromPayload(
  payload: Record<string, unknown> | undefined
): z.infer<typeof browseEventSchema> | null {
  const raw = payload?.browseEvent;
  const parsed = browseEventSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
