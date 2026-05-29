/** Golden assistant lines — must never classify as refusal (MR-7). */
export const GOLDEN_ASSISTANT_LINES = [
  "Tu sam! Reci šta želiš — piće, jelo, ili da ti nešto preporučim sa menija?",
  "Super — dodajem Pils 0.5L u korpu.",
  "Narudžbina #42 je u pripremi, oko 8 minuta.",
  "I'm here! What can I get you — a drink, something to eat, or a menu pick?",
  "Ich bin da! Was darf ich bringen?",
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
