const PRODUCTION_SW = "/sw.js";
const DEV_SW = "/push-sw.js";
/** Minimal push-only SW for guest QR — no Workbox precache (ADR-019 Phase D). */
export const GUEST_PUSH_SW = "/push-sw.js";
const ACTIVATION_TIMEOUT_MS = 12_000;
const SW_UPDATE_DEFER_MS = 60_000;

export class ServiceWorkerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceWorkerUnavailableError";
  }
}

function serviceWorkerScript(): string {
  return process.env.NODE_ENV === "development" ? DEV_SW : PRODUCTION_SW;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

let inflightRegister: Promise<ServiceWorkerRegistration> | null = null;

function isRegistrationActive(
  registration: ServiceWorkerRegistration
): boolean {
  return Boolean(registration.active);
}

function waitForWorkerActivation(
  worker: ServiceWorker,
  registration: ServiceWorkerRegistration,
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

    const cleanup = () => window.clearTimeout(timeoutId);

    const finishIfActive = () => {
      if (isRegistrationActive(registration)) {
        cleanup();
        resolve();
        return true;
      }
      return false;
    };

    worker.addEventListener("statechange", () => {
      if (worker.state === "activated") {
        cleanup();
        resolve();
        return;
      }

      if (worker.state === "redundant") {
        cleanup();
        if (finishIfActive()) return;

        // Another install won the race — wait for the controller, do not fail immediately.
        void Promise.race([
          navigator.serviceWorker.ready,
          sleep(Math.max(250, timeoutMs)),
        ]).then(() => {
          if (finishIfActive()) return;
          reject(
            new ServiceWorkerUnavailableError(
              "Service worker failed to install. Reload the page and try again."
            )
          );
        });
      }
    });
  });
}

async function waitForRegistrationReady(
  registration: ServiceWorkerRegistration,
  timeoutMs: number
): Promise<ServiceWorkerRegistration> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const current =
      (await navigator.serviceWorker.getRegistration()) ?? registration;

    if (isRegistrationActive(current)) {
      return current;
    }

    const pending = current.installing ?? current.waiting;
    if (pending) {
      try {
        await waitForWorkerActivation(
          pending,
          current,
          Math.max(250, deadline - Date.now())
        );
        if (isRegistrationActive(current)) {
          return current;
        }
      } catch (error) {
        if (
          error instanceof ServiceWorkerUnavailableError &&
          error.message.includes("failed to install")
        ) {
          await sleep(100);
          continue;
        }
        throw error;
      }
    }

    try {
      await Promise.race([
        navigator.serviceWorker.ready,
        sleep(Math.max(250, deadline - Date.now())),
      ]);
      if (isRegistrationActive(current)) {
        return current;
      }
    } catch {
      // Retry until deadline.
    }

    await sleep(100);
  }

  throw new ServiceWorkerUnavailableError(
    "Service worker took too long to start. Reload the page and try again."
  );
}

function canReuseRegistration(
  registration: ServiceWorkerRegistration,
  script: string
): boolean {
  if (script === DEV_SW) {
    return registration.active?.scriptURL.endsWith("/push-sw.js") ?? false;
  }

  const scriptUrl =
    registration.active?.scriptURL ??
    registration.waiting?.scriptURL ??
    registration.installing?.scriptURL;
  if (scriptUrl?.endsWith("/sw.js")) return true;

  // Registration exists but no worker yet — still reuse (install in progress).
  return Boolean(registration.installing || registration.waiting);
}

async function registerServiceWorkerScript(
  script: string
): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register(script, { scope: "/" });
}

async function unregisterAllServiceWorkers(): Promise<void> {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}

async function registerWithScript(
  script: string
): Promise<ServiceWorkerRegistration> {
  const registered = await registerServiceWorkerScript(script);
  return waitForRegistrationReady(registered, ACTIVATION_TIMEOUT_MS);
}

async function registerAppServiceWorkerInternal(): Promise<ServiceWorkerRegistration> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new ServiceWorkerUnavailableError(
      "Service workers are not supported in this browser."
    );
  }

  const script = serviceWorkerScript();
  const existing = await navigator.serviceWorker.getRegistration();

  if (existing && canReuseRegistration(existing, script)) {
    if (isRegistrationActive(existing)) {
      return existing;
    }
    return waitForRegistrationReady(existing, ACTIVATION_TIMEOUT_MS);
  }

  if (existing && !canReuseRegistration(existing, script)) {
    await existing.unregister();
  }

  try {
    return await registerWithScript(script);
  } catch (primaryError) {
    if (script !== PRODUCTION_SW) {
      throw new ServiceWorkerUnavailableError(
        process.env.NODE_ENV === "development"
          ? "Service worker is not available. Reload the dev server after saving VAPID keys in .env.local."
          : "Service worker is not available."
      );
    }

    try {
      await unregisterAllServiceWorkers();
      return await registerWithScript(DEV_SW);
    } catch {
      if (primaryError instanceof ServiceWorkerUnavailableError) {
        throw primaryError;
      }
      throw new ServiceWorkerUnavailableError(
        "Service worker is not available."
      );
    }
  }
}

function isGuestPushRegistration(
  registration: ServiceWorkerRegistration
): boolean {
  const scriptUrl =
    registration.active?.scriptURL ??
    registration.waiting?.scriptURL ??
    registration.installing?.scriptURL;
  return scriptUrl?.endsWith(GUEST_PUSH_SW) ?? false;
}

/** Register minimal push SW for guest QR (no Workbox — avoids stale menu CSS). */
export async function registerGuestPushServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new ServiceWorkerUnavailableError(
      "Service workers are not supported in this browser."
    );
  }

  const existing = await navigator.serviceWorker.getRegistration();
  if (existing && isGuestPushRegistration(existing)) {
    if (isRegistrationActive(existing)) {
      return existing;
    }
    return waitForRegistrationReady(existing, ACTIVATION_TIMEOUT_MS);
  }

  if (existing && !isGuestPushRegistration(existing)) {
    await existing.unregister();
  }

  const registered = await navigator.serviceWorker.register(GUEST_PUSH_SW, {
    scope: "/",
  });
  return waitForRegistrationReady(registered, ACTIVATION_TIMEOUT_MS);
}

/** Register the app service worker and wait until it is ready (with timeout). */
export async function registerAppServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (inflightRegister) {
    return inflightRegister;
  }

  inflightRegister = registerAppServiceWorkerInternal().finally(() => {
    inflightRegister = null;
  });

  return inflightRegister;
}

/** Check for a new sw.js once per page load (staff routes only). */
export async function refreshAppServiceWorker(): Promise<void> {
  try {
    const registration = await registerAppServiceWorker();
    // Defer update so push opt-in on first load does not race a second install.
    window.setTimeout(() => {
      void registration.update().catch(() => {
        // Missing when PWA plugin is disabled or build used Turbopack without SW output.
      });
    }, SW_UPDATE_DEFER_MS);
  } catch {
    // Missing when PWA plugin is disabled or build used Turbopack without SW output.
  }
}
