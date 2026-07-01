import type { TypoCorrectionMap } from "@/lib/denis/learning/typo-corrections";

export type VenueTypoCorrectionMap = TypoCorrectionMap;

export {
  applyTypoCorrectionToQuery,
  buildTypoCorrectionMap,
  learnTypoCorrection,
  lookupLearnedTypoCorrection,
  type TypoCorrectionEntry,
  type TypoCorrectionMap,
} from "@/lib/denis/learning/typo-corrections";
