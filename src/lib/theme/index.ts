export type {
  ResolvedTheme,
  ThemeColorScheme,
  ThemeConfig,
} from "@/lib/theme/types";
export { DEFAULT_THEME } from "@/lib/theme/types";
export {
  resolveTheme,
  buildThemeCssVars,
  buildThemeCssVarBlock,
  replaceConciergeDisplayName,
  themeColorSchemeAttribute,
  themeMetaColor,
} from "@/lib/theme/theme-resolver";
export { parseThemeConfig, ThemeConfigSchema } from "@/lib/theme/theme-config.schema";
export { loadThemeForLocation, loadThemeForOrgLocation } from "@/lib/theme/load-theme-for-location";
export { normalizeHexColor } from "@/lib/theme/color-utils";
