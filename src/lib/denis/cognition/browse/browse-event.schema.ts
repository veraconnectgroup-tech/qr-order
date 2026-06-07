import { z } from "zod";

const browseMenuSectionSchema = z.enum(["food", "drinks", "desserts"]);

export const browseEventSchema = z.object({
  action: z.enum([
    "view_category",
    "view_product",
    "add_to_cart",
    "remove_from_cart",
    "scroll_menu",
  ]),
  productId: z.string().uuid().optional(),
  productName: z.string().trim().min(1).max(200).optional(),
  categoryId: z.string().trim().min(1).max(128).optional(),
  categoryPath: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  menuSection: browseMenuSectionSchema.nullable().optional(),
  dwellMs: z.number().int().nonnegative().max(3_600_000).optional(),
  timestamp: z.string().datetime({ offset: true }),
});

export function parseBrowseEventFromPayload(
  payload: Record<string, unknown> | undefined
): z.infer<typeof browseEventSchema> | null {
  const raw = payload?.browseEvent;
  const parsed = browseEventSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
