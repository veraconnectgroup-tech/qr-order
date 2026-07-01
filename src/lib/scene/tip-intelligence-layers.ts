import type { SmartTipOffer } from "@/lib/denis/loop/view-types";
import type { ComposeSceneInput, SessionPhase } from "./types";

export const TIP_SCENE_BANNER_IDS = {
  settlingOffer: "tip-settling-offer",
  denisNudge: "tip-denis-nudge",
} as const;

export type TipIntelligenceContext = {
  phase: SessionPhase;
  language?: string;
  offer: SmartTipOffer | null;
};

function resolveLang(language?: string): "sr" | "de" | "en" {
  const lang = (language ?? "sr").toLowerCase().slice(0, 2);
  if (lang === "de") return "de";
  if (lang === "en") return "en";
  return "sr";
}

function settlingTipBannerMessage(
  offer: SmartTipOffer,
  language?: string
): string {
  if (offer.denisMessage?.trim()) return offer.denisMessage.trim();

  const lang = resolveLang(language);
  if (lang === "de") {
    return "Wenn Sie möchten, können Sie ein Trinkgeld hinterlassen.";
  }
  if (lang === "en") {
    return offer.showProminent
      ? "Enjoyed your visit? Leave a tip for the team."
      : "Tips are optional — thank you!";
  }
  return offer.showProminent
    ? "Ako želite, možete ostaviti napojnicu za naš tim."
    : "Napojnica je opcionalna — hvala!";
}

/** Merge Denis smart-tip intelligence into scene compose input (Prompt 37). */
export function mergeTipIntelligenceLayers<
  T extends Pick<ComposeSceneInput, "banners" | "chips">,
>(input: T, ctx: TipIntelligenceContext): T {
  if (!ctx.offer || ctx.phase !== "settling") {
    return input;
  }

  const banners = [...input.banners];
  const existingIds = new Set(banners.map((banner) => banner.id));

  const message = settlingTipBannerMessage(ctx.offer, ctx.language);
  const bannerId = ctx.offer.showProminent
    ? TIP_SCENE_BANNER_IDS.settlingOffer
    : TIP_SCENE_BANNER_IDS.denisNudge;

  if (!existingIds.has(bannerId)) {
    banners.push({
      id: bannerId,
      message,
      action: "view_bill",
      orderId: ctx.offer.orderId,
    });
  }

  const chips =
    ctx.offer.showProminent && input.chips.length === 0
      ? [
          {
            id: "tip-leave",
            label:
              resolveLang(ctx.language) === "de"
                ? "Trinkgeld"
                : resolveLang(ctx.language) === "en"
                  ? "Leave tip"
                  : "Napojnica",
          },
          { id: "tip-skip", label: resolveLang(ctx.language) === "de" ? "Nein danke" : "Skip" },
        ]
      : input.chips;

  return { ...input, banners, chips };
}
