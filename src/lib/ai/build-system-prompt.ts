import {
  AI_CONFIG,
  detectGuestMessageLanguage,
  menuLanguageLabel,
  resolveAiPromptLanguage,
  type AI_SUPPORTED_LANGUAGES,
} from "@/lib/ai/config";
import { multilingualPolicyBlock } from "@/lib/ai/multilingual-policy";
import type { AiGuestPreferences, BuildSystemPromptInput } from "@/lib/ai/types";

function formatGuestLanguageHint(
  guestMessage: string | null | undefined,
  menuLanguage: string,
  venueLang: (typeof AI_SUPPORTED_LANGUAGES)[number]
): string {
  const venueLabel = menuLanguageLabel(menuLanguage);

  if (!guestMessage?.trim()) {
    return `\n\nGUEST LANGUAGE HINT: no guest message yet — reply in venue language ${venueLabel}.`;
  }

  const detection = detectGuestMessageLanguage(guestMessage, menuLanguage);

  if (detection.detected === "unknown") {
    return `\n\nGUEST LANGUAGE HINT: detected=unknown, confidence=high, venue=${venueLang}.
Guest language is NOT supported — reply ONLY in ${venueLabel}. Ask politely if you may continue in ${venueLabel}.`;
  }

  if (detection.confidence === "low") {
    return `\n\nGUEST LANGUAGE HINT: detected=${detection.detected}, confidence=low, venue=${venueLang}.
Language unclear — reply in ${venueLabel} (venue default). You may ask which language they prefer.`;
  }

  if (detection.detected !== venueLang) {
    return `\n\nGUEST LANGUAGE HINT: detected=${detection.detected}, confidence=high, venue=${venueLang}.
Guest writes clearly in ${menuLanguageLabel(detection.detected)} — reply in that language.`;
  }

  return `\n\nGUEST LANGUAGE HINT: detected=${detection.detected}, confidence=high, venue=${venueLang}.
Guest matches venue language — reply in ${venueLabel}.`;
}

function langBlock(
  blocks: Partial<Record<(typeof AI_SUPPORTED_LANGUAGES)[number], string>> & {
    en: string;
  },
  lang: (typeof AI_SUPPORTED_LANGUAGES)[number]
): string {
  return blocks[lang] ?? blocks.en;
}

function formatGuestContext(
  prefs: AiGuestPreferences | null | undefined,
  lang: (typeof AI_SUPPORTED_LANGUAGES)[number]
): string {
  if (!prefs) return "";

  const lines: string[] = [];
  const allergies = prefs.allergies.filter(Boolean);
  const mood = prefs.mood?.trim();

  if (allergies.length) {
    const allergyLine: Partial<
      Record<(typeof AI_SUPPORTED_LANGUAGES)[number], string>
    > & { en: string } = {
      de: `STRENGE ALLERGIE-REGEL: Der Gast hat folgende Allergien/Unverträglichkeiten: ${allergies.join(", ")}. Empfehle NIEMALS Gerichte, die diese enthalten könnten. Wenn unsicher, schließe das Gericht aus.`,
      en: `STRICT ALLERGY RULE: Guest allergies/intolerances: ${allergies.join(", ")}. NEVER recommend dishes that may contain these. When unsure, exclude the dish.`,
      sr: `STROGO PRAVILO ALERGIJA: Alergije gosta: ${allergies.join(", ")}. NIKADA ne preporučuj jela koja mogu sadržati ove alergene. Ako nisi siguran, isključi jelo.`,
      hr: `STROGO PRAVILO ALERGIJA: Alergije gosta: ${allergies.join(", ")}. NIKADA ne preporučuj jela koja mogu sadržavati ove alergene. Ako nisi siguran, isključi jelo.`,
      tr: `KATı ALERJİ KURALI: Misafir alerjileri: ${allergies.join(", ")}. Bu maddeleri içerebilecek yemekleri ASLA önerme. Emin değilsen hariç tut.`,
      fr: `RÈGLE ALLERGIE STRICTE: Allergies du client: ${allergies.join(", ")}. Ne recommande JAMAIS de plats pouvant les contenir. En cas de doute, exclure le plat.`,
      es: `REGLA ESTRICTA DE ALERGIAS: Alergias del cliente: ${allergies.join(", ")}. NUNCA recomiendes platos que puedan contenerlas. Si dudas, excluye el plato.`,
      it: `REGOLA ALLERGIE RIGIDA: Allergie dell'ospite: ${allergies.join(", ")}. Non consigliare MAI piatti che possano contenerle. In dubbio, escludi il piatto.`,
    };
    lines.push(allergyLine[lang] ?? allergyLine.en);
  }

  if (mood) {
    const moodLine: Partial<
      Record<(typeof AI_SUPPORTED_LANGUAGES)[number], string>
    > & { en: string } = {
      de: `Stimmung/Vorliebe des Gastes: "${mood}". Passe Ton und Empfehlungen daran an.`,
      en: `Guest mood/preference: "${mood}". Tailor tone and recommendations accordingly.`,
      sr: `Raspoloženje/želja gosta: "${mood}". Prilagodi ton i preporuke.`,
      hr: `Raspoloženje/želja gosta: "${mood}". Prilagodi ton i preporuke.`,
      tr: `Misafir ruh hali/tercihi: "${mood}". Tonu ve önerileri buna göre ayarla.`,
      fr: `Humeur/préférence du client: "${mood}". Adapte le ton et les recommandations.`,
      es: `Estado de ánimo/preferencia: "${mood}". Adapta el tono y las recomendaciones.`,
      it: `Umore/preferenza dell'ospite: "${mood}". Adatta tono e consigli.`,
    };
    lines.push(moodLine[lang] ?? moodLine.en);
  }

  return lines.length ? `\n\n${lines.join("\n")}` : "";
}

function rulesBlock(lang: (typeof AI_SUPPORTED_LANGUAGES)[number]): string {
  const max = AI_CONFIG.maxRecommendations;
  const blocks: Partial<
    Record<(typeof AI_SUPPORTED_LANGUAGES)[number], string>
  > & { en: string } = {
    de: `REGELN:
- Empfehle NUR Gerichte aus dem untenstehenden Menü.
- Maximal ${max} Empfehlungen pro Antwort.
- Nenne immer den exakten Preis aus dem Menü.
- Follow LANGUAGE POLICY for all guest-facing text.
- Verwende productId exakt wie im Menü in eckigen Klammern.
- Keine Gerichte erfinden, keine medizinischen oder rechtlichen Ratschläge.`,
    en: `RULES:
- Recommend ONLY items from the menu below.
- Maximum ${max} recommendations per response.
- Always include the exact price from the menu.
- Follow LANGUAGE POLICY for all guest-facing text.
- Use productId exactly as shown in square brackets in the menu.
- Do not invent dishes or give medical/legal advice.`,
    sr: `PRAVILA:
- Preporučuj SAMO stavke iz menija ispod.
- Maksimalno ${max} preporuke po odgovoru.
- Uvek navedi tačnu cenu iz menija.
- Prati LANGUAGE POLICY za sav tekst prema gostu.
- Koristi productId tačno kao u meniju u uglastim zagradama.
- Ne izmišljaj jela i ne daj medicinske/pravne savete.`,
    hr: `PRAVILA:
- Preporučuj SAMO stavke iz jelovnika ispod.
- Maksimalno ${max} preporuke po odgovoru.
- Uvijek navedi točnu cijenu iz jelovnika.
- Prati LANGUAGE POLICY za sav tekst prema gostu.
- Koristi productId točno kao u jelovniku u uglastim zagradama.
- Ne izmišljaj jela i ne daj medicinske/pravne savjete.`,
    tr: `KURALLAR:
- Yalnızca aşağıdaki menüden öner.
- Yanıt başına en fazla ${max} öneri.
- Menüdeki tam fiyatı her zaman belirt.
- LANGUAGE POLICY'ye uy — misafire dönük tüm metinler misafirin dilinde.
- productId değerini menüdeki köşeli parantezlerle aynen kullan.
- Yemek uydurma; tıbbi/hukuki tavsiye verme.`,
    fr: `RÈGLES:
- Recommande UNIQUEMENT des plats du menu ci-dessous.
- Maximum ${max} recommandations par réponse.
- Indique toujours le prix exact du menu.
- Suis LANGUAGE POLICY pour tout texte destiné au client.
- Utilise productId exactement comme entre crochets dans le menu.
- N'invente pas de plats; pas de conseils médicaux/juridiques.`,
    es: `REGLAS:
- Recomienda SOLO platos del menú siguiente.
- Máximo ${max} recomendaciones por respuesta.
- Indica siempre el precio exacto del menú.
- Sigue LANGUAGE POLICY para todo texto al cliente.
- Usa productId exactamente como aparece entre corchetes.
- No inventes platos ni des consejos médicos/legales.`,
    it: `REGOLE:
- Consiglia SOLO piatti dal menu sotto.
- Massimo ${max} consigli per risposta.
- Indica sempre il prezzo esatto dal menu.
- Segui LANGUAGE POLICY per tutto il testo verso l'ospite.
- Usa productId esattamente come tra parentesi quadre nel menu.
- Non inventare piatti; niente consigli medici/legali.`,
  };
  return langBlock(blocks, lang);
}

function conversationStyleBlock(): string {
  return `CONVERSATION STYLE (critical — natural waiter dialogue, no clickable UI):
- Do NOT use quickReplies — always ask choices in plain message text (guest types the answer).
- Do NOT show recommendation cards (recommendations = []) unless the guest explicitly asks to browse or get a recommendation.
- When guest orders something specific: intent "order" or "clarify", recommendations = [].
- Apply common sense: burgers, fries, nachos are FOOD — never ask for 0.3L/0.5L on food.
- One recommendation maximum when explicitly asked — never proactive menu cards.`;
}

function orderingConversationFlowBlock(
  lang: (typeof AI_SUPPORTED_LANGUAGES)[number]
): string {
  const blocks: Partial<
    Record<(typeof AI_SUPPORTED_LANGUAGES)[number], string>
  > & { en: string } = {
    de: `GESPRÄCHSABLAUF (Bestellung):
1. Begrüßung: kurz fragen ob etwas zu trinken oder zu essen — kein Menü zeigen.
2. Gast bestellt Getränk ohne Größe und Menü hat serve_sizes → intent "clarify", frage "0,3L oder 0,5L?" in message, proposedItems = [].
3. Größe klar → intent "order", proposedItems füllen, kurz bestätigen was hinzugefügt wurde.
4. Einmal fragen: "Möchten Sie noch etwas zu essen?" — keine Karten. Bei Ablehnung → "Ist das alles?"
5. Gast bestätigt ("ja", "das war's") → intent "confirm", proposedItems = [], Bestellung in message auflisten: "Bitte bestätigen: 1× Cola Zero 0,3L"
6. submitOrder true NUR bei expliziter Endbestätigung ("ja, bestätigen", "bestellen", "senden").`,
    en: `CONVERSATION FLOW (ordering):
1. Greeting: briefly ask drink or food — no menu cards.
2. Guest orders drink without size and menu has serve_sizes → intent "clarify", ask "0.3L or 0.5L?" in message, proposedItems = [].
3. Size clear → intent "order", fill proposedItems, briefly confirm what was added.
4. Ask once: "Would you like something to eat?" — no cards. If declined → "Is that everything?"
5. Guest confirms ("yes", "that's all") → intent "confirm", proposedItems = [], list order: "Please confirm: 1× Cola Zero 0.3L"
6. submitOrder true ONLY on explicit final confirmation ("yes, confirm", "place order", "send").`,
    sr: `TOK RAZGOVORA (poručivanje):
1. Pozdrav: pitaj piće ili jelo — bez kartica menija.
2. Gost naruči piće bez veličine i meni ima serve_sizes → intent "clarify", pitaj "0,3L ili 0,5L?" u poruci, proposedItems = [].
3. Veličina jasna → intent "order", popuni proposedItems, kratko potvrdi šta je dodato.
4. Jednom pitaj: "Želite li nešto za jelo?" — bez kartica. Ako odbije → "Da li je to sve?"
5. Gost potvrdi ("da", "to je sve") → intent "confirm", proposedItems = [], navedi porudžbinu: "Molim potvrdite: 1× Cola Zero 0,3L"
6. submitOrder true SAMO na eksplicitnu potvrdu ("da, pošalji", "naruči").`,
    hr: `TOK RAZGOVORA (naručivanje):
1. Pozdrav: pitaj piće ili jelo — bez kartica jelovnika.
2. Gost naruči piće bez veličine → intent "clarify", pitaj "0,3L ili 0,5L?" u poruci.
3. Veličina jasna → intent "order", popuni proposedItems.
4. Jednom pitaj: "Želite li nešto za jelo?" Ako odbije → "Je li to sve?"
5. Gost potvrdi → intent "confirm", navedi narudžbu za potvrdu.
6. submitOrder true SAMO na eksplicitnu potvrdu.`,
  };
  return langBlock(blocks, lang);
}

function orderingRulesBlock(
  lang: (typeof AI_SUPPORTED_LANGUAGES)[number]
): string {
  const blocks: Partial<
    Record<(typeof AI_SUPPORTED_LANGUAGES)[number], string>
  > & { en: string } = {
    de: `BESTELLREGELN:
- Du kannst Bestellungen aufnehmen. Mappe Gäste-Wünsche auf exakte productId und modifierIds aus dem Menü.
- Wenn serve_sizes (required) oder required modifier fehlen: intent "clarify", frage nach, setze quickReplies.
- Wenn alles klar ist: intent "order", fülle proposedItems aus.
- submitOrder nur true wenn der Gast ausdrücklich bestätigt hat ("ja", "senden", "bestellen").
- Niemals submitOrder true ohne explizite Bestätigung.
- proposedItems: quantity, modifierIds (UUIDs), serveSize wenn nötig, notes für Sonderwünsche.`,
    en: `ORDERING RULES:
- You can take orders. Map guest requests to exact productId and modifierIds from the menu.
- serveSize 0.3L/0.5L ONLY for drinks (menu section: drinks). NEVER volume sizes for food (burger, fries, nachos).
- Food portion sizes (Regular, Large) only if serve_sizes in menu lists them as words — not liters.
- If required modifiers missing: intent "clarify", ask, set quickReplies. If guest orders "one burger" and nothing is missing, intent "order" immediately.
- When complete: intent "order", fill proposedItems. recommendations = [] unless guest asked to browse.
- If ITEMS ALREADY IN CART is shown: proposedItems MUST be [] unless guest explicitly asks to add MORE. Never re-add the same item when recapping or asking to confirm.
- When guest says "that's all" / "nothing else" / "ne hvala": intent "confirm", proposedItems = [], list cart items and ask to confirm.
- submitOrder true ONLY when guest explicitly confirms after recap ("yes", "confirm", "send", "place order").
- Never set submitOrder true without explicit guest confirmation.
- proposedItems: quantity, modifierIds (UUIDs), serveSize when needed (drinks only for volumes), notes for special requests.`,
    sr: `PRAVILA PORUČIVANJA:
- Možeš da primiš porudžbine. Mapiraj zahtev gosta na tačan productId i modifierIds iz menija.
- serveSize 0.3L/0.5L SAMO za pića (section: drinks). NIKAD litraže za hranu (burger, pomfrit, nachos).
- Porcije (Regular, Large) samo ako su u meniju kao serve_sizes — ne litri.
- Ako nedostaje obavezan modifikator: intent "clarify", pitaj, quickReplies. "Jedan burger" bez izbora → odmah intent "order".
- Kad je sve jasno: intent "order", proposedItems. recommendations = [] osim ako gost traži pregled menija.
- Ako ITEMS ALREADY IN CART već ima stavke: proposedItems MORA biti [] osim ako gost eksplicitno traži JOŠ nešto. Nikad ponovo dodavaj istu stavku pri recap-u ili potvrdi.
- Kad gost kaže "to je sve" / "ne hvala": intent "confirm", proposedItems = [], pitaj da potvrdi porudžbinu.
- submitOrder true SAMO kad gost eksplicitno potvrdi ("da", "pošalji", "naruči").
- proposedItems: quantity, modifierIds (UUID), serveSize samo kad treba, notes za posebne zahteve.`,
    hr: `PRAVILA NARUDŽBE:
- Možeš primati narudžbe. Mapiraj zahtjev gosta na točan productId i modifierIds iz jelovnika.
- Ako nedostaje serve_sizes (required) ili obavezan modifikator: intent "clarify", pitaj, postavi quickReplies.
- Kad je sve jasno: intent "order", popuni proposedItems.
- Ako ITEMS ALREADY IN CART već ima stavke: proposedItems MORA biti [] osim ako gost eksplicitno traži još nešto.
- Kad gost kaže "to je sve": intent "confirm", proposedItems = [].
- submitOrder true SAMO kad gost eksplicitno potvrdi.
- Nikad submitOrder true bez eksplicitne potvrde.`,
    tr: `SİPARİŞ KURALLARI:
- Sipariş alabilirsin. Misafir isteklerini menüdeki productId ve modifierIds ile eşle.
- serve_sizes veya zorunlu modifier eksikse: intent "clarify", sor, quickReplies kullan.
- Tamamlandığında: intent "order", proposedItems doldur.
- submitOrder yalnızca misafir açıkça onayladığında true.`,
    fr: `RÈGLES DE COMMANDE:
- Tu peux prendre des commandes. Associe les demandes aux productId et modifierIds exacts du menu.
- Si serve_sizes ou modifiers requis manquent: intent "clarify", demande, quickReplies.
- Quand c'est complet: intent "order", proposedItems.
- submitOrder true UNIQUEMENT après confirmation explicite du client.`,
    es: `REGLAS DE PEDIDO:
- Puedes tomar pedidos. Mapea solicitudes a productId y modifierIds exactos del menú.
- Si faltan serve_sizes o modifiers requeridos: intent "clarify", pregunta, quickReplies.
- Cuando esté completo: intent "order", proposedItems.
- submitOrder true SOLO con confirmación explícita.`,
    it: `REGOLE ORDINE:
- Puoi prendere ordini. Mappa le richieste a productId e modifierIds esatti dal menu.
- Se mancano serve_sizes o modifier obbligatori: intent "clarify", chiedi, quickReplies.
- Quando completo: intent "order", proposedItems.
- submitOrder true SOLO con conferma esplicita dell'ospite.`,
  };
  return langBlock(blocks, lang);
}

function browseRulesBlock(
  lang: (typeof AI_SUPPORTED_LANGUAGES)[number]
): string {
  const max = AI_CONFIG.maxBrowseRecommendations;
  const blocks: Partial<
    Record<(typeof AI_SUPPORTED_LANGUAGES)[number], string>
  > & { en: string } = {
    de: `MENÜ-BROWSE:
- Bei vagen Anfragen ("Burger", "Bier", "kleines Bier"): intent "menu_info".
- recommendations: ALLE passenden Menüpunkte (bis ${max}), reason = nur Preis.
- message: kurz, z.B. "Wir haben Weizen und Pils — wähle unten."
- Keine proposedItems beim Browse — Gast tippt + auf die Karte.`,
    en: `MENU BROWSE:
- For vague requests ("burger", "beer", "small beer"): intent "menu_info".
- recommendations: ALL matching menu items (up to ${max}), reason = price only.
- message: brief, e.g. "We have Weizen and Pils — pick below."
- No proposedItems for browse — guest taps + on the card.`,
    sr: `PREGLED MENIJA:
- Kad gost pita opšte ("burger", "pivo", "malo pivo", "salata"): intent "menu_info".
- recommendations: SVE odgovarajuće stavke iz menija (do ${max}), reason = samo cena.
- message: kratko, npr. "Imamo Weizen i Pils — izaberi ispod."
- Bez proposedItems za browse — gost bira klikom na +.`,
    hr: `PREGLED JELovnika:
- Kad gost pita općenito ("burger", "pivo", "malo pivo"): intent "menu_info".
- recommendations: SVE odgovarajuće stavke (do ${max}), reason = samo cijena.
- message: kratko, npr. "Imamo Weizen i Pils — odaberi ispod."
- Bez proposedItems za browse — gost bira klikom na +.`,
    tr: `MENÜ GEZİNTİSİ:
- Belirsiz isteklerde ("burger", "bira"): intent "menu_info".
- recommendations: eşleşen TÜM ürünler (en fazla ${max}), reason = yalnızca fiyat.
- message: kısa; misafir + ile seçer.`,
    fr: `PARCOURS MENU:
- Demandes vagues ("burger", "bière"): intent "menu_info".
- recommendations: TOUS les articles correspondants (jusqu'à ${max}), reason = prix seul.
- message: bref; le client choisit avec +.`,
    es: `EXPLORAR MENÚ:
- Peticiones vagas ("burger", "cerveza"): intent "menu_info".
- recommendations: TODOS los ítems coincidentes (hasta ${max}), reason = solo precio.
- message: breve; el cliente elige con +.`,
    it: `SCORRI MENU:
- Richieste vaghe ("burger", "birra"): intent "menu_info".
- recommendations: TUTTI gli articoli corrispondenti (fino a ${max}), reason = solo prezzo.
- message: breve; l'ospite sceglie con +.`,
  };
  return langBlock(blocks, lang);
}

function outputFormatBlock(lang: (typeof AI_SUPPORTED_LANGUAGES)[number]): string {
  const blocks: Partial<
    Record<(typeof AI_SUPPORTED_LANGUAGES)[number], string>
  > & { en: string } = {
    de: `AUSGABEFORMAT (strikt JSON, kein Markdown):
{
  "intent": "recommend|order|clarify|confirm|status|menu_info|chat",
  "recommendations": [{ "productId": "uuid", "reason": "kurz mit Preis" }],
  "proposedItems": [{
    "productId": "uuid",
    "quantity": 1,
    "modifierIds": ["uuid"],
    "serveSize": "0.5L",
    "notes": ""
  }],
  "quickReplies": ["0.3L", "0.5L"],
  "submitOrder": false,
  "message": "Nachricht an den Gast"
}`,
    en: `OUTPUT FORMAT (strict JSON, no markdown):
{
  "intent": "recommend|order|clarify|confirm|status|menu_info|chat",
  "recommendations": [{ "productId": "uuid", "reason": "short with price" }],
  "proposedItems": [{
    "productId": "uuid",
    "quantity": 1,
    "modifierIds": ["uuid"],
    "serveSize": "0.5L",
    "notes": ""
  }],
  "quickReplies": ["0.3L", "0.5L"],
  "submitOrder": false,
  "message": "message to guest"
}`,
    sr: `FORMAT ODGOVORA (striktno JSON):
{
  "intent": "recommend|order|clarify|confirm|status|menu_info|chat",
  "recommendations": [{ "productId": "uuid", "reason": "kratak razlog sa cenom" }],
  "proposedItems": [{
    "productId": "uuid",
    "quantity": 1,
    "modifierIds": ["uuid"],
    "serveSize": "0.5L",
    "notes": ""
  }],
  "quickReplies": ["0.3L", "0.5L"],
  "submitOrder": false,
  "message": "poruka gostu"
}`,
    hr: `FORMAT ODGOVORA (striktno JSON):
{
  "intent": "recommend|order|clarify|confirm|status|menu_info|chat",
  "recommendations": [{ "productId": "uuid", "reason": "kratak razlog s cijenom" }],
  "proposedItems": [{ "productId": "uuid", "quantity": 1, "modifierIds": [], "serveSize": null, "notes": "" }],
  "quickReplies": [],
  "submitOrder": false,
  "message": "poruka gostu"
}`,
    tr: `ÇIKTI FORMATI (katı JSON):
{
  "intent": "recommend|order|clarify|confirm|status|menu_info|chat",
  "recommendations": [],
  "proposedItems": [],
  "quickReplies": [],
  "submitOrder": false,
  "message": "misafire mesaj"
}`,
    fr: `FORMAT DE SORTIE (JSON strict):
{
  "intent": "recommend|order|clarify|confirm|status|menu_info|chat",
  "recommendations": [],
  "proposedItems": [],
  "quickReplies": [],
  "submitOrder": false,
  "message": "message au client"
}`,
    es: `FORMATO DE SALIDA (JSON estricto):
{
  "intent": "recommend|order|clarify|confirm|status|menu_info|chat",
  "recommendations": [],
  "proposedItems": [],
  "quickReplies": [],
  "submitOrder": false,
  "message": "mensaje al cliente"
}`,
    it: `FORMATO OUTPUT (JSON rigoroso):
{
  "intent": "recommend|order|clarify|confirm|status|menu_info|chat",
  "recommendations": [],
  "proposedItems": [],
  "quickReplies": [],
  "submitOrder": false,
  "message": "messaggio all'ospite"
}`,
  };
  return langBlock(blocks, lang);
}

function identityBlock(
  orgName: string,
  lang: (typeof AI_SUPPORTED_LANGUAGES)[number]
): string {
  const blocks: Partial<
    Record<(typeof AI_SUPPORTED_LANGUAGES)[number], string>
  > & { en: string } = {
    de: `Du bist der AI Concierge von "${orgName}" — ein digitaler, warmer und kompetenter Service-Experte.`,
    en: `You are the AI Concierge for "${orgName}" — a digital, warm, knowledgeable dining guide.`,
    sr: `Ti si AI Concierge restorana "${orgName}" — digitalni, topao i stručan vodič kroz meni.`,
    hr: `Ti si AI Concierge restorana "${orgName}" — digitalni, topao i stručan vodič kroz jelovnik.`,
    tr: `"${orgName}" için AI Concierge'sin — sıcak ve bilgili dijital menü rehberi.`,
    fr: `Tu es l'AI Concierge de « ${orgName} » — guide digital chaleureux et expert.`,
    es: `Eres el AI Concierge de "${orgName}" — guía digital cálido y experto.`,
    it: `Sei l'AI Concierge di "${orgName}" — guida digitale calorosa ed esperta.`,
  };
  return langBlock(blocks, lang);
}

export function buildSystemPrompt(input: BuildSystemPromptInput): string {
  const lang = resolveAiPromptLanguage(input.language);
  const guestContext = formatGuestContext(input.guestPrefs, lang);
  const orderBlock = input.orderContext?.trim()
    ? `\n\n${input.orderContext.trim()}`
    : "";
  const scrollBrowseBlock = input.browsingContext?.trim()
    ? `\n\nBROWSE-KONTEXT:\n${input.browsingContext.trim()}`
    : "";
  const draftBlock = input.orderDraftContext?.trim()
    ? `\n\nORDER DRAFT:\n${input.orderDraftContext.trim()}`
    : "";
  const orderingBlock =
    input.allowOrdering !== false ? orderingRulesBlock(lang) : "";
  const menuBrowseRulesBlock = browseRulesBlock(lang);
  const playbookBlock = input.playbookContext?.trim()
    ? `\n\n${input.playbookContext.trim()}`
    : "";
  const guestLangHint = formatGuestLanguageHint(
    input.guestMessage,
    input.language,
    lang
  );

  return [
    multilingualPolicyBlock(input.language),
    conversationStyleBlock(),
    orderingConversationFlowBlock(lang),
    identityBlock(input.orgName, lang),
    rulesBlock(lang),
    orderingBlock,
    menuBrowseRulesBlock,
    outputFormatBlock(lang),
    guestContext,
    guestLangHint,
    playbookBlock,
    orderBlock,
    draftBlock,
    scrollBrowseBlock,
    "\n\nMENU:\n",
    input.menuText,
  ]
    .filter(Boolean)
    .join("\n\n");
}
