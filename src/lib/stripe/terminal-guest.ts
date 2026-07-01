export type TerminalPaymentPhase =
  | "waiting"
  | "processing"
  | "succeeded"
  | "failed";

function terminalLang(language?: string): "sr" | "de" | "en" {
  const lang = (language ?? "sr").toLowerCase().slice(0, 2);
  if (lang === "de") return "de";
  if (lang === "en") return "en";
  return "sr";
}

/** Guest-facing prompt when a table terminal reader is available (Prompt 47). */
export function resolveGuestTerminalPrompt(language?: string): string {
  const lang = terminalLang(language);
  if (lang === "de") {
    return "Sie können Ihre Karte an das Lesegerät neben Ihnen halten.";
  }
  if (lang === "en") {
    return "You can tap your card on the reader next to you.";
  }
  return "Možete prišloniti karticu na čitač pored vas.";
}

/** Real-time terminal payment status copy for guest UI (Prompt 47). */
export function mapTerminalPaymentStatus(
  phase: TerminalPaymentPhase,
  language?: string
): string {
  const lang = terminalLang(language);
  if (phase === "processing") {
    if (lang === "de") return "Zahlung wird verarbeitet…";
    if (lang === "en") return "Payment processing…";
    return "Plaćanje se obrađuje…";
  }
  if (phase === "succeeded") {
    if (lang === "de") return "Zahlung erfolgreich!";
    if (lang === "en") return "Payment successful!";
    return "Uspelo!";
  }
  if (phase === "failed") {
    if (lang === "de") return "Zahlung fehlgeschlagen. Bitte erneut versuchen.";
    if (lang === "en") return "Payment failed. Please try again.";
    return "Plaćanje nije uspelo. Pokušajte ponovo.";
  }
  return resolveGuestTerminalPrompt(language);
}

export function mapReaderStatus(
  status: string | null | undefined
): "online" | "offline" {
  return status === "online" ? "online" : "offline";
}

export function isTerminalPaymentEligible(input: {
  stripeOnboarded: boolean;
  paymentCardAtTableEnabled: boolean;
  readerOnline?: boolean;
}): boolean {
  return (
    input.stripeOnboarded &&
    input.paymentCardAtTableEnabled &&
    (input.readerOnline ?? true)
  );
}
