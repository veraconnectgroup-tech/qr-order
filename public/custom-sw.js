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
