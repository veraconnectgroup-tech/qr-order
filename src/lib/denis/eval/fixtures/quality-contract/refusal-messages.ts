/** Golden assistant lines — must never classify as refusal (MR-7). */
export const GOLDEN_ASSISTANT_LINES = [
  "Dobar dan i dobrodošli! Tu sam — kako vam mogu pomoći?",
  "Super — dodajem Pils 0.5L u korpu.",
  "Narudžbina #42 je u pripremi, oko 8 minuta.",
  "Good day and welcome! I'm here for you — how may I help?",
  "Guten Tag und willkommen! Wie darf ich Ihnen helfen?",
  "Koju veličinu piva — 0.3L ili 0.5L?",
] as const;

/** Known refusal patterns — detector must catch 100% (MR-7 contract gate). */
export const REFUSAL_ASSISTANT_LINES = [
  "Sorry, I don't understand.",
  "Entschuldigung, ich verstehe nicht ganz.",
  "I can't speak Serbian, only English.",
  "Ne razumem šta ste rekli.",
  "Ich kann nur auf Deutsch antworten.",
  "I didn't catch that — can you repeat?",
] as const;
