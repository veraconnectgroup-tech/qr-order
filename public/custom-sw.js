function resolveNotificationUrl(rawUrl) {
  const fallback = "/waiter";
  const path = rawUrl || fallback;
  try {
    return new URL(path, self.location.origin).href;
  } catch {
    return new URL(fallback, self.location.origin).href;
  }
}

self.addEventListener("push", (e) => {
  const d = e.data?.json() ?? { title: "Vera", body: "New notification" };
  e.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body,
      icon: "/icon-192.png",
      data: { url: d.url || "/waiter" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const targetUrl = resolveNotificationUrl(e.notification.data?.url);

  e.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (!client.url.startsWith(self.location.origin)) continue;
          return client.focus().then((focused) => {
            if (focused && "navigate" in focused) {
              return focused.navigate(targetUrl);
            }
            return focused;
          });
        }
        return clients.openWindow(targetUrl);
      })
  );
});

function notifyClients(type) {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
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
