self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "FullReparo";
  const options = {
    body: data.body || "Você tem uma nova atualização no FullReparo.",
    icon: data.icon || "/pwa-icon-192.png",
    badge: data.badge || "/pwa-icon-192.png",
    tag: data.tag || "fullreparo-update",
    data: {
      url: data.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil((async () => {
    const windowClients = await clients.matchAll({ type: "window", includeUncontrolled: true });

    for (const client of windowClients) {
      if (client.url === targetUrl && "focus" in client) {
        return client.focus();
      }
    }

    if (clients.openWindow) {
      return clients.openWindow(targetUrl);
    }
  })());
});
