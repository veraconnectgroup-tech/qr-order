import type { MenuCategory } from "@/components/guest/menu-grid";
import type { InPersonPaymentLocation } from "@/lib/constants";

export type MenuViewProps = {
  slug: string;
  token: string;
  orgName: string;
  logoUrl?: string | null;
  locationName: string;
  tableName: string;
  zoneName: string | null;
  categories: MenuCategory[];
  menuVersion?: string;
  unavailableCategories?: MenuCategory[];
  taxPercent: number;
  currency: string;
  locationId: string;
  tableId: string;
  timezone: string;
  orderingEnabled?: boolean;
  acceptingOrders?: boolean;
  aiConciergeEnabled?: boolean;
  returnGuestEnabled?: boolean;
  memoryConsentPrompt?: string | null;
  voiceEnabled?: boolean;
  voiceTtsEnabled?: boolean;
  googleReviewUrl?: string | null;
  stripeOnboarded?: boolean;
  paymentOnlineEnabled?: boolean;
  paymentAtBarEnabled?: boolean;
  paymentCardAtTableEnabled?: boolean;
  inPersonPaymentLocation?: InPersonPaymentLocation;
  trendingMenuProducts?: {
    productIds: string[];
    orderCountsToday: Record<string, number>;
  } | null;
};
