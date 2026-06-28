import dynamic from "next/dynamic";

export const AiCartPairingBanner = dynamic(
  () =>
    import("@/components/guest/ai-cart-pairing-banner").then((m) => ({
      default: m.AiCartPairingBanner,
    })),
  { ssr: false }
);

export const DenisSceneBanners = dynamic(
  () =>
    import("@/components/guest/denis-scene-banners").then((m) => ({
      default: m.DenisSceneBanners,
    })),
  { ssr: false }
);

export const AiRecommendedSection = dynamic(
  () =>
    import("@/components/guest/ai-recommended-section").then((m) => ({
      default: m.AiRecommendedSection,
    })),
  { ssr: false }
);

export const AiFeedbackPrompt = dynamic(
  () =>
    import("@/components/guest/ai-feedback-prompt").then((m) => ({
      default: m.AiFeedbackPrompt,
    })),
  { ssr: false }
);
