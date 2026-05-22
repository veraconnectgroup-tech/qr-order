export function formatPrice(amount: number, currency = "EUR", locale = "de-DE") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatOrderNumber(num: number) {
  return `#${String(num).padStart(3, "0")}`;
}

export function toCents(amount: number) {
  return Math.round(amount * 100);
}

export function fromCents(cents: number) {
  return cents / 100;
}
