/** Guest-visible copy only after ACL commit succeeded (ADR-032). */

export function orderSubmitSuccessMessage(input: {
  language: string;
  orderNumber?: number | null;
  awaitingApproval?: boolean;
}): string {
  const lang = input.language.trim().toLowerCase().slice(0, 2);
  const num =
    input.orderNumber != null ? `#${input.orderNumber}` : "";

  if (input.awaitingApproval) {
    switch (lang) {
      case "de":
        return num
          ? `Bestellung ${num} wartet auf Freigabe — ich melde mich gleich.`
          : "Bestellung wartet auf Freigabe — ich melde mich gleich.";
      case "en":
        return num
          ? `Order ${num} is waiting for approval — I'll update you shortly.`
          : "Order is waiting for approval — I'll update you shortly.";
      default:
        return num
          ? `Porudžbina ${num} čeka odobrenje — javljam se uskoro.`
          : "Porudžbina čeka odobrenje — javljam se uskoro.";
    }
  }

  switch (lang) {
    case "de":
      return num
        ? `Erledigt — ${num} ist in der Küche.`
        : "Erledigt — die Bestellung ist in der Küche.";
    case "en":
      return num
        ? `Done — ${num} is on its way to the kitchen.`
        : "Done — your order is on its way to the kitchen.";
    default:
      return num
        ? `Poslato — ${num} ide u kuhinju.`
        : "Poslato — porudžbina ide u kuhinju.";
  }
}

export function orderSubmitNotAttemptedMessage(language: string): string {
  const lang = language.trim().toLowerCase().slice(0, 2);
  switch (lang) {
    case "de":
      return "Die Bestellung konnte nicht gesendet werden — bitte Seite aktualisieren und erneut versuchen.";
    case "en":
      return "I couldn't send the order — please refresh and try again.";
    default:
      return "Nisam mogao da pošaljem porudžbinu — osvežite stranicu i pokušajte ponovo.";
  }
}
