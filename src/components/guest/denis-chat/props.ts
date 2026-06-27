import type { MenuCategory } from "@/components/guest/menu-grid";
import type { ProductRecommendation } from "@/components/guest/product-recommendation-card";
import type { AiSheetAllergyId } from "@/lib/ai/guest-sheet-preferences";
import type { AllergenId } from "@/lib/allergens";
import type { GuestMemoryProfile } from "@/lib/guest/guest-memory-storage";
import type { MenuSection } from "@/lib/menu-section";
import type { TranscriptEntry } from "@/lib/denis/loop/view-types";
import type { SceneSituation } from "@/lib/scene/types";

export type AiConciergeChatProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  token: string;
  locationId: string;
  tableId: string;
  sessionToken: string | null;
  currency: string;
  taxPercent: number;
  orderingDisabled?: boolean;
  isDemo?: boolean;
  menuCategories?: MenuCategory[];
  menuSectionByProductId?: Map<string, MenuSection>;
  productTaxRateById?: Map<string, number | null>;
  onSetupComplete?: (payload: {
    recommendations: ProductRecommendation[];
    sessionId: string | null;
    preferences: { allergies: string[]; mood: string };
    allergenIds: AllergenId[];
  }) => void;
  /** @deprecated use scrollContext */
  getBrowsingContext?: () => string | null;
  scrollContext?: () => string | null;
  guestProfile?: GuestMemoryProfile;
  isReturning?: boolean;
  onAddToCart?: (rec: ProductRecommendation) => void;
  customizableProductIds?: Set<string>;
  onOpenProductDetail?: (productId: string) => void;
  /** Alias for onSetupComplete */
  onRecommendations?: AiConciergeChatProps["onSetupComplete"];
  /** @deprecated Welcome-back is shown on the dock subtitle only, not in chat. */
  welcomeBackMessage?: string | null;
  knownAllergySelection?: AiSheetAllergyId[];
  onSaveAllergies?: (
    allergies: string[],
    sheetIds: AiSheetAllergyId[]
  ) => void;
  deviceFingerprint?: string;
  voiceEnabled?: boolean;
  voiceTtsEnabled?: boolean;
  sceneChrome?: {
    tableName: string;
    venueName: string;
    markState: "idle" | "listen" | "think";
    situation?: SceneSituation | null;
  } | null;
  bootstrapTranscript?: TranscriptEntry[] | null;
  onOpenPaymentSheet?: () => void;
  onViewRefresh?: () => void;
};
