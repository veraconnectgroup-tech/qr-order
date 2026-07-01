export type {
  BrowseAction,
  BrowseEvent,
  BrowseMenuSection,
  GuestBrowseProfile,
} from "@/lib/denis/cognition/browse/browse-types";
export { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
export { browseEventSchema, parseBrowseEventFromPayload } from "@/lib/denis/cognition/browse/browse-event.schema";
export { classifyBrowseDomain, resolveCategoryLabel, categoryPopularPick } from "@/lib/denis/cognition/browse/classify-browse-domain";
export {
  detectBrowseProductFollowUp,
  detectCategoryBrowseNudge,
  detectDessertCategoryInterest,
  buildCategoryBrowseNudgeMessage,
  buildBrowseProductFollowUpMessage,
} from "@/lib/denis/cognition/browse/detect-browse-triggers";
export { foldBrowseProfile } from "@/lib/denis/cognition/browse/fold-browse-profile";
export { ingestBrowseTelemetry, ingestScrollTelemetry } from "@/lib/denis/cognition/browse/ingest-browse-telemetry";
