const SW_SCRIPT = "/sw.js";
const ACTIVATION_TIMEOUT_MS = 12_000;

export class ServiceWorkerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceWorkerUnavailableError";
  }
}

/** Register the app service worker and wait until it is ready (with timeout). */
export async function registerAppServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new ServiceWorkerUnavailableError(
      "Service workers are not supported in this browser."
    );
  }

  let registration = await navigator.serviceWorker.getRegistration();

  if (!registration) {
    try {
      registration = await navigator.serviceWorker.register(SW_SCRIPT, {
        scope: "/",
      });
    } catch {
      const devHint =
        process.env.NODE_ENV === "development"
          ? " Push notifications require a production build (pnpm build && pnpm start)."
          : "";
      throw new ServiceWorkerUnavailableError(
        `Service worker is not available.${devHint}`
      );
    }
  }

  if (registration.active) {
    return registration;
  }

  try {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        window.setTimeout(() => {
          reject(
            new ServiceWorkerUnavailableError(
              "Service worker took too long to start. Reload the page and try again."
            )
          );
        }, ACTIVATION_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    if (error instanceof ServiceWorkerUnavailableError) {
      throw error;
    }
    throw new ServiceWorkerUnavailableError(
      "Service worker could not be activated."
    );
  }

  return registration;
}
