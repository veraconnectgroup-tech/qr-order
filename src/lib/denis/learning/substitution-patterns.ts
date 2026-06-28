export {
  learnSubstitutionPatterns,
  MIN_SUBSTITUTION_PRODUCT_ORDERS,
  SUBSTITUTION_AUTO_GAP_RATE,
  type SubstitutionModifierRow,
  type SubstitutionPattern,
} from "@/lib/denis/platform/substitution-intelligence";

export type RegionalSubstitutionPrior = {
  region: string;
  token: string;
  label: string;
  confidence: number;
};

/** Cross-venue regional substitution awareness — aggregates only (L1). */
export const CROSS_VENUE_SUBSTITUTION_PRIORS: RegionalSubstitutionPrior[] = [
  {
    region: "DE",
    token: "glutenfrei",
    label: "gluten-free",
    confidence: 0.85,
  },
  {
    region: "AT",
    token: "glutenfrei",
    label: "gluten-free",
    confidence: 0.8,
  },
  {
    region: "CH",
    token: "glutenfrei",
    label: "gluten-free",
    confidence: 0.75,
  },
];

export function resolveRegionalSubstitutionPriors(
  countryCode: string | null | undefined
): RegionalSubstitutionPrior[] {
  const region = countryCode?.trim().toUpperCase();
  if (!region) return [];
  return CROSS_VENUE_SUBSTITUTION_PRIORS.filter((row) => row.region === region);
}

export function formatRegionalSubstitutionBlock(
  countryCode: string | null | undefined,
  language?: string
): string | null {
  const priors = resolveRegionalSubstitutionPriors(countryCode);
  if (!priors.length) return null;

  const lang = (language ?? "de").toLowerCase().slice(0, 2);
  const tokens = priors.map((row) => row.token).join(", ");

  if (lang === "de") {
    return `REGIONAL SUBSTITUTION (cross-venue): Gäste in ${priors[0]!.region} fragen oft nach ${tokens}.`;
  }
  if (lang === "en") {
    return `REGIONAL SUBSTITUTION (cross-venue): Guests in ${priors[0]!.region} often ask for ${tokens}.`;
  }
  return `REGIONAL SUBSTITUTION (cross-venue): Gosti u ${priors[0]!.region} često traže ${tokens}.`;
}
