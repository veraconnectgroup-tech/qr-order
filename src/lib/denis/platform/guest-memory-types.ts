export type GuestMemoryScope = "allergies" | "favorites" | "language";

export type GuestMemoryConsent = {
  guestToken: string;
  consentedAt: string;
  scopes: GuestMemoryScope[];
};

/** Server projection for consented return-guest memory (ADR-005 §7.2). */
export type GuestMemoryProjection = {
  favoriteProductIds: string[];
  allergySheetIds: string[];
  allergyLabels: string[];
  preferredLanguage: string | null;
  visitCount: number;
  lastVisitItemNames: string[];
  lastVisitAt: string | null;
};

export type GuestMemorySyncPayload = {
  favoriteProductIds?: string[];
  lastVisitItemNames?: string[];
  allergyLabels?: string[];
  allergySheetIds?: string[];
  preferredLanguage?: string | null;
};
