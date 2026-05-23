self.addEventListener("push", (e) => {
  const d = e.data?.json() ?? { title: "QR Order", body: "New notification" };
  e.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body,
      icon: "/icon-192.png",
      data: { url: d.url || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/dashboard";
  e.waitUntil(clients.openWindow(url));
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
