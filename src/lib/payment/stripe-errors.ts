type StripeLikeError = {
  type?: string;
  code?: string;
  decline_code?: string;
  message?: string;
};

export function getStripeConfirmErrorMessage(
  error: StripeLikeError,
  tUI: (key: string) => string,
  options?: { paymentAtBarEnabled?: boolean }
) {
  const declined =
    error.type === "card_error" ||
    error.code === "card_declined" ||
    Boolean(error.decline_code);

  if (declined) {
    return options?.paymentAtBarEnabled
      ? tUI("error.cardDeclinedPayAtBar")
      : tUI("error.cardDeclined");
  }

  if (
    error.code === "authentication_required" ||
    error.type === "invalid_request_error"
  ) {
    return error.message ?? tUI("error.paymentFailed");
  }

  return error.message ?? tUI("error.paymentFailed");
}

export function getBillApiErrorMessage(
  status: number,
  message: string | undefined,
  tUI: (key: string) => string
) {
  if (status >= 500) {
    return tUI("error.cardNotCharged");
  }
  return message ?? tUI("error.paymentFailed");
}
