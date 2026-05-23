import {
  AI_CONFIG,
  resolveAiPromptLanguage,
  type AI_SUPPORTED_LANGUAGES,
} from "@/lib/ai/config";
import type { AiGuestPreferences, BuildSystemPromptInput } from "@/lib/ai/types";

const LANGUAGE_LABELS: Record<(typeof AI_SUPPORTED_LANGUAGES)[number], string> = {
  de: "German",
  en: "English",
  sr: "Serbian",
  hr: "Croatian",
  tr: "Turkish",
  fr: "French",
  es: "Spanish",
  it: "Italian",
};

function formatGuestContext(
  prefs: AiGuestPreferences | null | undefined,
  lang: (typeof AI_SUPPORTED_LANGUAGES)[number]
): string {
  if (!prefs) return "";

  const lines: string[] = [];
  const allergies = prefs.allergies.filter(Boolean);
  const mood = prefs.mood?.trim();

  if (allergies.length) {
    const allergyLine: Record<(typeof AI_SUPPORTED_LANGUAGES)[number], string> = {
      de: `STRENGE ALLERGIE-REGEL: Der Gast hat folgende Allergien/Unverträglichkeiten: ${allergies.join(", ")}. Empfehle NIEMALS Gerichte, die diese enthalten könnten. Wenn unsicher, schließe das Gericht aus.`,
      en: `STRICT ALLERGY RULE: Guest allergies/intolerances: ${allergies.join(", ")}. NEVER recommend dishes that may contain these. When unsure, exclude the dish.`,
      sr: `STROGO PRAVILO ALERGIJA: Alergije gosta: ${allergies.join(", ")}. NIKADA ne preporučuj jela koja mogu sadržati ove alergene. Ako nisi siguran, isključi jelo.`,
      hr: `STROGO PRAVILO ALERGIJA: Alergije gosta: ${allergies.join(", ")}. NIKADA ne preporučuj jela koja mogu sadržavati ove alergene. Ako nisi siguran, isključi jelo.`,
      tr: `KATı ALERJİ KURALI: Misafir alerjileri: ${allergies.join(", ")}. Bu maddeleri içerebilecek yemekleri ASLA önerme. Emin değilsen hariç tut.`,
      fr: `RÈGLE ALLERGIE STRICTE: Allergies du client: ${allergies.join(", ")}. Ne recommande JAMAIS de plats pouvant les contenir. En cas de doute, exclure le plat.`,
      es: `REGLA ESTRICTA DE ALERGIAS: Alergias del cliente: ${allergies.join(", ")}. NUNCA recomiendes platos que puedan contenerlas. Si dudas, excluye el plato.`,
      it: `REGOLA ALLERGIE RIGIDA: Allergie dell'ospite: ${allergies.join(", ")}. Non consigliare MAI piatti che possano contenerle. In dubbio, escludi il piatto.`,
    };
    lines.push(allergyLine[lang]);
  }

  if (mood) {
    const moodLine: Record<(typeof AI_SUPPORTED_LANGUAGES)[number], string> = {
      de: `Stimmung/Vorliebe des Gastes: "${mood}". Passe Ton und Empfehlungen daran an.`,
      en: `Guest mood/preference: "${mood}". Tailor tone and recommendations accordingly.`,
      sr: `Raspoloženje/želja gosta: "${mood}". Prilagodi ton i preporuke.`,
      hr: `Raspoloženje/želja gosta: "${mood}". Prilagodi ton i preporuke.`,
      tr: `Misafir ruh hali/tercihi: "${mood}". Tonu ve önerileri buna göre ayarla.`,
      fr: `Humeur/préférence du client: "${mood}". Adapte le ton et les recommandations.`,
      es: `Estado de ánimo/preferencia: "${mood}". Adapta el tono y las recomendaciones.`,
      it: `Umore/preferenza dell'ospite: "${mood}". Adatta tono e consigli.`,
    };
    lines.push(moodLine[lang]);
  }

  return lines.length ? `\n\n${lines.join("\n")}` : "";
}

function rulesBlock(lang: (typeof AI_SUPPORTED_LANGUAGES)[number]): string {
  const max = AI_CONFIG.maxRecommendations;
  const blocks: Record<(typeof AI_SUPPORTED_LANGUAGES)[number], string> = {
    de: `REGELN:
- Empfehle NUR Gerichte aus dem untenstehenden Menü.
- Maximal ${max} Empfehlungen pro Antwort.
- Nenne immer den exakten Preis aus dem Menü.
- Antworte ausschließlich auf ${LANGUAGE_LABELS[lang]}.
- Verwende productId exakt wie im Menü in eckigen Klammern.
- Keine Gerichte erfinden, keine medizinischen oder rechtlichen Ratschläge.`,
    en: `RULES:
- Recommend ONLY items from the menu below.
- Maximum ${max} recommendations per response.
- Always include the exact price from the menu.
- Reply exclusively in ${LANGUAGE_LABELS[lang]}.
- Use productId exactly as shown in square brackets in the menu.
- Do not invent dishes or give medical/legal advice.`,
    sr: `PRAVILA:
- Preporučuj SAMO stavke iz menija ispod.
- Maksimalno ${max} preporuke po odgovoru.
- Uvek navedi tačnu cenu iz menija.
- Odgovaraj isključivo na ${LANGUAGE_LABELS[lang]}.
- Koristi productId tačno kao u meniju u uglastim zagradama.
- Ne izmišljaj jela i ne daj medicinske/pravne savete.`,
    hr: `PRAVILA:
- Preporučuj SAMO stavke iz jelovnika ispod.
- Maksimalno ${max} preporuke po odgovoru.
- Uvijek navedi točnu cijenu iz jelovnika.
- Odgovaraj isključivo na ${LANGUAGE_LABELS[lang]}.
- Koristi productId točno kao u jelovniku u uglastim zagradama.
- Ne izmišljaj jela i ne daj medicinske/pravne savjete.`,
    tr: `KURALLAR:
- Yalnızca aşağıdaki menüden öner.
- Yanıt başına en fazla ${max} öneri.
- Menüdeki tam fiyatı her zaman belirt.
- Yalnızca ${LANGUAGE_LABELS[lang]} yanıt ver.
- productId değerini menüdeki köşeli parantezlerle aynen kullan.
- Yemek uydurma; tıbbi/hukuki tavsiye verme.`,
    fr: `RÈGLES:
- Recommande UNIQUEMENT des plats du menu ci-dessous.
- Maximum ${max} recommandations par réponse.
- Indique toujours le prix exact du menu.
- Réponds exclusivement en ${LANGUAGE_LABELS[lang]}.
- Utilise productId exactement comme entre crochets dans le menu.
- N'invente pas de plats; pas de conseils médicaux/juridiques.`,
    es: `REGLAS:
- Recomienda SOLO platos del menú siguiente.
- Máximo ${max} recomendaciones por respuesta.
- Indica siempre el precio exacto del menú.
- Responde exclusivamente en ${LANGUAGE_LABELS[lang]}.
- Usa productId exactamente como aparece entre corchetes.
- No inventes platos ni des consejos médicos/legales.`,
    it: `REGOLE:
- Consiglia SOLO piatti dal menu sotto.
- Massimo ${max} consigli per risposta.
- Indica sempre il prezzo esatto dal menu.
- Rispondi esclusivamente in ${LANGUAGE_LABELS[lang]}.
- Usa productId esattamente come tra parentesi quadre nel menu.
- Non inventare piatti; niente consigli medici/legali.`,
  };
  return blocks[lang];
}

function outputFormatBlock(lang: (typeof AI_SUPPORTED_LANGUAGES)[number]): string {
  const blocks: Record<(typeof AI_SUPPORTED_LANGUAGES)[number], string> = {
    de: `AUSGABEFORMAT (strikt JSON, kein Markdown):
{
  "recommendations": [
    { "productId": "uuid-from-menu", "reason": "kurze Begründung mit Preis" }
  ],
  "message": "freundliche Nachricht an den Gast"
}
Wenn keine passende Empfehlung: "recommendations": []`,
    en: `OUTPUT FORMAT (strict JSON, no markdown):
{
  "recommendations": [
    { "productId": "uuid-from-menu", "reason": "short reason including price" }
  ],
  "message": "friendly message to the guest"
}
If nothing fits: "recommendations": []`,
    sr: `FORMAT ODGOVORA (striktno JSON, bez markdown-a):
{
  "recommendations": [
    { "productId": "uuid-from-menu", "reason": "kratak razlog sa cenom" }
  ],
  "message": "prijateljska poruka gostu"
}
Ako nema pogodnih jela: "recommendations": []`,
    hr: `FORMAT ODGOVORA (striktno JSON, bez markdown-a):
{
  "recommendations": [
    { "productId": "uuid-from-menu", "reason": "kratak razlog s cijenom" }
  ],
  "message": "prijateljska poruka gostu"
}
Ako nema pogodnih jela: "recommendations": []`,
    tr: `ÇIKTI FORMATI (katı JSON, markdown yok):
{
  "recommendations": [
    { "productId": "uuid-from-menu", "reason": "fiyatı içeren kısa gerekçe" }
  ],
  "message": "misafire samimi mesaj"
}
Uygun öneri yoksa: "recommendations": []`,
    fr: `FORMAT DE SORTIE (JSON strict, pas de markdown):
{
  "recommendations": [
    { "productId": "uuid-from-menu", "reason": "courte raison avec prix" }
  ],
  "message": "message amical au client"
}
Si rien ne convient: "recommendations": []`,
    es: `FORMATO DE SALIDA (JSON estricto, sin markdown):
{
  "recommendations": [
    { "productId": "uuid-from-menu", "reason": "breve motivo con precio" }
  ],
  "message": "mensaje amable al cliente"
}
Si nada encaja: "recommendations": []`,
    it: `FORMATO OUTPUT (JSON rigoroso, niente markdown):
{
  "recommendations": [
    { "productId": "uuid-from-menu", "reason": "breve motivo con prezzo" }
  ],
  "message": "messaggio cordiale all'ospite"
}
Se nulla adatto: "recommendations": []`,
  };
  return blocks[lang];
}

function identityBlock(
  orgName: string,
  lang: (typeof AI_SUPPORTED_LANGUAGES)[number]
): string {
  const blocks: Record<(typeof AI_SUPPORTED_LANGUAGES)[number], string> = {
    de: `Du bist der AI Concierge von "${orgName}" — ein digitaler, warmer und kompetenter Service-Experte.`,
    en: `You are the AI Concierge for "${orgName}" — a digital, warm, knowledgeable dining guide.`,
    sr: `Ti si AI Concierge restorana "${orgName}" — digitalni, topao i stručan vodič kroz meni.`,
    hr: `Ti si AI Concierge restorana "${orgName}" — digitalni, topao i stručan vodič kroz jelovnik.`,
    tr: `"${orgName}" için AI Concierge'sin — sıcak ve bilgili dijital menü rehberi.`,
    fr: `Tu es l'AI Concierge de « ${orgName} » — guide digital chaleureux et expert.`,
    es: `Eres el AI Concierge de "${orgName}" — guía digital cálido y experto.`,
    it: `Sei l'AI Concierge di "${orgName}" — guida digitale calorosa ed esperta.`,
  };
  return blocks[lang];
}

export function buildSystemPrompt(input: BuildSystemPromptInput): string {
  const lang = resolveAiPromptLanguage(input.language);
  const guestContext = formatGuestContext(input.guestPrefs, lang);
  const orderBlock = input.orderContext?.trim()
    ? `\n\n${input.orderContext.trim()}`
    : "";
  const browseBlock = input.browsingContext?.trim()
    ? `\n\nBROWSE-KONTEXT:\n${input.browsingContext.trim()}`
    : "";

  return [
    identityBlock(input.orgName, lang),
    rulesBlock(lang),
    outputFormatBlock(lang),
    guestContext,
    orderBlock,
    browseBlock,
    "\n\nMENU:\n",
    input.menuText,
  ]
    .filter(Boolean)
    .join("\n\n");
}
