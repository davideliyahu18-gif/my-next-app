/* Service Worker — Web Push for כדורגל בזמן אמת */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {
    title: "כדורגל בזמן אמת ⚽",
    body: "יש עדכון חדש",
    url: "/",
    tag: "football-realtime",
  };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    try {
      const text = event.data ? event.data.text() : "";
      if (text) data.body = text;
    } catch {
      // keep defaults
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "כדורגל בזמן אמת ⚽", {
      body: data.body || "יש עדכון חדש",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "football-realtime",
      renotify: true,
      data: { url: data.url || "/" },
      dir: "rtl",
      lang: "he",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
      return undefined;
    }),
  );
});
