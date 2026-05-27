/** T0 chips for return-guest welcome (M17). */
export function sameAgainQuickReplyLabels(language: string): {
  sameAgain: string;
  somethingElse: string;
} {
  const lang = language.toLowerCase().slice(0, 2);
  if (lang === "de") {
    return { sameAgain: "Ja, dasselbe", somethingElse: "Etwas anderes" };
  }
  if (lang === "en") {
    return { sameAgain: "Yes, same again", somethingElse: "Something else" };
  }
  return { sameAgain: "Da, isto", somethingElse: "Nešto drugo" };
}
