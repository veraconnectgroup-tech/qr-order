/* Minimal push service worker — used in development (next-pwa is disabled in dev). */
importScripts("/guest-offline-sw.js");

function notifyClients(type) {
  return self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => {
      for (const client of clients) {
        client.postMessage({ type });
      }
    });
}

self.addEventListener("sync", (event) => {
  if (event.tag === "qr-order-sync") {
    event.waitUntil(notifyClients("FLUSH_ORDER_QUEUE"));
  }
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "refresh-menu-cache") {
    event.waitUntil(notifyClients("REFRESH_MENU"));
  }
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {
    title: "Denis",
    body: "New notification",
  };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      data: {
        url: data.url || "/",
        soundProfile: data.soundProfile ?? "default",
      },
      vibrate: Array.isArray(data.vibrate) ? data.vibrate : undefined,
      requireInteraction: Boolean(data.urgent),
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
