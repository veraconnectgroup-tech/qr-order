export function hapticClick() {
  try {
    navigator.vibrate?.(10);
  } catch {
    /* unsupported */
  }
}

export function hapticLight() {
  try {
    navigator.vibrate?.(5);
  } catch {
    /* unsupported */
  }
}

export function hapticSuccess() {
  try {
    navigator.vibrate?.([50, 30, 50]);
  } catch {
    /* unsupported */
  }
}
