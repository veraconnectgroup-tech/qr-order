const PRODUCTION_SW = "/sw.js";
const DEV_SW = "/push-sw.js";
const ACTIVATION_TIMEOUT_MS = 12_000;

export class ServiceWorkerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceWorkerUnavailableError";
  }
}

function serviceWorkerScript(): string {
  return process.env.NODE_ENV === "development" ? DEV_SW : PRODUCTION_SW;
}

function waitForWorkerActivation(
  worker: ServiceWorker,
  timeoutMs: number
): Promise<void> {
  if (worker.state === "activated") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(
        new ServiceWorkerUnavailableError(
          "Service worker took too long to start. Reload the page and try again."
        )
      );
    }, timeoutMs);

    worker.addEventListener("statechange", () => {
      if (worker.state === "activated") {
        window.clearTimeout(timeoutId);
        resolve();
      }
      if (worker.state === "redundant") {
        window.clearTimeout(timeoutId);
        reject(
          new ServiceWorkerUnavailableError(
            "Service worker failed to install. Reload the page and try again."
          )
        );
      }
    });
  });
}

async function waitForRegistrationReady(
  registration: ServiceWorkerRegistration,
  timeoutMs: number
): Promise<ServiceWorkerRegistration> {
  if (registration.active) {
    return registration;
  }

  const installing = registration.installing ?? registration.waiting;
  if (installing) {
    await waitForWorkerActivation(installing, timeoutMs);
    return registration;
  }

  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => {
        reject(
          new ServiceWorkerUnavailableError(
            "Service worker took too long to start. Reload the page and try again."
          )
        );
      }, timeoutMs);
    }),
  ]);

  return registration;
}

function canReuseRegistration(
  registration: ServiceWorkerRegistration,
  script: string
): boolean {
  if (script === DEV_SW) {
    return registration.active?.scriptURL.endsWith("/push-sw.js") ?? false;
  }
  return true;
}

async function registerServiceWorkerScript(
  script: string
): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register(script, { scope: "/" });
}

/** Register the app service worker and wait until it is ready (with timeout). */
export async function registerAppServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new ServiceWorkerUnavailableError(
      "Service workers are not supported in this browser."
    );
  }

  const script = serviceWorkerScript();
  const existing = await navigator.serviceWorker.getRegistration();

  if (existing && canReuseRegistration(existing, script)) {
    void existing.update();
    return waitForRegistrationReady(existing, ACTIVATION_TIMEOUT_MS);
  }

  try {
    const registered = await registerServiceWorkerScript(script);
    return waitForRegistrationReady(registered, ACTIVATION_TIMEOUT_MS);
  } catch {
    if (script !== PRODUCTION_SW) {
      throw new ServiceWorkerUnavailableError(
        process.env.NODE_ENV === "development"
          ? "Service worker is not available. Reload the dev server after saving VAPID keys in .env.local."
          : "Service worker is not available."
      );
    }

    try {
      const fallback = await registerServiceWorkerScript(DEV_SW);
      return waitForRegistrationReady(fallback, ACTIVATION_TIMEOUT_MS);
    } catch {
      throw new ServiceWorkerUnavailableError(
        "Service worker is not available."
      );
    }
  }
}
