import { z } from "zod";

export const ThemeColorSchemeSchema = z.enum(["auto", "dark", "light"]);

export const ThemeConfigSchema = z.object({
  primaryColor: z
    .string()
    .trim()
    .regex(/^#?[0-9a-fA-F]{6}$/)
    .optional(),
  secondaryColor: z
    .string()
    .trim()
    .regex(/^#?[0-9a-fA-F]{6}$/)
    .optional(),
  fontFamily: z.string().trim().min(2).max(120).optional(),
  colorScheme: ThemeColorSchemeSchema.optional(),
  hidePoweredBy: z.boolean().optional(),
  poweredByLabel: z.string().trim().max(80).optional(),
  receiptFooter: z.string().trim().max(200).optional(),
  customGreeting: z.string().trim().max(240).optional(),
});

export type ThemeConfigInput = z.infer<typeof ThemeConfigSchema>;

export function parseThemeConfig(value: unknown): ThemeConfigInput | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const candidate =
    record.theme && typeof record.theme === "object"
      ? record.theme
      : {
          primaryColor: record.brandPrimaryColor ?? record.primaryColor,
          secondaryColor: record.secondaryColor,
          fontFamily: record.fontFamily,
          colorScheme: record.colorScheme,
          hidePoweredBy: record.hidePoweredBy,
          poweredByLabel: record.poweredByLabel,
          receiptFooter: record.receiptFooter,
          customGreeting: record.customGreeting,
        };

  const parsed = ThemeConfigSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
