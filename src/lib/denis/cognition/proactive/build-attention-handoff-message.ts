/** Guest copy when mental posture escalates to staff (ADR-038 GMM-7). */
export function buildAttentionHandoffMessage(
  language: string | null | undefined
): string {
  const lang = (language ?? "sr").slice(0, 2).toLowerCase();
  if (lang === "de") {
    return "Es tut mir leid für die Wartezeit — ich habe den Kellner informiert.";
  }
  if (lang === "en") {
    return "Sorry for the wait — I've notified the waiter to come over.";
  }
  return "Izvinite zbog čekanja — obavestio sam konobara da dođe.";
}
