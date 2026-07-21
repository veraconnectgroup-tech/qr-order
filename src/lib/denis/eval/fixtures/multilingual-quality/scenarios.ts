export type MultilingualQualityScenario = {
  id: string;
  language: "fr" | "es" | "ru";
  description: string;
  guestMessage: string;
  /**
   * The reply under test. Phrased the way narrate-llm.ts's per-language
   * prompt is instructed to answer (see AI_SUPPORTED_LANGUAGES /
   * resolveAiPromptLanguage in src/lib/ai/config.ts, which already lists
   * fr/es/ru as first-class). Written by hand rather than captured live
   * because narrate-llm.ts requires a real OpenAI call end-to-end (menu
   * context, prompt assembly) that isn't reproducible deterministically in
   * CI without an API key — the same constraint every other LLM-backed
   * eval in this directory works around (see run-menu-rag-fixture.ts's
   * local-embedding fallback). This eval judges PHRASING QUALITY of a
   * realistic reply, not the language-routing decision (that's covered by
   * detectGuestMessageLanguage tests elsewhere).
   */
  denisReply: string;
};

export const MULTILINGUAL_QUALITY_SCENARIOS: MultilingualQualityScenario[] = [
  {
    id: "fr_recommend_light",
    language: "fr",
    description: "Guest asks for something light in French",
    guestMessage: "Bonsoir, vous auriez quelque chose de léger à me conseiller ?",
    denisReply:
      "Bonsoir ! Je vous conseille volontiers notre salade de saison, fraîche et légère — ou, si vous préférez le poisson, notre dorade grillée. Vous avez une préférence ?",
  },
  {
    id: "fr_wait_time",
    language: "fr",
    description: "Guest asks how long the wait will be in French",
    guestMessage: "Ça va prendre combien de temps pour la commande, à peu près ?",
    denisReply:
      "La cuisine est un peu chargée ce soir, donc comptez environ 20 minutes pour votre plat. Je vous préviens dès que c'est prêt.",
  },
  {
    id: "es_recommend_wine",
    language: "es",
    description: "Guest asks for a wine pairing in Spanish",
    guestMessage: "¿Qué vino me recomiendas para acompañar la carne?",
    denisReply:
      "Para la carne, le va muy bien nuestro tinto de la casa, con buen cuerpo — o si prefiere algo más suave, tenemos un Rioja crianza. ¿Cuál le apetece más?",
  },
  {
    id: "es_complaint_cold_food",
    language: "es",
    description: "Guest complains politely that food arrived cold in Spanish",
    guestMessage: "Oye, la comida llegó bastante fría, no está muy bien así.",
    denisReply:
      "Tiene toda la razón, lamento que haya llegado fría — le pido disculpas. Aviso ahora mismo a un compañero para que se lo cambien enseguida.",
  },
  {
    id: "ru_order_status",
    language: "ru",
    description: "Guest asks about their order status in Russian",
    guestMessage: "Скажите, а как там мой заказ, скоро будет готов?",
    denisReply:
      "Ваш заказ уже готовится, осталось примерно 10 минут. Как только всё будет готово, я вам сразу скажу.",
  },
  {
    id: "ru_menu_question",
    language: "ru",
    description: "Guest asks whether a dish contains nuts in Russian",
    guestMessage: "А в этом десерте случайно нет орехов? У меня аллергия.",
    denisReply:
      "Хороший вопрос — в этом десерте орехов нет, можете заказывать спокойно. Если хотите, могу уточнить и другие аллергены на всякий случай.",
  },
];
